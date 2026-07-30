const axios = require('axios');
const Rate = require('../models/Rate');

const CRYSTAL_RATES_URL = "https://crystal.ge/api/wi/rate/v1/cryst?key=52ef35743f3c4f5027d82f051c258241";

function parseCrystalPayload(outer) {
  const inner = typeof outer?.data === 'string' ? JSON.parse(outer.data) : outer?.data;
  return Array.isArray(inner?.data?.CurrencyRate) ? inner.data.CurrencyRate : [];
}

function toNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function normalizeCrystalAmount(iso, value) {
  const num = toNumber(value);
  if (num === null) return null;

  // Crystal displays RUB as 100 RUB on the site/API, while AllRates stores one-unit rates.
  if (iso === 'RUB') return Number((num / 100).toFixed(4));

  // TRY is already one-unit on Crystal, so it must not be divided.
  if (iso === 'TRY') return Number(num.toFixed(4));

  return num;
}

async function getCurrentCrystalRates() {
  const { data: outer } = await axios.get(CRYSTAL_RATES_URL, { timeout: 15000 });
  const rates = parseCrystalPayload(outer);
  const find = (iso) => rates.find(r => r.ISO === iso);

  const usd = find("USD");
  const eur = find("EUR");
  const gbp = find("GBP");
  const rub = find("RUB");
  const tryCur = find("TRY");
  const tryBuy = tryCur ? normalizeCrystalAmount('TRY', tryCur.AMOUNT_BUY) : null;
  const trySell = tryCur ? normalizeCrystalAmount('TRY', tryCur.AMOUNT_SELL) : null;

  if (tryCur && (tryBuy === trySell || tryBuy < 0.01 || trySell < 0.01)) {
    throw new Error(`Unexpected TRY payload from Crystal: buy=${tryCur.AMOUNT_BUY}, sell=${tryCur.AMOUNT_SELL}`);
  }

  return {
    usdBuy: usd ? normalizeCrystalAmount('USD', usd.AMOUNT_BUY) : null,
    usdSell: usd ? normalizeCrystalAmount('USD', usd.AMOUNT_SELL) : null,
    eurBuy: eur ? normalizeCrystalAmount('EUR', eur.AMOUNT_BUY) : null,
    eurSell: eur ? normalizeCrystalAmount('EUR', eur.AMOUNT_SELL) : null,
    gbpBuy: gbp ? normalizeCrystalAmount('GBP', gbp.AMOUNT_BUY) : null,
    gbpSell: gbp ? normalizeCrystalAmount('GBP', gbp.AMOUNT_SELL) : null,
    rubBuy: rub ? normalizeCrystalAmount('RUB', rub.AMOUNT_BUY) : null,
    rubSell: rub ? normalizeCrystalAmount('RUB', rub.AMOUNT_SELL) : null,
    tryBuy,
    trySell
  };
}

async function fetchCrystalRates() {
  try {
    const rates = await getCurrentCrystalRates();

    const newRate = new Rate({
      company: 'Crystal',
      ...rates,
      date: new Date()
    });

    await newRate.save();
    console.log(`✅ [Crystal] მონაცემები წარმატებით შეინახა ბაზაში! USD: ${newRate.usdBuy}/${newRate.usdSell}`);
  } catch (error) {
    console.error('❌ [Crystal] სკრეპინგის შეცდომა:', error.message);
  }
}

fetchCrystalRates.getCurrentCrystalRates = getCurrentCrystalRates;

module.exports = fetchCrystalRates;
