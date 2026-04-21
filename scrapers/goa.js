const axios = require('axios');
const cheerio = require('cheerio');
const Rate = require('../models/Rate');

async function fetchGoaRates() {
  try {
    const url = "https://goacredit.ge";
    const { data: html } = await axios.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "text/html"
      }
    });

    const $ = cheerio.load(html);
    
    let usd = { buy: null, sell: null };
    let eur = { buy: null, sell: null };
    let gbp = { buy: null, sell: null };
    let rub = { buy: null, sell: null };
    let tryCur = { buy: null, sell: null };

    // ვძებნით შესაბამის ვალუტებს HTML-ში
    $('td.currname').each((i, el) => {
      const currencyText = $(el).text().trim().toUpperCase();
      const buyText = $(el).next('td').text().trim();
      const sellText = $(el).next('td').next('td.paddcolumn').text().trim();

      const buy = parseFloat(buyText);
      const sell = parseFloat(sellText);

      if (currencyText === 'USD') usd = { buy, sell };
      if (currencyText === 'EUR') eur = { buy, sell };
      if (currencyText === 'GBP') gbp = { buy, sell };
      if (currencyText === 'RUB') rub = { buy: buy / 100, sell: sell / 100 };
      if (currencyText === 'TRY') tryCur = { buy, sell };
    });

    if (!usd.buy || !eur.buy) {
      throw new Error("Goa Credit - კურსები ვერ ვიპოვეთ, HTML სტრუქტურა ხომ არ შეიცვალა?");
    }

    const newRate = new Rate({
      company: 'Goa',
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
    });

    await newRate.save();
    console.log(`✅ [Goa] მონაცემები წარმატებით შეინახა ბაზაში! USD: ${newRate.usdBuy}/${newRate.usdSell}`);
  } catch (error) {
    console.error('❌ [Goa] სკრეპინგის შეცდომა:', error.message);
  }
}

module.exports = fetchGoaRates;