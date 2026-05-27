const axios = require('axios');
const cheerio = require('cheerio');
const Rate = require('../models/Rate');

const GEORGIAN_CREDIT_URL = 'https://www.georgiancredit.ge/';

function parseNumber(value) {
  const parsed = parseFloat(String(value || '').replace(',', '.').trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function parseGeorgianCreditRates(html) {
  const $ = cheerio.load(html);
  const result = {
    usdBuy: null,
    usdSell: null,
    eurBuy: null,
    eurSell: null
  };

  $('.calc_title').each((_, title) => {
    const titleText = $(title).text().trim();
    if (!titleText.includes('კომერციული')) return;

    const container = $(title).nextAll('.curr_content').first();
    container.find('.curr_title').each((__, currencyNode) => {
      const currency = $(currencyNode).text().trim().toUpperCase();
      const buy = parseNumber($(currencyNode).nextAll('.curr_rate').eq(0).text());
      const sell = parseNumber($(currencyNode).nextAll('.curr_rate').eq(1).text());

      if (currency === 'USD') {
        result.usdBuy = buy;
        result.usdSell = sell;
      }
      if (currency === 'EUR') {
        result.eurBuy = buy;
        result.eurSell = sell;
      }
    });
  });

  return result;
}

async function fetchGeorgianCreditRates() {
  try {
    const { data: html } = await axios.get(GEORGIAN_CREDIT_URL, {
      timeout: 20000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AllRates.ge scraper)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    });

    const rates = parseGeorgianCreditRates(html);

    if (!rates.usdBuy && !rates.usdSell && !rates.eurBuy && !rates.eurSell) {
      throw new Error('Georgian Credit HTML-ში USD/EUR კომერციული კურსები ვერ მოიძებნა');
    }

    const newRate = new Rate({
      company: 'GeorgianCredit',
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
    console.log(`✅ [GeorgianCredit] მონაცემები წარმატებით შეინახა ბაზაში! USD: ${newRate.usdBuy}/${newRate.usdSell}, EUR: ${newRate.eurBuy}/${newRate.eurSell}`);
  } catch (error) {
    console.error('❌ [GeorgianCredit] სკრეპინგის შეცდომა:', error.message);
  }
}

module.exports = fetchGeorgianCreditRates;
module.exports.parseGeorgianCreditRates = parseGeorgianCreditRates;
