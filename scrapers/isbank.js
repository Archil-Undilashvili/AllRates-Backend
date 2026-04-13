const axios = require('axios');
const cheerio = require('cheerio');
const Rate = require('../models/Rate');

async function fetchIsBankRates() {
  try {
    const url = "http://isbank.ge/en/individual";
    const { data: html } = await axios.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
      }
    });

    const $ = cheerio.load(html);
    
    let usd = { buy: null, sell: null };
    let eur = { buy: null, sell: null };
    let gbp = { buy: null, sell: null };
    let rub = { buy: null, sell: null };

    // ყველა ვალუტის ბლოკი
    // ვპოულობთ .bank-values მშობლებს, რომლებშიც წერია ვალუტის სახელი
    $('.bank-values').each((i, el) => {
      const parentText = $(el).parent().parent().parent().text().replace(/\s+/g, ' ').trim().toLowerCase();
      const val = parseFloat($(el).text().trim());

      if (parentText.includes('usd')) {
        if (i % 2 === 0) usd.buy = val;
        else usd.sell = val;
      }
      if (parentText.includes('eur')) {
        // რადგან HTML-ში ერთ ბლოკშია ყიდვა და გაყიდვა, პირველი არის ყიდვა, მეორე გაყიდვა
        if (!eur.buy) eur.buy = val;
        else if (!eur.sell) eur.sell = val;
      }
      if (parentText.includes('gbp')) {
        if (!gbp.buy) gbp.buy = val;
        else if (!gbp.sell) gbp.sell = val;
      }
      if (parentText.includes('rub')) {
        if (!rub.buy) rub.buy = val;
        else if (!rub.sell) rub.sell = val;
      }
    });

    // თუ რაიმე შეიცვალა და ვეღარ ვიპოვეთ, fallback ავიღოთ შენი ძველი ლოგიკით (ინდექსებით)
    if (!usd.buy || !eur.buy) {
      const matches = [...html.matchAll(/bank-values">([\d.]+)</g)].map(m => parseFloat(m[1]));
      if (matches.length >= 8) {
        usd.buy = matches[0];
        usd.sell = matches[1];
        gbp.buy = matches[4];
        gbp.sell = matches[5];
        eur.buy = matches[6];
        eur.sell = matches[7];
      } else {
        throw new Error("Is Bank - ვერც სახელით ვიპოვეთ და ვერც ინდექსებით.");
      }
    }

    const newRate = new Rate({
      company: 'IsBank',
      usdBuy: usd.buy || null,
      usdSell: usd.sell || null,
      eurBuy: eur.buy || null,
      eurSell: eur.sell || null,
      gbpBuy: gbp.buy || null,
      gbpSell: gbp.sell || null,
      rubBuy: rub.buy || null,
      rubSell: rub.sell || null
    });

    await newRate.save();
    console.log(`✅ [Is Bank] მონაცემები წარმატებით შეინახა ბაზაში! USD: ${newRate.usdBuy}/${newRate.usdSell}`);
  } catch (error) {
    console.error('❌ [Is Bank] სკრეპინგის შეცდომა:', error.message);
  }
}

module.exports = fetchIsBankRates;