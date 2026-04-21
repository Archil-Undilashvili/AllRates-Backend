const axios = require('axios');
const Rate = require('../models/Rate');

async function fetchRicoRates() {
  try {
    const { data: html } = await axios.get('https://www.rico.ge/');

    const getRate = (iso, type) => {
      // type is either 'from' (buy) or 'to' (sell)
      const regex = new RegExp(`id="${type}-${iso}-([\\d,\\.]+)"`);
      const match = html.match(regex);
      return match ? parseFloat(match[1].replace(',', '.')) : null;
    };

    const newRate = new Rate({
      company: 'Rico',
      usdBuy: getRate('USD', 'from'),
      usdSell: getRate('USD', 'to'),
      eurBuy: getRate('EUR', 'from'),
      eurSell: getRate('EUR', 'to'),
      gbpBuy: getRate('GBP', 'from'),
      gbpSell: getRate('GBP', 'to'),
      rubBuy: getRate('RUR', 'from'), // Rico uses RUR instead of RUB in ID
      rubSell: getRate('RUR', 'to'),
      tryBuy: getRate('TRY', 'from'),
      trySell: getRate('TRY', 'to'),
      date: new Date()
    });

    await newRate.save();
    console.log(`✅ [Rico] მონაცემები წარმატებით შეინახა ბაზაში! USD: ${newRate.usdBuy}/${newRate.usdSell}`);
  } catch (error) {
    console.error('❌ [Rico] სკრეპინგის შეცდომა:', error.message);
  }
}

module.exports = fetchRicoRates;
