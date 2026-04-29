const axios = require('axios');
const cheerio = require('cheerio');

async function testCartu() {
    const url = "https://www.cartubank.ge";
    const { data: html } = await axios.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        "Accept": "text/html,application/xhtml+xml"
      }
    });

    const $ = cheerio.load(html);
    console.log("HTML length:", html.length);
    
    let foundRows = 0;
    $('.currency-rates__row').each((i, el) => {
      foundRows++;
      console.log($(el).text());
    });
    console.log("Found rows:", foundRows);
    
    // Also look for currency names inside the html without class
    console.log("USD found:", html.includes("USD"));
}
testCartu().catch(console.error);
