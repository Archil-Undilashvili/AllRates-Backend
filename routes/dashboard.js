const express = require('express');
const router = express.Router();
const UserDashboard = require('../models/UserDashboard');
const { verifyToken } = require('../middleware/auth');

const SLOT_KEYS = ['company', 'forex', 'crypto', 'asset'];

function normalizeDashboardPayload(body = {}) {
    const filters = {};
    const items = {};

    SLOT_KEYS.forEach(key => {
        filters[key] = body.filters && typeof body.filters[key] === 'boolean'
            ? body.filters[key]
            : true;

        items[key] = Array.isArray(body.items && body.items[key])
            ? body.items[key].map(value => String(value)).filter(Boolean).slice(0, 80)
            : [];
    });

    if (!Object.values(filters).some(Boolean)) filters.company = true;

    return { filters, items };
}

router.get('/', verifyToken, async (req, res) => {
    try {
        const dashboard = await UserDashboard.findOne({ userId: req.user.userId });
        if (!dashboard) {
            return res.json({
                filters: { company: true, forex: true, crypto: true, asset: true },
                items: { company: [], forex: [], crypto: [], asset: [] }
            });
        }

        res.json({
            filters: dashboard.filters,
            items: dashboard.items,
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
                updatedAt: dashboard.updatedAt
            }
        });
    } catch (error) {
        console.error('დეშბორდის შენახვის შეცდომა:', error);
        res.status(500).json({ message: 'დეშბორდის შენახვა ვერ მოხერხდა' });
    }
});

module.exports = router;
