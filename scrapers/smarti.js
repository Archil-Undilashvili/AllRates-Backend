const axios = require('axios');
const cheerio = require('cheerio');
const Rate = require('../models/Rate');

const SMARTI_URL = 'http://smartfin.ge/index.php/ka/products-ka/currency-exchange-k';

function parseNumber(value) {
  const parsed = parseFloat(String(value || '').replace(',', '.').trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function parseSmartiRates(html) {
  const $ = cheerio.load(html);

  const readSide = (sideClass) => {
    const rates = {};

    $(`.${sideClass} .value-container`).each((_, element) => {
      const imgSrc = String($(element).find('img').attr('src') || '').toLowerCase();
      const value = parseNumber($(element).find('.value').first().text());

      if (!value) return;
      if (imgSrc.includes('/usd')) rates.usd = value;
      if (imgSrc.includes('/eur')) rates.eur = value;
    });

    return rates;
  };

  const buy = readSide('buy');
  const sell = readSide('sell');

  return {
    usdBuy: buy.usd || null,
    usdSell: sell.usd || null,
    eurBuy: buy.eur || null,
    eurSell: sell.eur || null
  };
}

async function fetchSmartiRates() {
  try {
    const { data: html } = await axios.get(SMARTI_URL, {
      timeout: 20000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AllRates.ge scraper)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    });

    const rates = parseSmartiRates(html);

    if (!rates.usdBuy && !rates.usdSell && !rates.eurBuy && !rates.eurSell) {
      throw new Error('Smarti HTML-ში USD/EUR კურსები ვერ მოიძებნა');
    }

    const newRate = new Rate({
      company: 'Smarti',
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
    console.log(`✅ [Smarti] მონაცემები წარმატებით შეინახა ბაზაში! USD: ${newRate.usdBuy}/${newRate.usdSell}, EUR: ${newRate.eurBuy}/${newRate.eurSell}`);
  } catch (error) {
    console.error('❌ [Smarti] სკრეპინგის შეცდომა:', error.message);
  }
}

module.exports = fetchSmartiRates;
module.exports.parseSmartiRates = parseSmartiRates;
