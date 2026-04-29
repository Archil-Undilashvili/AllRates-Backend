const axios = require('axios');
const cheerio = require('cheerio');
const https = require('https');
const Rate = require('../models/Rate');

async function fetchLeaderRates() {
  try {
    const url = "https://leadercredit.ge";
    const agent = new https.Agent({  
      rejectUnauthorized: false
    });
    const { data: html } = await axios.get(url, {
      httpsAgent: agent,
      timeout: 30000,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
      }
    });

    const $ = cheerio.load(html);
    
    let usd = {}, eur = {}, gbp = {}, rub = {}, tryCur = {};

    $('tr').each((i, el) => {
      const tds = $(el).find('td');
      if (tds.length >= 4) {
        const currency = $(tds[1]).text().trim().toUpperCase();
        const buy = parseFloat($(tds[2]).text().trim());
        const sell = parseFloat($(tds[3]).text().trim());

        if (!isNaN(buy) && !isNaN(sell)) {
          if (currency === 'USD') usd = { buy, sell };
          if (currency === 'EUR') eur = { buy, sell };
          if (currency === 'GBP') gbp = { buy, sell };
          if (currency === 'RUB') rub = { buy, sell };
          if (currency === 'TRY') tryCur = { buy, sell };
        }
      }
    });

    if (!usd.buy && !eur.buy) {
      throw new Error("Leader Credit - USD ან EUR კურსები ვერ მოიძებნა.");
    }

    const newRate = new Rate({
      company: 'Leader Credit',
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
    console.log(`✅ [Leader Credit] მონაცემები წარმატებით შეინახა ბაზაში! USD: ${newRate.usdBuy}/${newRate.usdSell}`);
  } catch (error) {
    console.error('❌ [Leader Credit] სკრეპინგის შეცდომა:', error.message);
  }
}

module.exports = fetchLeaderRates;
