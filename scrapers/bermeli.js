const axios = require('axios');
const cheerio = require('cheerio');
const Rate = require('../models/Rate');

const BERMELI_URL = 'https://bermeli.ge/ka/currency';

function parseNumber(value) {
  const parsed = parseFloat(String(value || '').replace(',', '.').trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function parseBermeliRates(html) {
  const $ = cheerio.load(html);
  const result = {
    usdBuy: null,
    usdSell: null,
    eurBuy: null,
    eurSell: null,
    tryBuy: null,
    trySell: null
  };

  $('.exchange table tbody tr').each((_, row) => {
    const currency = $(row).find('.flag').text().replace(/\s+/g, ' ').trim().toUpperCase();
    const values = $(row).find('.currency-abbr').map((__, cell) => parseNumber($(cell).text())).get();
    const [buy, sell] = values.filter(value => value !== null);

    if (currency.includes('USD')) {
      result.usdBuy = buy || null;
      result.usdSell = sell || null;
    }
    if (currency.includes('EUR')) {
      result.eurBuy = buy || null;
      result.eurSell = sell || null;
    }
    if (currency.includes('TRY')) {
      result.tryBuy = buy || null;
      result.trySell = sell || null;
    }
  });

  return result;
}

async function fetchBermeliRates() {
  try {
    const { data: html } = await axios.get(BERMELI_URL, {
      timeout: 20000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AllRates.ge scraper)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    });

    const rates = parseBermeliRates(html);

    if (!rates.usdBuy && !rates.eurBuy && !rates.tryBuy) {
      throw new Error('Bermeli HTML-ში USD/EUR/TRY კურსები ვერ მოიძებნა');
    }

    const newRate = new Rate({
      company: 'Bermeli',
      usdBuy: rates.usdBuy,
      usdSell: rates.usdSell,
      eurBuy: rates.eurBuy,
      eurSell: rates.eurSell,
      gbpBuy: null,
      gbpSell: null,
      rubBuy: null,
      rubSell: null,
      tryBuy: rates.tryBuy,
      trySell: rates.trySell,
      date: new Date()
    });

    await newRate.save();
    console.log(`✅ [Bermeli] მონაცემები წარმატებით შეინახა ბაზაში! USD: ${newRate.usdBuy}/${newRate.usdSell}, EUR: ${newRate.eurBuy}/${newRate.eurSell}, TRY: ${newRate.tryBuy}/${newRate.trySell}`);
  } catch (error) {
    console.error('❌ [Bermeli] სკრეპინგის შეცდომა:', error.message);
  }
}

module.exports = fetchBermeliRates;
module.exports.parseBermeliRates = parseBermeliRates;
