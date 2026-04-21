const axios = require('axios');
const Rate = require('../models/Rate');

async function fetchHashRates() {
  try {
    const url = "https://api.hashbank.ge/landing-api/api/v1/currency-rates";
    const { data } = await axios.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "application/json"
      }
    });

    const rates = data.crossRates;

    if (!rates || !Array.isArray(rates)) {
      throw new Error("Hash Bank - API-დან არასწორი ფორმატი დაბრუნდა.");
    }

    const usd = rates.find(r => r.fromCurrency === "USD" && r.toCurrency === "GEL") || {};
    const eur = rates.find(r => r.fromCurrency === "EUR" && r.toCurrency === "GEL") || {};
    const gbp = rates.find(r => r.fromCurrency === "GBP" && r.toCurrency === "GEL") || {};
    const rub = rates.find(r => r.fromCurrency === "RUB" && r.toCurrency === "GEL") || {};
    const tryCur = rates.find(r => r.fromCurrency === "tryCur" && r.toCurrency === "GEL") || {};

    // თუ USD ან EUR არ არის, ე.ი. რაღაც შეიცვალა
    if (!usd.buy || !eur.buy) {
      throw new Error("Hash Bank - USD ან EUR კურსები არ მოიძებნა.");
    }

    const newRate = new Rate({
      company: 'HashBank',
      usdBuy: usd.buy || null,
      usdSell: usd.sell || null,
      eurBuy: eur.buy || null,
      eurSell: eur.sell || null,
      gbpBuy: gbp.buy || null,
      gbpSell: gbp.sell || null,
      rubBuy: rub.buy || null,
      rubSell: rub.sell || null,
      tryBuy: tryCur.buy || null,
      trySell: tryCur.sell || null
    });

    await newRate.save();
    console.log(`✅ [Hash Bank] მონაცემები წარმატებით შეინახა ბაზაში! USD: ${newRate.usdBuy}/${newRate.usdSell}`);
  } catch (error) {
    console.error('❌ [Hash Bank] სკრეპინგის შეცდომა:', error.message);
  }
}

module.exports = fetchHashRates;