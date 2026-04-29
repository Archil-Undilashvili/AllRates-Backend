const axios = require('axios');
const cheerio = require('cheerio');
const Rate = require('../models/Rate');

async function fetchProcreditRates() {
  try {
    const url = "https://www.procreditbank.ge/ge/exchange";
    const { data: html } = await axios.get(url, {
      timeout: 60000,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8"
      }
    });

    const $ = cheerio.load(html);
    
    let usd = {}, eur = {}, gbp = {}, rub = {}, tryCur = {};

    $('.clearfix').each((i, el) => {
      const imgSrc = $(el).find('.exchange-img img').attr('src') || '';
      const buyText = $(el).find('.exchange-buy').text().trim();
      const sellText = $(el).find('.exchange-sell').text().trim();
      
      const buy = buyText ? parseFloat(buyText) : null;
      const sell = sellText ? parseFloat(sellText) : null;

      // Only set if we actually parsed a number
      if (buy && sell) {
        if (imgSrc.includes('-usa.png')) usd = { buy, sell };
        if (imgSrc.includes('-euro.png')) eur = { buy, sell };
        if (imgSrc.includes('-eng.png')) gbp = { buy, sell };
        if (imgSrc.includes('-rus.png')) rub = { buy, sell };
      }
    });

    if (!usd.buy || !eur.buy) {
      throw new Error("Procredit Bank - USD ან EUR კურსები ვერ მოიძებნა.");
    }

    const newRate = new Rate({
      company: 'ProCredit',
      usdBuy: usd.buy || null,
      usdSell: usd.sell || null,
      eurBuy: eur.buy || null,
      eurSell: eur.sell || null,
      gbpBuy: gbp.buy || null,
      gbpSell: gbp.sell || null,
      rubBuy: rub.buy || null,
      rubSell: rub.sell || null,
      tryBuy: tryCur.buy || null,
      trySell: tryCur.sell || null
    });

    await newRate.save();
    console.log(`✅ [ProCredit Bank] მონაცემები წარმატებით შეინახა ბაზაში! USD: ${newRate.usdBuy}/${newRate.usdSell}`);
  } catch (error) {
    console.error('❌ [ProCredit Bank] სკრეპინგის შეცდომა:', error.message);
  }
}

module.exports = fetchProcreditRates;
