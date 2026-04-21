const axios = require('axios');
const Rate = require('../models/Rate');

async function fetchMBCRates() {
  try {
    const url = "https://fxrates.mbc.com.ge:8022/api/fxrates/mbc/commercial";
    const { data } = await axios.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "application/json"
      }
    });

    const rates = data.FXRates;
    
    if (!rates || !Array.isArray(rates) || rates.length === 0) {
      throw new Error("API-დან მონაცემები არ წამოვიდა ან ფორმატი შეიცვალა");
    }

    // ვეძებთ შესაბამის ვალუტებს
    const usd = rates.find(r => r.FromCcy === "USD" && r.ToCcy === "GEL") || {};
    const eur = rates.find(r => r.FromCcy === "EUR" && r.ToCcy === "GEL") || {};
    const gbp = rates.find(r => r.FromCcy === "GBP" && r.ToCcy === "GEL") || {};
    const rub = rates.find(r => r.FromCcy === "RUB" && r.ToCcy === "GEL") || {};
    const tryCur = rates.find(r => r.FromCcy === "tryCur" && r.ToCcy === "GEL") || {};

    const newRate = new Rate({
      company: 'MBC',
      usdBuy: usd.Buy || null,
      usdSell: usd.Sell || null,
      eurBuy: eur.Buy || null,
      eurSell: eur.Sell || null,
      gbpBuy: gbp.Buy || null,
      gbpSell: gbp.Sell || null,
      rubBuy: rub.Buy || null,
      rubSell: rub.Sell || null
      tryBuy: tryCur.Buy || null,
      trySell: tryCur.Sell || null
    });

    await newRate.save();
    console.log(`✅ [MBC] მონაცემები წარმატებით შეინახა ბაზაში! USD: ${newRate.usdBuy}/${newRate.usdSell}`);
  } catch (error) {
    console.error('❌ [MBC] სკრეპინგის შეცდომა:', error.message);
  }
}

module.exports = fetchMBCRates;