const axios = require('axios');
const cheerio = require('cheerio');
const Rate = require('../models/Rate');

const RICO_URL = 'https://rico.ge/';

function parseNumber(value) {
  const parsed = parseFloat(String(value || '').replace(',', '.').trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeCode(code) {
  const value = String(code || '').trim().toUpperCase();
  return value === 'RUR' ? 'RUB' : value;
}

function toRateFields(rows) {
  return {
    usdBuy: rows.USD?.buy ?? null,
    usdSell: rows.USD?.sell ?? null,
    eurBuy: rows.EUR?.buy ?? null,
    eurSell: rows.EUR?.sell ?? null,
    gbpBuy: rows.GBP?.buy ?? null,
    gbpSell: rows.GBP?.sell ?? null,
    rubBuy: rows.RUB?.buy ?? null,
    rubSell: rows.RUB?.sell ?? null,
    tryBuy: rows.TRY?.buy ?? null,
    trySell: rows.TRY?.sell ?? null
  };
}

function parseFromCalculatorConfig($) {
  const configText = $('script[data-currency-calculator-config]').first().contents().text().trim();
  if (!configText) return null;

  const config = JSON.parse(configText);
  if (!Array.isArray(config.rates)) return null;

  const rows = {};
  config.rates.forEach(rate => {
    const code = normalizeCode(rate.code || rate.label);
    if (!['USD', 'EUR', 'GBP', 'RUB', 'TRY'].includes(code)) return;

    rows[code] = {
      buy: parseNumber(rate.buy),
      sell: parseNumber(rate.sell)
    };
  });

  return toRateFields(rows);
}

function parseFromVisibleTable($) {
  const rows = {};

  $('.currency-row').each((_, row) => {
    const code = normalizeCode($(row).find('.currency-info strong').first().text());
    if (!['USD', 'EUR', 'GBP', 'RUB', 'TRY'].includes(code)) return;

    const unit = parseNumber($(row).find('.currency-unit strong').first().text()) || 1;
    const values = $(row)
      .find('.currency-rate strong')
      .map((__, cell) => parseNumber($(cell).text()))
      .get()
      .filter(value => value !== null);
    const [buy, sell] = values;

    rows[code] = {
      buy: buy === undefined ? null : buy / unit,
      sell: sell === undefined ? null : sell / unit
    };
  });

  return toRateFields(rows);
}

function parseRicoRates(html) {
  const $ = cheerio.load(html);

  let rates = null;
  try {
    rates = parseFromCalculatorConfig($);
  } catch (error) {
    rates = null;
  }

  if (!rates || !rates.usdBuy) {
    rates = parseFromVisibleTable($);
  }

  return rates || toRateFields({});
}

async function fetchRicoRates() {
  try {
    const { data: html } = await axios.get(RICO_URL, {
      timeout: 20000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AllRates.ge scraper)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    });

    const rates = parseRicoRates(html);

    if (!rates.usdBuy && !rates.eurBuy && !rates.gbpBuy && !rates.rubBuy && !rates.tryBuy) {
      throw new Error('Rico HTML-ში ვალუტის კურსები ვერ მოიძებნა');
    }

    const newRate = new Rate({
      company: 'Rico',
      ...rates,
      date: new Date()
    });

    await newRate.save();
    console.log(`✅ [Rico] მონაცემები წარმატებით შეინახა ბაზაში! USD: ${newRate.usdBuy}/${newRate.usdSell}, EUR: ${newRate.eurBuy}/${newRate.eurSell}`);
  } catch (error) {
    console.error('❌ [Rico] სკრეპინგის შეცდომა:', error.message);
  }
}

module.exports = fetchRicoRates;
module.exports.parseRicoRates = parseRicoRates;
