const axios = require('axios');
const Rate = require('../models/Rate');

async function fetchValutoRates() {
  try {
    const url = "https://valuto.ge/wp-json/rest-currency-list/v3/currencies";
    const { data } = await axios.get(url);
    const currencies = data.data.currencies;

    const usd = currencies["USDGEL"];
    const eur = currencies["EURGEL"];
    const gbp = currencies["GBPGEL"];
    // Valuto API uses 'RURGEL' instead of RUBGEL
    const rub = currencies["RURGEL"];

    const newRate = new Rate({
      company: 'Valuto',
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
    console.log(`✅ [Valuto] მონაცემები წარმატებით შეინახა ბაზაში! USD: ${newRate.usdBuy}/${newRate.usdSell}`);
  } catch (error) {
    console.error('❌ [Valuto] სკრეპინგის შეცდომა:', error.message);
  }
}

module.exports = fetchValutoRates;
