const axios = require('axios');
const cheerio = require('cheerio');
const Rate = require('../models/Rate');

async function fetchLibertyRates() {
  try {
    const { data: html } = await axios.get('https://libertybank.ge/ka/');
    const $ = cheerio.load(html);

    const ratesData = {
      Commercial: { usd: {}, eur: {}, gbp: {}, rub: {} },
      Internet: { usd: {}, eur: {}, gbp: {}, rub: {} }
    };

    $('.currency-rates__row.js-homepage__currency-item').each((i, el) => {
      const row = $(el);
      const currencyLabel = row.find('.caps.medium').text().trim().toLowerCase();
      
      // If it's not one of our target currencies, skip
      if (!['usd', 'eur', 'gbp', 'rub'].includes(currencyLabel)) return;

      // The items are:
      // eq(0): NBG Rate details
      // eq(1): Commercial Rate (Buy / Sell)
      // eq(2): Internet Bank Rate (Buy / Sell)
      const items = row.find('.currency-rates__item');

      // Commercial
      const commBuy = parseFloat(items.eq(1).find('.currency-rates__currency').eq(0).text().trim());
      const commSell = parseFloat(items.eq(1).find('.currency-rates__currency').eq(1).text().trim());
      
      // Internet
      const intBuy = parseFloat(items.eq(2).find('.currency-rates__currency').eq(0).text().trim());
      const intSell = parseFloat(items.eq(2).find('.currency-rates__currency').eq(1).text().trim());

      // If it's RUB, Liberty shows it per 100 units ("100 RUB"), so divide by 100
      const isRub = currencyLabel === 'rub';
      
      ratesData.Commercial[currencyLabel] = {
        buy: isRub && !isNaN(commBuy) ? commBuy / 100 : commBuy,
        sell: isRub && !isNaN(commSell) ? commSell / 100 : commSell
      };

      ratesData.Internet[currencyLabel] = {
        buy: isRub && !isNaN(intBuy) ? intBuy / 100 : intBuy,
        sell: isRub && !isNaN(intSell) ? intSell / 100 : intSell
      };
    });

    // Save Commercial Rates
    const newCommRate = new Rate({
      company: 'Liberty (კომერციული)',
      usdBuy: ratesData.Commercial.usd.buy || null,
      usdSell: ratesData.Commercial.usd.sell || null,
      eurBuy: ratesData.Commercial.eur.buy || null,
      eurSell: ratesData.Commercial.eur.sell || null,
      gbpBuy: ratesData.Commercial.gbp.buy || null,
      gbpSell: ratesData.Commercial.gbp.sell || null,
      rubBuy: ratesData.Commercial.rub.buy || null,
      rubSell: ratesData.Commercial.rub.sell || null,
      tryBuy: ratesData.Commercial.try.buy || null,
      trySell: ratesData.Commercial.try.sell || null,
      date: new Date()
    });
    await newCommRate.save();
    console.log(`✅ [Liberty] მონაცემები შეინახა: Liberty (კომერციული) | USD: ${newCommRate.usdBuy}/${newCommRate.usdSell}`);

    // Save Internet Rates
    const newIntRate = new Rate({
      company: 'Liberty (ინტერნეტ ბანკი)',
      usdBuy: ratesData.Internet.usd.buy || null,
      usdSell: ratesData.Internet.usd.sell || null,
      eurBuy: ratesData.Internet.eur.buy || null,
      eurSell: ratesData.Internet.eur.sell || null,
      gbpBuy: ratesData.Internet.gbp.buy || null,
      gbpSell: ratesData.Internet.gbp.sell || null,
      rubBuy: ratesData.Internet.rub.buy || null,
      rubSell: ratesData.Internet.rub.sell || null,
      tryBuy: ratesData.Internet.try.buy || null,
      trySell: ratesData.Internet.try.sell || null,
      date: new Date()
    });
    await newIntRate.save();
    console.log(`✅ [Liberty] მონაცემები შეინახა: Liberty (ინტერნეტ ბანკი) | USD: ${newIntRate.usdBuy}/${newIntRate.usdSell}`);

  } catch (error) {
    console.error('❌ [Liberty] სკრეპინგის შეცდომა:', error.message);
  }
}

module.exports = fetchLibertyRates;
