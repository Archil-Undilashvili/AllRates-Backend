const axios = require('axios');
const Rate = require('../models/Rate');

async function fetchCrystalRates() {
  try {
    const url = "https://crystal.ge/api/wi/rate/v1/cryst?key=52ef35743f3c4f5027d82f051c258241";
    const { data: outer } = await axios.get(url);
    
    const inner = JSON.parse(outer.data);
    const rates = inner.data.CurrencyRate;

    const find = (iso) => rates.find(r => r.ISO === iso);

    const usd = find("USD");
    const eur = find("EUR");
    const gbp = find("GBP");
    const rub = find("RUB");

    const newRate = new Rate({
      company: 'Crystal',
      usdBuy: usd ? usd.AMOUNT_BUY : null,
      usdSell: usd ? usd.AMOUNT_SELL : null,
      eurBuy: eur ? eur.AMOUNT_BUY : null,
      eurSell: eur ? eur.AMOUNT_SELL : null,
      gbpBuy: gbp ? gbp.AMOUNT_BUY : null,
      gbpSell: gbp ? gbp.AMOUNT_SELL : null,
      rubBuy: rub ? rub.AMOUNT_BUY : null,
      rubSell: rub ? rub.AMOUNT_SELL : null,
      date: new Date()
    });

    await newRate.save();
    console.log(`✅ [Crystal] მონაცემები წარმატებით შეინახა ბაზაში! USD: ${newRate.usdBuy}/${newRate.usdSell}`);
  } catch (error) {
    console.error('❌ [Crystal] სკრეპინგის შეცდომა:', error.message);
  }
}

module.exports = fetchCrystalRates;
