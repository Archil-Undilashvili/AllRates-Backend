const axios = require('axios');
const cheerio = require('cheerio');
const Rate = require('../models/Rate');

const SCAPP_URL = 'https://scapp.ge/ka/currency';

function parseNumber(value) {
  const parsed = parseFloat(String(value || '').replace(',', '.').trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function parseScappRates(html) {
  const $ = cheerio.load(html);
  const rows = {};

  $('#block-currency_table-90 table tr').each((_, row) => {
    const label = $(row).find('td').first().text().replace(/\s+/g, ' ').trim().toUpperCase();
    const match = label.match(/(\d+(?:\.\d+)?)\s+(USD|EUR|GBP|RUB|TRY)/);
    if (!match) return;

    const multiplier = parseNumber(match[1]) || 1;
    const currency = match[2].toLowerCase();
    const values = $(row)
      .find('td')
      .slice(1)
      .map((__, cell) => parseNumber($(cell).text()))
      .get();
    const [buy, sell] = values.filter(value => value !== null);

    rows[currency] = {
      buy: buy === null || buy === undefined ? null : buy / multiplier,
      sell: sell === null || sell === undefined ? null : sell / multiplier
    };
  });

  return {
    usdBuy: rows.usd?.buy || null,
    usdSell: rows.usd?.sell || null,
    eurBuy: rows.eur?.buy || null,
    eurSell: rows.eur?.sell || null,
    gbpBuy: rows.gbp?.buy || null,
    gbpSell: rows.gbp?.sell || null,
    rubBuy: rows.rub?.buy || null,
    rubSell: rows.rub?.sell || null,
    tryBuy: rows.try?.buy || null,
    trySell: rows.try?.sell || null
  };
}

async function fetchScappRates() {
  try {
    const { data: html } = await axios.get(SCAPP_URL, {
      timeout: 20000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AllRates.ge scraper)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    });

    const rates = parseScappRates(html);

    if (!rates.usdBuy && !rates.eurBuy && !rates.gbpBuy && !rates.rubBuy && !rates.tryBuy) {
      throw new Error('Scapp HTML-ში ვალუტის კურსები ვერ მოიძებნა');
    }

    const newRate = new Rate({
      company: 'Scapp',
      ...rates,
      date: new Date()
    });

    await newRate.save();
    console.log(`✅ [Scapp] მონაცემები წარმატებით შეინახა ბაზაში! USD: ${newRate.usdBuy}/${newRate.usdSell}, EUR: ${newRate.eurBuy}/${newRate.eurSell}`);
  } catch (error) {
    console.error('❌ [Scapp] სკრეპინგის შეცდომა:', error.message);
  }
}

module.exports = fetchScappRates;
module.exports.parseScappRates = parseScappRates;
