const axios = require('axios');
const Rate = require('../models/Rate');

const KURSIGE_URL = 'https://api.kursi.ge:8080/api/public/currencies';
const SUPPORTED_PAIRS = {
  usd: ['GEL', 'USD'],
  eur: ['GEL', 'EUR'],
  gbp: ['GEL', 'GBP'],
  rub: ['GEL', 'RUB'],
  try: ['GEL', 'TRY']
};

function normalizeCode(value) {
  return String(value || '').trim().toUpperCase();
}

function toNumber(value) {
  if (value === null || value === undefined || value === '') return null;

  const number = Number(String(value).replace(',', '.'));
  return Number.isFinite(number) ? number : null;
}

function getRows(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.currencies)) return payload.currencies;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
}

function getPair(rows, [base, secondary]) {
  const row = rows.find(item =>
    normalizeCode(item.baseCurrencyCode) === base &&
    normalizeCode(item.secondaryCurrencyCode) === secondary
  );

  if (!row) return { buy: null, sell: null };

  return {
    buy: toNumber(row.buyRate),
    sell: toNumber(row.sellRate)
  };
}

async function fetchKursiRates() {
  try {
    const { data } = await axios.get(KURSIGE_URL, {
      timeout: 15000,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'AllRates.ge/1.0'
      }
    });

    const rows = getRows(data);
    if (!rows.length) {
      throw new Error('Unexpected Kursige API response: no currency rows');
    }

    const rates = Object.fromEntries(
      Object.entries(SUPPORTED_PAIRS).map(([key, pair]) => [key, getPair(rows, pair)])
    );

    const hasAnyRate = Object.values(rates).some(rate => rate.buy !== null || rate.sell !== null);
    if (!hasAnyRate) {
      const availablePairs = rows
        .map(row => `${normalizeCode(row.baseCurrencyCode)}/${normalizeCode(row.secondaryCurrencyCode)}`)
        .filter(pair => pair !== '/')
        .join(', ');
      console.warn(`[Kursige] available pairs: ${availablePairs || 'none'}`);
      throw new Error('No supported currency pairs found in Kursige API response');
    }

    const newRate = new Rate({
      company: 'Kursige',
      usdBuy: rates.usd.buy,
      usdSell: rates.usd.sell,
      eurBuy: rates.eur.buy,
      eurSell: rates.eur.sell,
      gbpBuy: rates.gbp.buy,
      gbpSell: rates.gbp.sell,
      rubBuy: rates.rub.buy,
      rubSell: rates.rub.sell,
      tryBuy: rates.try.buy,
      trySell: rates.try.sell,
      date: new Date()
    });

    await newRate.save();
    const missingPairs = Object.entries(SUPPORTED_PAIRS)
      .filter(([key]) => rates[key].buy === null && rates[key].sell === null)
      .map(([, [base, secondary]]) => `${base}/${secondary}`);

    if (missingPairs.length) {
      console.log(`[Kursige] API-ში დროებით არ არის ეს წყვილები: ${missingPairs.join(', ')}`);
    }

    console.log(`✅ [Kursige] მონაცემები წარმატებით შეინახა ბაზაში! USD: ${newRate.usdBuy}/${newRate.usdSell}`);
    return newRate;
  } catch (error) {
    console.error('❌ [Kursige] სკრეპინგის შეცდომა:', error.message);
    return null;
  }
}

module.exports = fetchKursiRates;
