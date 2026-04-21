const axios = require('axios');
const cheerio = require('cheerio');
const Rate = require('../models/Rate');

async function fetchSilkRates() {
  try {
    const url = "https://silkbank.ge/en/currency/";
    const { data: html } = await axios.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
      }
    });

    const $ = cheerio.load(html);
    
    // Silk Bank-ის დეველოპერებს შეეშალათ და ყველა ვალუტის ID-ზე `price-buy-us-dollar` და `price-sell-us-dollar` უწერიათ
    // ამიტომ ID-ით ძებნა არასწორ შედეგს იძლევა (ყველა ერთნაირია).
    // მოგვიწევს index-ით ან card-ების მიხედვით ამოღება.
    
    const cards = $('.exchange-rates-card');
    
    let usd = { buy: null, sell: null };
    let eur = { buy: null, sell: null };
    let gbp = { buy: null, sell: null };
    
    cards.each((i, el) => {
      // ვეძებთ ვალუტის სახელს სურათის (img) ან text-ის მიხედვით
      const text = $(el).text().toLowerCase();
      
      const buy = parseFloat($(el).find('.buy-price-bank .price-bank-amount').text().trim());
      const sell = parseFloat($(el).find('.sell-price-bank .price-bank-amount').text().trim());
      
      if (text.includes('usd') || i === 0) {
        usd = { buy, sell };
      } else if (text.includes('eur') || i === 1) {
        eur = { buy, sell };
      } else if (text.includes('gbp') || i === 2) {
        gbp = { buy, sell };
      }
    });

    if (!usd.buy || !eur.buy) {
      throw new Error("Silk Bank - კურსები ვერ ვიპოვეთ, საიტის HTML სტრუქტურა შეიცვალა.");
    }

    const newRate = new Rate({
      company: 'Silk',
      usdBuy: usd.buy || null,
      usdSell: usd.sell || null,
      eurBuy: eur.buy || null,
      eurSell: eur.sell || null,
      gbpBuy: gbp.buy || null,
      gbpSell: gbp.sell || null,
      // RUB არ აქვთ
      rubBuy: null,
      rubSell: null
      tryBuy: null,
      trySell: null
    });

    await newRate.save();
    console.log(`✅ [Silk Bank] მონაცემები წარმატებით შეინახა ბაზაში! USD: ${newRate.usdBuy}/${newRate.usdSell}`);
  } catch (error) {
    console.error('❌ [Silk Bank] სკრეპინგის შეცდომა:', error.message);
  }
}

module.exports = fetchSilkRates;