const axios = require('axios');
const cheerio = require('cheerio');
const Rate = require('../models/Rate');

async function fetchCartuRates() {
  try {
    const url = "https://www.cartubank.ge";
    const { data: html } = await axios.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml"
      }
    });

    const $ = cheerio.load(html);
    const ratesData = { usd: {}, eur: {}, gbp: {}, rub: {} };

    // Look for rows in currency rates
    $('.currency-rates__row').each((i, el) => {
      const row = $(el);
      const textDivs = row.find('div');
      
      if (textDivs.length >= 3) {
        const currency = textDivs.eq(0).text().trim().toLowerCase();
        
        if (['usd', 'eur', 'gbp', 'rub'].includes(currency)) {
          ratesData[currency].buy = parseFloat(textDivs.eq(1).text().trim());
          ratesData[currency].sell = parseFloat(textDivs.eq(2).text().trim());
        }
      }
    });

    const usd = ratesData.usd;
    const eur = ratesData.eur;
    const gbp = ratesData.gbp;
    const rub = ratesData.rub;

    // Check if we found at least USD or EUR
    if (!usd.buy && !eur.buy) {
      throw new Error("Could not find Cartu rates. Format might have changed.");
    }

    const newRate = new Rate({
      company: 'CartuBank',
      usdBuy: usd.buy || null,
      usdSell: usd.sell || null,
      eurBuy: eur.buy || null,
      eurSell: eur.sell || null,
      gbpBuy: gbp.buy || null,
      gbpSell: gbp.sell || null,
      rubBuy: rub.buy || null,
      rubSell: rub.sell || null,
      date: new Date()
    });

    await newRate.save();
    console.log(`✅ [CartuBank] მონაცემები წარმატებით შეინახა ბაზაში! USD: ${newRate.usdBuy}/${newRate.usdSell}`);
  } catch (error) {
    console.error('❌ [CartuBank] სკრეპინგის შეცდომა:', error.message);
  }
}

module.exports = fetchCartuRates;
