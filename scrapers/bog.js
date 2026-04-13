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

    const definitions = [
      { name: "BOG (კომერციული კურსები)", tab: "კომერციული კურსები", keyBuy: "buyRate", keySell: "sellRate" },
      { name: "BOG (საბითუმო კურსები)", tab: "საბითუმო კურსები", keyBuy: "dgtlBuyRate", keySell: "dgtlSellRate" },
      { name: "BOG (გზავნილების კურსი)", tab: "გზავნილების კურსი", keyBuy: "transferBuyRate", keySell: "transfersellRate" },
      { name: "BOG (საბარათე გადახდების კურსი)", tab: "საბარათე გადახდების კურსი", keyBuy: "plcBuyRate", keySell: "plcSellRate" }
    ];

    for (const def of definitions) {
      const tabData = tabs.find(t => t.title === def.tab);
      if (!tabData || !tabData.tabContent || !tabData.tabContent.currenciesList) continue;

      const list = tabData.tabContent.currenciesList;
      const find = (ccy) => list.find(r => r.ccy === ccy);

      const usd = find("USD");
      const eur = find("EUR");
      const gbp = find("GBP");
      const rub = find("RUB");

      if (!usd || !usd[def.keyBuy] || !usd[def.keySell]) continue;

      const newRate = new Rate({
        company: def.name,
        usdBuy: usd ? usd[def.keyBuy] : null,
        usdSell: usd ? usd[def.keySell] : null,
        eurBuy: eur ? eur[def.keyBuy] : null,
        eurSell: eur ? eur[def.keySell] : null,
        gbpBuy: gbp ? gbp[def.keyBuy] : null,
        gbpSell: gbp ? gbp[def.keySell] : null,
        rubBuy: rub ? rub[def.keyBuy] : null,
        rubSell: rub ? rub[def.keySell] : null
      });

      await newRate.save();
      console.log("✅ [BOG] მონაცემები შეინახა: " + def.name + " | USD: " + newRate.usdBuy + "/" + newRate.usdSell);
    }

  } catch (error) {
    console.error('❌ [BOG] სკრეპინგის შეცდომა:', error.message);
  }
}

module.exports = fetchBOGRates;