const axios = require('axios');
const Rate = require('../models/Rate');

async function fetchTerabankRates() {
  try {
    const url = "https://terabank.ge/_mvcapi/CurrencyRatesApi/GetTeraCrossRates";
    
    // ვაგზავნით POST მოთხოვნას ტერაბანკის API-ზე
    const { data: responseData } = await axios.post(url, {}, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Referer": "https://terabank.ge/en/retail/exchangerates",
        "X-Requested-With": "XMLHttpRequest"
      }
    });

    if (!responseData.succeeded || !responseData.data) {
      throw new Error("Terabank - API-დან მოვიდა არასწორი სტრუქტურა");
    }

    const rates = responseData.data;

    const usd = rates.find(r => r.iso === "USD") || {};
    const eur = rates.find(r => r.iso === "EUR") || {};
    const gbp = rates.find(r => r.iso === "GBP") || {};
    const rub = rates.find(r => r.iso === "RUB") || {};
    const tryCur = rates.find(r => r.iso === "TRY") || {};

    if (!usd.teraCrossRateBuy || !eur.teraCrossRateBuy) {
      throw new Error("Terabank - USD ან EUR კურსები არ მოიძებნა API-ში");
    }

    const newRate = new Rate({
      company: 'Terabank',
      usdBuy: usd.teraCrossRateBuy || null,
      usdSell: usd.teraCrossRateSell || null,
      eurBuy: eur.teraCrossRateBuy || null,
      eurSell: eur.teraCrossRateSell || null,
      gbpBuy: gbp.teraCrossRateBuy || null,
      gbpSell: gbp.teraCrossRateSell || null,
      rubBuy: rub.teraCrossRateBuy || null,
      rubSell: rub.teraCrossRateSell || null,
      tryBuy: tryCur.teraCrossRateBuy || null,
      trySell: tryCur.teraCrossRateSell || null
    });

    await newRate.save();
    console.log(`✅ [Terabank] მონაცემები წარმატებით შეინახა ბაზაში! USD: ${newRate.usdBuy}/${newRate.usdSell}`);
  } catch (error) {
    console.error('❌ [Terabank] სკრეპინგის შეცდომა:', error.message);
  }
}

module.exports = fetchTerabankRates;