const axios = require('axios');
const cheerio = require('cheerio');

async function test() {
    const url = "https://www.procreditbank.ge/ge/exchange";
    const { data: html } = await axios.get(url, {
      timeout: 60000,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
      }
    });

    const $ = cheerio.load(html);
    
    let usd = {}, eur = {}, gbp = {}, rub = {}, tryCur = {};

    $('.clearfix').each((i, el) => {
      const imgSrc = $(el).find('.exchange-img img').attr('src') || '';
      const buyText = $(el).find('.exchange-buy').text().trim();
      const sellText = $(el).find('.exchange-sell').text().trim();
      
      console.log(`Found: imgSrc=${imgSrc}, buy=${buyText}, sell=${sellText}`);
      
      const buy = buyText ? parseFloat(buyText) : null;
      const sell = sellText ? parseFloat(sellText) : null;

      if (imgSrc.includes('-usa.png')) usd = { buy, sell };
      if (imgSrc.includes('-euro.png')) eur = { buy, sell };
      if (imgSrc.includes('-eng.png')) gbp = { buy, sell };
      if (imgSrc.includes('-rus.png')) rub = { buy, sell };
    });
    console.log("USD:", usd);
}
test();
