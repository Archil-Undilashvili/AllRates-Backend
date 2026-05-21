const axios = require('axios');
const Rate = require('../models/Rate');

const KURSIGE_URL = 'https://api.kursi.ge:8080/api/public/currencies';
const SHEETS_FALLBACK_URL = 'https://sheets-api-production-c989.up.railway.app/api/data';
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

async function fetchRowsFromKursigeApi() {
  const { data } = await axios.get(KURSIGE_URL, {
    timeout: 8000,
    headers: {
      Accept: 'application/json',
      'User-Agent': 'Mozilla/5.0 AllRates.ge/1.0',
      Referer: 'https://kursi.ge/ka/',
      Origin: 'https://kursi.ge'
    }
  });

  return getRows(data);
}

async function fetchRowsFromSheetsFallback() {
  const { data } = await axios.get(SHEETS_FALLBACK_URL, {
    timeout: 10000,
    headers: {
      Accept: 'application/json',
      'User-Agent': 'AllRates.ge/1.0'
    }
  });

  const table = Array.isArray(data?.data) ? data.data : [];
  const headers = table[0] || [];
  const kursigeRow = table.find(row => normalizeCode(row?.[0]) === 'KURSIGE');

  if (!kursigeRow) return [];

  const column = (name) => headers.findIndex(header => normalizeCode(header) === normalizeCode(name));
  const value = (name) => {
    const index = column(name);
    return index >= 0 ? kursigeRow[index] : null;
  };

  return [
    {
      baseCurrencyCode: 'GEL',
      secondaryCurrencyCode: 'USD',
      buyRate: value('USDGEL (Buy)'),
      sellRate: value('USDGEL (Sell)')
    },
    {
      baseCurrencyCode: 'GEL',
      secondaryCurrencyCode: 'EUR',
      buyRate: value('EURGEL (Buy)'),
      sellRate: value('EURGEL (Sell)')
    }
  ];
}

async function fetchCurrencyRows() {
  try {
    const rows = await fetchRowsFromKursigeApi();
    if (rows.length) return rows;
    throw new Error('Kursige API returned no rows');
  } catch (error) {
    console.warn(`[Kursige] primary API failed, trying sheets fallback: ${error.message}`);
    const fallbackRows = await fetchRowsFromSheetsFallback();
    if (fallbackRows.length) return fallbackRows;
    throw error;
  }
}

async function fetchKursiRates() {
  try {
    const rows = await fetchCurrencyRows();
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
