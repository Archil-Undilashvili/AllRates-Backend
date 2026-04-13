const axios = require('axios');
const Rate = require('../models/Rate');

async function fetchKursiRates() {
  try {
    const url = "https://api.kursi.ge:8080/api/public/currencies";
    const { data } = await axios.get(url);

    const find = (base, secondary) => 
      data.find(r => r.baseCurrencyCode === base && r.secondaryCurrencyCode === secondary);

    const usd = find("GEL", "USD");
    const eur = find("GEL", "EUR");
    const gbp = find("GEL", "GBP"); // Kursige API doesn't seem to have GBP based on initial check, but we add it safely
    const rub = find("GEL", "RUB");

    const newRate = new Rate({
      company: 'Kursige',
      usdBuy: usd ? usd.buyRate : null,
      usdSell: usd ? usd.sellRate : null,
      eurBuy: eur ? eur.buyRate : null,
      eurSell: eur ? eur.sellRate : null,
      gbpBuy: gbp ? gbp.buyRate : null,
      gbpSell: gbp ? gbp.sellRate : null,
      rubBuy: rub ? rub.buyRate : null,
      rubSell: rub ? rub.sellRate : null,
      date: new Date()
    });

    await newRate.save();
    console.log(`✅ [Kursige] მონაცემები წარმატებით შეინახა ბაზაში! USD: ${newRate.usdBuy}/${newRate.usdSell}`);
  } catch (error) {
    console.error('❌ [Kursige] სკრეპინგის შეცდომა:', error.message);
  }
}

module.exports = fetchKursiRates;
