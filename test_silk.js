const axios = require('axios');
const cheerio = require('cheerio');

axios.get('https://silkbank.ge/en/currency/', { headers: { 'User-Agent': 'Mozilla/5.0' } })
  .then(res => {
    const $ = cheerio.load(res.data);
    console.log('USD Buy:', $('#price-buy-us-dollar').text());
    console.log('USD Sell:', $('#price-sell-us-dollar').text());
    console.log('EUR Buy:', $('#price-buy-euro').text());
    console.log('EUR Sell:', $('#price-sell-euro').text());
    console.log('GBP Buy:', $('#price-buy-british-pound').text());
    console.log('GBP Sell:', $('#price-sell-british-pound').text());
    console.log('RUB Buy:', $('#price-buy-russian-ruble').text());
    console.log('RUB Sell:', $('#price-sell-russian-ruble').text());
    
    // Check if there are other types of rates
    console.log("Titles found:", $('.currency-title').text());
  })
  .catch(err => console.error(err.message));