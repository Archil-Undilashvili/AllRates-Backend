const express = require('express');
const router = express.Router();
const RateAlert = require('../models/RateAlert');
const { verifyToken } = require('../middleware/auth');

const ALLOWED_PAIRS = ['USDGEL', 'EURGEL', 'GBPGEL', 'RUBGEL', 'TRYGEL'];
const ALLOWED_SIDES = ['buy', 'sell'];
const ALLOWED_OPERATORS = ['lt', 'gt'];
const MAX_ALERTS_PER_USER = 10;
const MARKET_ALERT_TYPES = ['forex', 'crypto', 'asset'];

function normalizeAlertPayload(body = {}) {
  const requestedType = String(body.alertType || '').trim().toLowerCase();
  const companyKey = String(body.companyKey || '').trim().toLowerCase();
  const companyName = String(body.companyName || '').trim();
  const pair = String(body.pair || '').trim().toUpperCase();
  const looksLikeMarketAlert = String(body.side || '').trim() === 'rate'
    || (!companyKey && !companyName && pair && !ALLOWED_PAIRS.includes(pair))
    || ['FOREX', 'CRYPTO', 'ASSET'].includes(companyName.toUpperCase());
  const alertType = requestedType || (looksLikeMarketAlert ? 'forex' : 'company');
  const side = String(body.side || (MARKET_ALERT_TYPES.includes(alertType) ? 'rate' : '')).trim();
  const operator = String(body.operator || '').trim();
  const targetRate = Number(body.targetRate);

  if (!['company', 'forex', 'crypto', 'asset'].includes(alertType)) throw new Error('აირჩიეთ სწორი alert ტიპი');
  if (alertType === 'company') {
    if (!companyKey || !companyName) throw new Error('აირჩიეთ კომპანია');
    if (!ALLOWED_PAIRS.includes(pair)) throw new Error('აირჩიეთ სწორი სავალუტო წყვილი');
    if (!ALLOWED_SIDES.includes(side)) throw new Error('აირჩიეთ ყიდვა ან გაყიდვა');
  } else if (alertType === 'forex') {
    if (!/^[A-Z]{6,12}$/.test(pair)) throw new Error('აირჩიეთ სწორი FOREX წყვილი');
  } else if (alertType === 'crypto') {
    if (!/^[A-Z0-9]{2,20}USDT$/.test(pair)) throw new Error('აირჩიეთ სწორი კრიპტო წყვილი');
  } else {
    if (!pair || pair.length > 80) throw new Error('აირჩიეთ სწორი აქტივი');
  }
  if (!ALLOWED_OPERATORS.includes(operator)) throw new Error('აირჩიეთ ნაკლებია ან მეტია');
  if (!Number.isFinite(targetRate) || targetRate <= 0) throw new Error('ჩაწერეთ სწორი სამიზნე კურსი');

  return {
    alertType,
    companyKey: alertType === 'company' ? companyKey : '',
    companyName: alertType === 'company' ? companyName : ({ crypto: 'CRYPTO', asset: 'ASSET' }[alertType] || 'FOREX'),
    pair,
    side: MARKET_ALERT_TYPES.includes(alertType) ? 'rate' : side,
    operator,
    targetRate
  };
}

router.get('/', verifyToken, async (req, res) => {
  try {
    const alerts = await RateAlert.find({ userId: req.user.userId }).sort({ createdAt: 1 });
    res.json({ alerts });
  } catch (error) {
    console.error('Alert-ების წამოღების შეცდომა:', error);
    res.status(500).json({ message: 'Alert-ების წამოღება ვერ მოხერხდა' });
  }
});

router.post('/', verifyToken, async (req, res) => {
  try {
    const count = await RateAlert.countDocuments({ userId: req.user.userId });
    if (count >= MAX_ALERTS_PER_USER) {
      return res.status(400).json({ message: `მაქსიმუმ ${MAX_ALERTS_PER_USER} alert-ის შექმნაა შესაძლებელი` });
    }

    const payload = normalizeAlertPayload(req.body);
    const alert = await RateAlert.create({
      userId: req.user.userId,
      ...payload
    });
    res.status(201).json({ alert });
  } catch (error) {
    res.status(400).json({ message: error.message || 'Alert-ის შექმნა ვერ მოხერხდა' });
  }
});

router.put('/:id', verifyToken, async (req, res) => {
  try {
    const current = await RateAlert.findOne({ _id: req.params.id, userId: req.user.userId });
    if (!current) return res.status(404).json({ message: 'Alert ვერ მოიძებნა' });
    if (current.status === 'triggered') {
      return res.status(409).json({ message: 'შესრულებული Alert-ის შეცვლა შეუძლებელია' });
    }

    const payload = normalizeAlertPayload(req.body);
    Object.assign(current, payload);
    await current.save();
    res.json({ alert: current });
  } catch (error) {
    res.status(400).json({ message: error.message || 'Alert-ის შენახვა ვერ მოხერხდა' });
  }
});

router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const deleted = await RateAlert.findOneAndDelete({ _id: req.params.id, userId: req.user.userId });
    if (!deleted) return res.status(404).json({ message: 'Alert ვერ მოიძებნა' });
    res.json({ message: 'Alert წაშლილია' });
  } catch (error) {
    res.status(500).json({ message: 'Alert-ის წაშლა ვერ მოხერხდა' });
  }
});

module.exports = router;
