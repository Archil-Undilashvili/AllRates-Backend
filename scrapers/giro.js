const axios = require('axios');
const cheerio = require('cheerio');
const Rate = require('../models/Rate');

async function fetchGiroRates() {
  try {
    // We don't need a proxy from our Node.js server!
    const { data: html } = await axios.get('https://girocredit.ge/');
    const $ = cheerio.load(html);

    const getRate = (currencyClass) => {
      const row = $(`tr.${currencyClass}`);
      if (!row.length) return { buy: null, sell: null };
      
      const buyText = row.find('.buy_price').text().trim();
      const sellText = row.find('.sell_price').text().trim();
      
      return {
        buy: buyText ? parseFloat(buyText) : null,
        sell: sellText ? parseFloat(sellText) : null
      };
    };

    const usd = getRate('USD');
    const eur = getRate('EUR');
    const gbp = getRate('GBP');
    let rub = getRate('RUB');

    // Giro displays RUB per 100 units (e.g. 3.38). We divide by 100 to match others (0.0338).
    if (rub.buy && rub.buy > 1) {
       rub.buy = rub.buy / 100;
       rub.sell = rub.sell / 100;
    }

    const newRate = new Rate({
      company: 'Giro',
      usdBuy: usd.buy,
      usdSell: usd.sell,
      eurBuy: eur.buy,
      eurSell: eur.sell,
      gbpBuy: gbp.buy,
      gbpSell: gbp.sell,
      rubBuy: rub.buy,
      rubSell: rub.sell,
      date: new Date()
    });

    await newRate.save();
    console.log(`✅ [Giro] მონაცემები წარმატებით შეინახა ბაზაში! USD: ${newRate.usdBuy}/${newRate.usdSell}`);
  } catch (error) {
    console.error('❌ [Giro] სკრეპინგის შეცდომა:', error.message);
  }
}

module.exports = fetchGiroRates;
