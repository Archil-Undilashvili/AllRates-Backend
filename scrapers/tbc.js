const axios = require('axios');
const Rate = require('../models/Rate');

async function fetchTBCRates() {
  try {
    const url = "https://apigw.tbcbank.ge/api/v1/exchangeRates/commercialList?locale=ka-GE";
    const { data } = await axios.get(url);
    
    if (!data || !data.rates) {
      throw new Error("TBC API response format changed.");
    }

    const rates = data.rates;

    const find = (iso) => rates.find(r => r.iso === iso);

    const usd = find("USD");
    const eur = find("EUR");
    const gbp = find("GBP");
    const rub = find("RUB");
    const tryCur = find("TRY");

    if (!usd && !eur && !gbp && !rub) {
      throw new Error("No currencies found in TBC API");
    }

    const newRate = new Rate({
      company: 'TBC',
      usdBuy: usd ? usd.buyRate : null,
      usdSell: usd ? usd.sellRate : null,
      eurBuy: eur ? eur.buyRate : null,
      eurSell: eur ? eur.sellRate : null,
      gbpBuy: gbp ? gbp.buyRate : null,
      gbpSell: gbp ? gbp.sellRate : null,
      rubBuy: rub ? rub.buyRate : null,
      rubSell: rub ? rub.sellRate : null,
      tryBuy: tryCur ? tryCur.buyRate : null,
      trySell: tryCur ? tryCur.sellRate : null,
      date: new Date()
    });

    await newRate.save();
    console.log(`✅ [TBC] მონაცემები წარმატებით შეინახა ბაზაში! USD: ${newRate.usdBuy}/${newRate.usdSell}`);
    
  } catch (error) {
    console.error('❌ [TBC] სკრეპინგის შეცდომა:', error.message);
  }
}

module.exports = fetchTBCRates;
