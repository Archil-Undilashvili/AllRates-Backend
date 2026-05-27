const axios = require('axios');
const Rate = require('../models/Rate');

const CENTRAL_API_URL = 'https://central.ge/api/homepage';

function readPair(rates, fromCcy) {
  const row = Array.isArray(rates)
    ? rates.find(item =>
        String(item.fromCcy || '').toUpperCase() === fromCcy &&
        String(item.toCcy || '').toUpperCase() === 'GEL'
      )
    : null;

  return {
    buy: row && Number.isFinite(Number(row.buy)) ? Number(row.buy) : null,
    sell: row && Number.isFinite(Number(row.sell)) ? Number(row.sell) : null
  };
}

function parseCentralRates(payload) {
  const rates = payload && payload.currencyRates;
  const usd = readPair(rates, 'USD');
  const eur = readPair(rates, 'EUR');
  const gbp = readPair(rates, 'GBP');
  const rub = readPair(rates, 'RUB');
  const tryCur = readPair(rates, 'TRY');

  return {
    usdBuy: usd.buy,
    usdSell: usd.sell,
    eurBuy: eur.buy,
    eurSell: eur.sell,
    gbpBuy: gbp.buy,
    gbpSell: gbp.sell,
    rubBuy: rub.buy,
    rubSell: rub.sell,
    tryBuy: tryCur.buy,
    trySell: tryCur.sell
  };
}

async function fetchCentralRates() {
  try {
    const { data } = await axios.get(CENTRAL_API_URL, {
      timeout: 20000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AllRates.ge scraper)',
        'Accept': 'application/json'
      }
    });

    const rates = parseCentralRates(data);

    if (!rates.usdBuy && !rates.eurBuy && !rates.gbpBuy && !rates.rubBuy && !rates.tryBuy) {
      throw new Error('Central API-ში GEL წყვილების კურსები ვერ მოიძებნა');
    }

    const newRate = new Rate({
      company: 'Central',
      ...rates,
      date: new Date()
    });

    await newRate.save();
    console.log(`✅ [Central] მონაცემები წარმატებით შეინახა ბაზაში! USD: ${newRate.usdBuy}/${newRate.usdSell}, EUR: ${newRate.eurBuy}/${newRate.eurSell}`);
  } catch (error) {
    console.error('❌ [Central] სკრეპინგის შეცდომა:', error.message);
  }
}

module.exports = fetchCentralRates;
module.exports.parseCentralRates = parseCentralRates;
