const axios = require('axios');
const Rate = require('../models/Rate');

async function fetchBOGRates() {
  try {
    const url = "https://bankofgeorgia.ge/api/currencies/page/pages/64ba400e3a4fec320092de07";
    const { data } = await axios.get(url);
    
    if (!data || !data.data || !data.data.tabs) {
      throw new Error("BOG API response format changed.");
    }

    const tabs = data.data.tabs;
    
    for (const tab of tabs) {
      const title = tab.title;
      const list = tab.tabContent?.currenciesList;
      
      // Skip if no list or it's empty
      if (!list || list.length === 0) continue;
      
      // Skip NBG or options if they somehow appear
      if (title.includes("ოფციონი") || title.includes("სტატისტიკა") || title.includes("ფორვარდული")) continue;

      const find = (ccy) => list.find(r => r.ccy === ccy);

      const usd = find("USD");
      const eur = find("EUR");
      const gbp = find("GBP");
      const rub = find("RUB");

      // Some tabs might not have all currencies
      if (!usd && !eur && !gbp && !rub) continue;

      const companyName = `BOG (${title})`;

      const newRate = new Rate({
        company: companyName,
        usdBuy: usd ? usd.buyRate : null,
        usdSell: usd ? usd.sellRate : null,
        eurBuy: eur ? eur.buyRate : null,
        eurSell: eur ? eur.sellRate : null,
        gbpBuy: gbp ? gbp.buyRate : null,
        gbpSell: gbp ? gbp.sellRate : null,
        rubBuy: rub ? rub.buyRate : null,
        rubSell: rub ? rub.sellRate : null,
        date: new Date()
      });

      await newRate.save();
      console.log(`✅ [BOG] მონაცემები შეინახა: ${companyName} | USD: ${newRate.usdBuy}/${newRate.usdSell}`);
    }
  } catch (error) {
    console.error('❌ [BOG] სკრეპინგის შეცდომა:', error.message);
  }
}

module.exports = fetchBOGRates;
