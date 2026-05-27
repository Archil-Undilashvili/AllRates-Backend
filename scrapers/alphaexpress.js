const axios = require('axios');
const cheerio = require('cheerio');
const Rate = require('../models/Rate');

const ALPHA_EXPRESS_URL = 'https://alphaexpress.ge/';

function parseNumber(value) {
  const parsed = parseFloat(String(value || '').replace(',', '.').trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function parseAlphaExpressRates(html) {
  const $ = cheerio.load(html);
  const exchange = $('#exchange-rate');

  return {
    usdBuy: parseNumber(exchange.find('.buy-USD').first().text()),
    usdSell: parseNumber(exchange.find('.Sell-USD').first().text()),
    eurBuy: parseNumber(exchange.find('.buy-EUR').first().text()),
    eurSell: parseNumber(exchange.find('.Sell-EUR').first().text())
  };
}

async function fetchAlphaExpressRates() {
  try {
    const { data: html } = await axios.get(ALPHA_EXPRESS_URL, {
      timeout: 20000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AllRates.ge scraper)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    });

    const rates = parseAlphaExpressRates(html);

    if (!rates.usdBuy && !rates.usdSell && !rates.eurBuy && !rates.eurSell) {
      throw new Error('Alpha Express HTML-ში USD/EUR კურსები ვერ მოიძებნა');
    }

    const newRate = new Rate({
      company: 'AlphaExpress',
      usdBuy: rates.usdBuy,
      usdSell: rates.usdSell,
      eurBuy: rates.eurBuy,
      eurSell: rates.eurSell,
      gbpBuy: null,
      gbpSell: null,
      rubBuy: null,
      rubSell: null,
      tryBuy: null,
      trySell: null,
      date: new Date()
    });

    await newRate.save();
    console.log(`✅ [AlphaExpress] მონაცემები წარმატებით შეინახა ბაზაში! USD: ${newRate.usdBuy}/${newRate.usdSell}, EUR: ${newRate.eurBuy}/${newRate.eurSell}`);
  } catch (error) {
    console.error('❌ [AlphaExpress] სკრეპინგის შეცდომა:', error.message);
  }
}

module.exports = fetchAlphaExpressRates;
module.exports.parseAlphaExpressRates = parseAlphaExpressRates;
