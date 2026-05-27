const axios = require('axios');
const cheerio = require('cheerio');
const Rate = require('../models/Rate');

const TBMC_URL = 'https://www.tbmc.ge/en/cven-shesaxeb/saqmianoba';

function parseNumber(value) {
  const parsed = parseFloat(String(value || '').replace(',', '.').trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function parseTbmcRates(html) {
  const $ = cheerio.load(html);
  const result = {
    usdBuy: null,
    usdSell: null,
    eurBuy: null,
    eurSell: null
  };

  $('.sidebar_module').each((_, module) => {
    const heading = $(module).find('.sidebar_module_heading').first().text().trim();
    if (!heading.includes('ვალუტის კურსი')) return;

    $(module).find('p').each((__, row) => {
      const text = $(row).text().replace(/\s+/g, ' ').trim().toUpperCase();
      const values = $(row).find('span[style*="color"]').map((___, el) => parseNumber($(el).text())).get();
      const [buy, sell] = values.filter(value => value !== null);

      if (text.includes('USD')) {
        result.usdBuy = buy || null;
        result.usdSell = sell || null;
      }
      if (text.includes('EUR')) {
        result.eurBuy = buy || null;
        result.eurSell = sell || null;
      }
    });
  });

  return result;
}

async function fetchTbmcRates() {
  try {
    const { data: html } = await axios.get(TBMC_URL, {
      timeout: 20000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AllRates.ge scraper)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    });

    const rates = parseTbmcRates(html);

    if (!rates.usdBuy && !rates.usdSell && !rates.eurBuy && !rates.eurSell) {
      throw new Error('TBMC HTML-ში USD/EUR კურსები ვერ მოიძებნა');
    }

    const newRate = new Rate({
      company: 'TBMC',
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
    console.log(`✅ [TBMC] მონაცემები წარმატებით შეინახა ბაზაში! USD: ${newRate.usdBuy}/${newRate.usdSell}, EUR: ${newRate.eurBuy}/${newRate.eurSell}`);
  } catch (error) {
    console.error('❌ [TBMC] სკრეპინგის შეცდომა:', error.message);
  }
}

module.exports = fetchTbmcRates;
module.exports.parseTbmcRates = parseTbmcRates;
