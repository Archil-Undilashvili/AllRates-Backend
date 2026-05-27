const express = require('express');
const router = express.Router();
const UserDashboard = require('../models/UserDashboard');
const { verifyToken } = require('../middleware/auth');

const SLOT_KEYS = [
    'company-usd',
    'company-eur',
    'company-gbp',
    'company-rub',
    'company-try',
    'market',
    'official',
    'forex',
    'crypto',
    'asset'
];

const DEFAULT_FILTERS = SLOT_KEYS.reduce((filters, key) => {
    filters[key] = key === 'company-usd';
    return filters;
}, {});

const DEFAULT_ITEMS = SLOT_KEYS.reduce((items, key) => {
    items[key] = [];
    return items;
}, {});

function normalizeDashboardPayload(body = {}) {
    const filters = {};
    const items = {};
    const order = Array.isArray(body.order)
        ? body.order.map(value => String(value)).filter(value => SLOT_KEYS.includes(value)).slice(0, SLOT_KEYS.length)
        : [];

    SLOT_KEYS.forEach(key => {
        filters[key] = body.filters && typeof body.filters[key] === 'boolean'
            ? body.filters[key]
            : DEFAULT_FILTERS[key];

        items[key] = Array.isArray(body.items && body.items[key])
            ? body.items[key].map(value => String(value)).filter(Boolean).slice(0, 80)
            : [];
    });

    if (!Object.values(filters).some(Boolean)) filters['company-usd'] = true;

    return { filters, items, order };
}

router.get('/', verifyToken, async (req, res) => {
    try {
        const dashboard = await UserDashboard.findOne({ userId: req.user.userId });
        if (!dashboard) {
            return res.json({
                filters: DEFAULT_FILTERS,
                items: DEFAULT_ITEMS,
                order: SLOT_KEYS
            });
        }

        res.json({
            filters: { ...DEFAULT_FILTERS, ...(dashboard.filters || {}) },
            items: { ...DEFAULT_ITEMS, ...(dashboard.items || {}) },
            order: Array.isArray(dashboard.order) && dashboard.order.length ? dashboard.order : SLOT_KEYS,
            updatedAt: dashboard.updatedAt
        });
    } catch (error) {
        console.error('დეშბორდის წამოღების შეცდომა:', error);
        res.status(500).json({ message: 'დეშბორდის წამოღება ვერ მოხერხდა' });
    }
});

router.put('/', verifyToken, async (req, res) => {
    try {
        const payload = normalizeDashboardPayload(req.body);
        const dashboard = await UserDashboard.findOneAndUpdate(
            { userId: req.user.userId },
            { userId: req.user.userId, ...payload },
            { new: true, upsert: true, setDefaultsOnInsert: true }
        );

        res.json({
            message: 'დეშბორდი შენახულია',
            dashboard: {
                filters: dashboard.filters,
                items: dashboard.items,
                order: dashboard.order,
                updatedAt: dashboard.updatedAt
            }
        });
    } catch (error) {
        console.error('დეშბორდის შენახვის შეცდომა:', error);
        res.status(500).json({ message: 'დეშბორდის შენახვა ვერ მოხერხდა' });
    }
});

module.exports = router;
