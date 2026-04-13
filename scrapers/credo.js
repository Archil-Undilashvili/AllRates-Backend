const axios = require('axios');
const Rate = require('../models/Rate');

async function fetchCredoRates() {
  const methods = [
    { method: "FxRatesCommercial", label: "კომერციული" },
    { method: "FxRatesForTransfer", label: "გზავნილები" },
    { method: "FxRatesForCard", label: "საბარათე" },
    { method: "FXRatesCardTransactions", label: "საბარათე ოპერაციები" }
  ];

  for (const item of methods) {
    try {
      const dateStr = new Date().toISOString();
      const url = `https://n1.noxtton.com/v2/credo/current-rates?method=${item.method}&date=${dateStr}`;
      
      const { data } = await axios.get(url, {
        headers: {
          "x-api-key": "1caf66f7cb78b05b448629ba93c0c93eefd0d03b6876cf0f",
          "Origin": "https://credobank.ge",
          "Referer": "https://credobank.ge/",
          "Accept": "application/json, text/plain, */*",
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36"
        }
      });

      if (!data || !data.success || !data.rates) {
        throw new Error(`Invalid response for ${item.method}`);
      }

      const rates = data.rates;
      const find = (ccy) => rates.find(r => r.fromCcy === ccy);

      const usd = find("USD");
      const eur = find("EUR");
      const gbp = find("GBP");
      const rub = find("RUB");

      const companyName = `Credo (${item.label})`;

      const newRate = new Rate({
        company: companyName,
        usdBuy: usd ? usd.buy : null,
        usdSell: usd ? usd.sell : null,
        eurBuy: eur ? eur.buy : null,
        eurSell: eur ? eur.sell : null,
        gbpBuy: gbp ? gbp.buy : null,
        gbpSell: gbp ? gbp.sell : null,
        rubBuy: rub ? rub.buy : null,
        rubSell: rub ? rub.sell : null,
        date: new Date()
      });

      await newRate.save();
      console.log(`✅ [Credo] მონაცემები შეინახა: ${companyName} | USD: ${newRate.usdBuy}/${newRate.usdSell}`);
    } catch (error) {
      console.error(`❌ [Credo] სკრეპინგის შეცდომა (${item.label}):`, error.message);
    }
  }
}

module.exports = fetchCredoRates;
