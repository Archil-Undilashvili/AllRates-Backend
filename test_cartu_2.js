const axios = require('axios');
const cheerio = require('cheerio');

async function testCartu() {
    const url = "https://www.cartubank.ge";
    const { data: html } = await axios.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      }
    });

    const $ = cheerio.load(html);
    
    $('.currency-rates__row').each((i, el) => {
      const row = $(el);
      const textDivs = row.find('div');
      console.log(`Row ${i} has ${textDivs.length} divs.`);
      
      const cols = row.children('div'); // maybe it's children
      console.log(`Row ${i} children divs: ${cols.length}`);
      cols.each((j, col) => {
          console.log(`Col ${j}: ${$(col).text().trim()}`);
      });
    });
}
testCartu().catch(console.error);
