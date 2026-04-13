const axios = require('axios');
const Rate = require('../models/Rate');

async function fetchInteliExpressRates() {
  try {
    const url = "http://ge.inteliexpress.net/_fragment?_path=default%3DLoading...%26_format%3Dhtml%26_locale%3Dge%26_controller%3DAppBundle%253AFrontend%255CMain%253AgetCurrency&_hash=0kkhjlQcYSXJcUwf5ZgqQxdPvXugZ9LjOjMyqSVjRtM%3D";
    const { data: html } = await axios.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Accept": "text/html"
      }
    });

    const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

    const getRate = (iso) => {
      const match = text.match(new RegExp(`GEL\\s+${iso}\\s+([\\d.]+)\\s+([\\d.]+)`));
      return match ? { buy: parseFloat(match[1]), sell: parseFloat(match[2]) } : null;
    };

    const usd = getRate("USD");
    const eur = getRate("EUR");
    const gbp = getRate("GBP");
    const rub = getRate("RUB");

    if (!usd || !eur) {
      throw new Error("Parsing InteliExpress failed. Raw text might have changed.");
    }

    const newRate = new Rate({
      company: 'Inteliexpress',
      usdBuy: usd.buy || null,
      usdSell: usd.sell || null,
      eurBuy: eur.buy || null,
      eurSell: eur.sell || null,
      gbpBuy: gbp ? gbp.buy : null,
      gbpSell: gbp ? gbp.sell : null,
      rubBuy: rub ? rub.buy : null,
      rubSell: rub ? rub.sell : null,
      date: new Date()
    });

    await newRate.save();
    console.log(`✅ [Inteliexpress] მონაცემები წარმატებით შეინახა ბაზაში! USD: ${newRate.usdBuy}/${newRate.usdSell}`);
  } catch (error) {
    console.error('❌ [Inteliexpress] სკრეპინგის შეცდომა:', error.message);
  }
}

module.exports = fetchInteliExpressRates;
