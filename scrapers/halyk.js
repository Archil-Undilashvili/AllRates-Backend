const axios = require('axios');
const Rate = require('../models/Rate');

async function fetchHalykRates() {
  try {
    const url = "https://halykbank.ge/ka/individuals";
    const { data: html } = await axios.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
      }
    });

    const match = html.match(/window\.currencies\s*=\s*(\[[\s\S]*?\]);/);
    if (!match) {
      throw new Error("Halyk Bank - კურსების JSON (window.currencies) ვერ ვიპოვეთ.");
    }

    const rates = JSON.parse(match[1]);

    const usd = rates.find(c => c.title === "USD") || {};
    const eur = rates.find(c => c.title === "EUR") || {};
    const gbp = rates.find(c => c.title === "GBP") || {};
    const rub = rates.find(c => c.title === "RUB") || {};

    if (!usd.buy || !eur.buy) {
      throw new Error("Halyk Bank - USD ან EUR კურსები ვერ მოიძებნა.");
    }

    const newRate = new Rate({
      company: 'Halyk',
      usdBuy: usd.buy || null,
      usdSell: usd.sell || null,
      eurBuy: eur.buy || null,
      eurSell: eur.sell || null,
      gbpBuy: gbp.buy || null,
      gbpSell: gbp.sell || null,
      rubBuy: rub.buy || null,
      rubSell: rub.sell || null
    });

    await newRate.save();
    console.log(`✅ [Halyk Bank] მონაცემები წარმატებით შეინახა ბაზაში! USD: ${newRate.usdBuy}/${newRate.usdSell}`);
  } catch (error) {
    console.error('❌ [Halyk Bank] სკრეპინგის შეცდომა:', error.message);
  }
}

module.exports = fetchHalykRates;