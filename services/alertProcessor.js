const Rate = require('../models/Rate');
const RateAlert = require('../models/RateAlert');
const User = require('../models/User');
const axios = require('axios');
const { sendRateAlertEmail } = require('./alertMailer');

const SHEETS_API_URL = process.env.SHEETS_API_URL || 'https://sheets-api-production-c989.up.railway.app/api/data';
const FOREX_PAIR_COLUMNS = [
  ['Pair (Popular)', 'Rate (Popular)'],
  ['Pair (vs USD)', 'Rate (vs USD)'],
  ['Pair (vs EUR)', 'Rate (vs EUR)'],
  ['Pair (vs GBP)', 'Rate (vs GBP)'],
  ['Pair (vs CHF)', 'Rate (vs CHF)']
];
let forexCache = { fetchedAt: 0, rates: new Map() };
let cryptoCache = { fetchedAt: 0, rates: new Map() };
let assetCache = { fetchedAt: 0, rates: new Map() };

const COINGECKO_CRYPTO_IDS = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
  USDT: 'tether',
  BNB: 'binancecoin',
  SOL: 'solana',
  XRP: 'ripple',
  DOGE: 'dogecoin',
  ADA: 'cardano',
  TON: 'toncoin',
  USDC: 'usd-coin'
};

const PAIR_FIELD_MAP = {
  USDGEL: { buy: 'usdBuy', sell: 'usdSell' },
  EURGEL: { buy: 'eurBuy', sell: 'eurSell' },
  GBPGEL: { buy: 'gbpBuy', sell: 'gbpSell' },
  RUBGEL: { buy: 'rubBuy', sell: 'rubSell' },
  TRYGEL: { buy: 'tryBuy', sell: 'trySell' }
};

function normalizeCompanyKey(value) {
  const raw = String(value || '').toLowerCase();
  const compact = raw.split('(')[0].replace(/[^a-z]/g, '');
  const aliases = {
    basisbank: 'bb',
    inteliexpress: 'inex',
    expresslombard: 'expresslombard',
    express: 'expresslombard',
    hashbank: 'hash',
    isbank: 'is',
    terabank: 'tera',
    leadercredit: 'leader',
    smartfin: 'smarti',
    smart: 'smarti',
    georgian: 'georgiancredit',
    tbilmicrocredit: 'tbmc',
    alpha: 'alphaexpress',
    cartubank: 'cartu',
    bankofgeorgia: 'bog'
  };
  return aliases[compact] || compact;
}

function getCurrentRate(rate, alert) {
  const fields = PAIR_FIELD_MAP[alert.pair];
  if (!fields) return NaN;
  const field = alert.side === 'buy' ? fields.buy : fields.sell;
  return Number(rate[field]);
}

function normalizeSheetRows(raw) {
  if (raw?.data && Array.isArray(raw.data)) {
    const headers = raw.data[0] || [];
    return raw.data.slice(1).map(row => {
      const obj = {};
      headers.forEach((header, index) => {
        obj[header] = row[index];
      });
      return obj;
    });
  }
  return Array.isArray(raw) ? raw : [];
}

async function loadForexRates() {
  const now = Date.now();
  if (now - forexCache.fetchedAt < 55_000 && forexCache.rates.size) {
    return forexCache.rates;
  }

  const response = await axios.get(SHEETS_API_URL, { timeout: 15000 });
  const rows = normalizeSheetRows(response.data);
  const rates = new Map();

  rows.forEach(row => {
    FOREX_PAIR_COLUMNS.forEach(([pairKey, rateKey]) => {
      const pair = String(row[pairKey] || '').trim().toUpperCase();
      const rate = Number(row[rateKey]);
      if (pair && Number.isFinite(rate)) rates.set(pair, rate);
    });
  });

  forexCache = { fetchedAt: now, rates };
  return rates;
}

async function loadCryptoRates() {
  const now = Date.now();
  if (now - cryptoCache.fetchedAt < 55_000 && cryptoCache.rates.size) {
    return cryptoCache.rates;
  }

  const rates = new Map();

  try {
    const response = await axios.get('https://api.binance.com/api/v3/ticker/24hr', { timeout: 15000 });
    const rows = Array.isArray(response.data) ? response.data : [];
    rows.forEach(item => {
      const pair = String(item.symbol || '').trim().toUpperCase();
      const rate = Number(item.lastPrice);
      if (pair.endsWith('USDT') && Number.isFinite(rate)) rates.set(pair, rate);
    });
  } catch (error) {
    console.warn('Binance crypto alert source failed, using CoinGecko fallback:', error.message);
  }

  const missingFallbackPairs = Object.keys(COINGECKO_CRYPTO_IDS)
    .map(symbol => `${symbol}USDT`)
    .filter(pair => !rates.has(pair));

  if (missingFallbackPairs.length) {
    const ids = [...new Set(missingFallbackPairs.map(pair => COINGECKO_CRYPTO_IDS[pair.replace('USDT', '')]).filter(Boolean))];
    if (ids.length) {
      const response = await axios.get('https://api.coingecko.com/api/v3/simple/price', {
        timeout: 15000,
        params: {
          ids: ids.join(','),
          vs_currencies: 'usd'
        }
      });

      Object.entries(COINGECKO_CRYPTO_IDS).forEach(([symbol, id]) => {
        const rate = Number(response.data?.[id]?.usd);
        if (Number.isFinite(rate)) rates.set(`${symbol}USDT`, rate);
      });
    }
  }

  if (!rates.size) {
    throw new Error('Crypto alert rates unavailable');
  }

  cryptoCache = { fetchedAt: now, rates };
  return rates;
}

async function loadAssetRates() {
  const now = Date.now();
  if (now - assetCache.fetchedAt < 55_000 && assetCache.rates.size) {
    return assetCache.rates;
  }

  const response = await axios.get(SHEETS_API_URL, { timeout: 15000 });
  const rows = normalizeSheetRows(response.data);
  const rates = new Map();

  rows.forEach(row => {
    const name = String(row.MEA || '').trim();
    const rate = Number(row['Rate (MEA)']);
    if (name && Number.isFinite(rate)) rates.set(name.toUpperCase(), rate);
  });

  assetCache = { fetchedAt: now, rates };
  return rates;
}

function isTriggered(alert, currentRate) {
  if (!Number.isFinite(currentRate)) return false;
  return alert.operator === 'gt'
    ? currentRate > alert.targetRate
    : currentRate < alert.targetRate;
}

async function loadLatestRatesByCompany() {
  const latestRates = await Rate.aggregate([
    { $sort: { createdAt: -1 } },
    { $group: { _id: '$company', latestRecord: { $first: '$$ROOT' } } },
    { $replaceRoot: { newRoot: '$latestRecord' } }
  ]);

  return latestRates.reduce((map, rate) => {
    map.set(normalizeCompanyKey(rate.company), rate);
    return map;
  }, new Map());
}

async function processRateAlerts() {
  const alerts = await RateAlert.find({ status: 'active' }).limit(200);
  if (!alerts.length) return { checked: 0, sent: 0 };

  const companyAlerts = alerts.filter(alert => (alert.alertType || 'company') === 'company');
  const forexAlerts = alerts.filter(alert => alert.alertType === 'forex');
  const cryptoAlerts = alerts.filter(alert => alert.alertType === 'crypto');
  const assetAlerts = alerts.filter(alert => alert.alertType === 'asset');
  const ratesByCompany = companyAlerts.length ? await loadLatestRatesByCompany() : new Map();
  let forexRates = new Map();
  let cryptoRates = new Map();
  let assetRates = new Map();
  if (forexAlerts.length) {
    try {
      forexRates = await loadForexRates();
    } catch (error) {
      console.error('FOREX alert rates fetch failed:', error.message);
    }
  }
  if (cryptoAlerts.length) {
    try {
      cryptoRates = await loadCryptoRates();
    } catch (error) {
      console.error('Crypto alert rates fetch failed:', error.message);
    }
  }
  if (assetAlerts.length) {
    try {
      assetRates = await loadAssetRates();
    } catch (error) {
      console.error('Asset alert rates fetch failed:', error.message);
    }
  }
  let sent = 0;

  for (const alert of alerts) {
    let currentRate = NaN;
    if (alert.alertType === 'forex') {
      currentRate = Number(forexRates.get(alert.pair));
    } else if (alert.alertType === 'crypto') {
      currentRate = Number(cryptoRates.get(alert.pair));
    } else if (alert.alertType === 'asset') {
      currentRate = Number(assetRates.get(String(alert.pair || '').toUpperCase()));
    } else {
      const rate = ratesByCompany.get(alert.companyKey);
      if (!rate) continue;
      currentRate = getCurrentRate(rate, alert);
    }
    if (!isTriggered(alert, currentRate)) continue;

    const user = await User.findById(alert.userId);
    if (!user?.email) continue;

    await sendRateAlertEmail({ to: user.email, alert, currentRate });

    alert.status = 'triggered';
    alert.triggeredAt = new Date();
    alert.triggeredRate = currentRate;
    alert.sentTo = user.email;
    await alert.save();
    sent += 1;
  }

  return { checked: alerts.length, sent };
}

module.exports = {
  PAIR_FIELD_MAP,
  getCurrentRate,
  loadAssetRates,
  loadCryptoRates,
  loadForexRates,
  normalizeCompanyKey,
  processRateAlerts
};
