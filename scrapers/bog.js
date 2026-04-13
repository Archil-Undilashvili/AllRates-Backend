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
    
    const types = [
      { name: "BOG (კომერციული)", keyBuy: "dgtlBuyRate", keySell: "dgtlSellRate", tabMatch: "კომერციული" },
      { name: "BOG (საცალო)", keyBuy: "buyRate", keySell: "sellRate", tabMatch: "კომერციული" },
      { name: "BOG (საბარათე)", keyBuy: "plcBuyRate", keySell: "plcSellRate", tabMatch: "კომერციული" },
      { name: "BOG (გზავნილების)", keyBuy: "transferBuyRate", keySell: "transfersellRate", tabMatch: "გზავნილების" },
      { name: "BOG (საბითუმო)", keyBuy: "buyRate", keySell: "sellRate", tabMatch: "საბითუმო" }
    ];

    for (const type of types) {
      const tab = tabs.find(t => t.title.includes(type.tabMatch));
      if (!tab) continue;
      
      const list = tab.tabContent?.currenciesList;
      if (!list || list.length === 0) continue;

      const find = (ccy) => list.find(r => r.ccy === ccy);
      const usd = find("USD");
      const eur = find("EUR");
      const gbp = find("GBP");
      const rub = find("RUB");

      if (!usd && !eur && !gbp && !rub) continue;

      const newRate = new Rate({
        company: type.name,
        usdBuy: usd ? usd[type.keyBuy] : null,
        usdSell: usd ? usd[type.keySell] : null,
        eurBuy: eur ? eur[type.keyBuy] : null,
        eurSell: eur ? eur[type.keySell] : null,
        gbpBuy: gbp ? gbp[type.keyBuy] : null,
        gbpSell: gbp ? gbp[type.keySell] : null,
        rubBuy: rub ? rub[type.keyBuy] : null,
        rubSell: rub ? rub[type.keySell] : null
      });

      await newRate.save();
      console.log("✅ [BOG] მონაცემები შეინახა: " + type.name + " | USD: " + newRate.usdBuy + "/" + newRate.usdSell);
    }

  } catch (error) {
    console.error('❌ [BOG] სკრეპინგის შეცდომა:', error.message);
  }
}

module.exports = fetchBOGRates;