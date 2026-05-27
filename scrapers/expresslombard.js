const axios = require('axios');
const Rate = require('../models/Rate');

const EXPRESS_LOMBARD_API_URL = 'https://expresslombard.ge/api/currencies/get-currencies';

function parseExpressLombardRates(payload) {
  const rows = Array.isArray(payload?.result) ? payload.result : [];
  const byCurrency = new Map(rows.map((row) => [String(row.currency || '').toUpperCase(), row]));

  const getRate = (currency) => {
    const row = byCurrency.get(currency) || (currency === 'RUB' ? byCurrency.get('RUR') : null);
    if (!row) return { buy: null, sell: null };

    const buy = Number(row.rateBuy);
    const sell = Number(row.rateSell);

    return {
      buy: Number.isFinite(buy) ? buy : null,
      sell: Number.isFinite(sell) ? sell : null
    };
  };

  const usd = getRate('USD');
  const eur = getRate('EUR');
  const gbp = getRate('GBP');
  const rub = getRate('RUB');
  const tryCur = getRate('TRY');

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

async function fetchExpressLombardRates() {
  try {
    const { data } = await axios.get(EXPRESS_LOMBARD_API_URL, {
      timeout: 20000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AllRates.ge scraper)',
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'x-lang': 'ka',
        'Accept-Language': 'ka'
      }
    });

    const rates = parseExpressLombardRates(data);

    if (!rates.usdBuy && !rates.eurBuy && !rates.gbpBuy && !rates.rubBuy && !rates.tryBuy) {
      throw new Error('Express Lombard API-ში ვალუტის კურსები ვერ მოიძებნა');
    }

    const newRate = new Rate({
      company: 'ExpressLombard',
      ...rates,
      date: new Date()
    });

    await newRate.save();
    console.log(`✅ [ExpressLombard] მონაცემები წარმატებით შეინახა ბაზაში! USD: ${newRate.usdBuy}/${newRate.usdSell}, EUR: ${newRate.eurBuy}/${newRate.eurSell}`);
  } catch (error) {
    console.error('❌ [ExpressLombard] სკრეპინგის შეცდომა:', error.message);
  }
}

module.exports = fetchExpressLombardRates;
module.exports.parseExpressLombardRates = parseExpressLombardRates;
