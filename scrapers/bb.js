const axios = require('axios');
const Rate = require('../models/Rate');

async function fetchBBRates() {
  try {
    const { data: html } = await axios.get('https://bb.ge/ge/currencies');
    
    // We can extract kursBuy and kursSell directly using regex
    const buyMatch = html.match(/kursBuy\\":({[^}]*})/);
    const sellMatch = html.match(/kursSell\\":({[^}]*})/);

    if (!buyMatch || !sellMatch) {
      throw new Error("BasisBank API data format changed or not found.");
    }

    const buyData = JSON.parse(buyMatch[1].replace(/\\"/g, '"'));
    const sellData = JSON.parse(sellMatch[1].replace(/\\"/g, '"'));

    const getRate = (obj, currency) => {
      // API uses RUR instead of RUB
      if (currency === 'RUB') currency = 'RUR';
      return obj[currency] ? parseFloat(obj[currency]) : null;
    };

    const newRate = new Rate({
      company: 'BasisBank',
      usdBuy: getRate(buyData, 'USD'),
      usdSell: getRate(sellData, 'USD'),
      eurBuy: getRate(buyData, 'EUR'),
      eurSell: getRate(sellData, 'EUR'),
      gbpBuy: getRate(buyData, 'GBP'),
      gbpSell: getRate(sellData, 'GBP'),
      rubBuy: getRate(buyData, 'RUB'),
      rubSell: getRate(sellData, 'RUB'),
      date: new Date()
    });

    await newRate.save();
    console.log(`✅ [BasisBank] მონაცემები წარმატებით შეინახა ბაზაში! USD: ${newRate.usdBuy}/${newRate.usdSell}`);
  } catch (error) {
    console.error('❌ [BasisBank] სკრეპინგის შეცდომა:', error.message);
  }
}

module.exports = fetchBBRates;
