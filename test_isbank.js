const axios = require('axios');
const cheerio = require('cheerio');

axios.get('http://isbank.ge/en/individual', { headers: { 'User-Agent': 'Mozilla/5.0' } })
  .then(res => {
    const $ = cheerio.load(res.data);
    $('.courses-value.bank-values').each((i, el) => {
      const parent = $(el).parent().parent().parent();
      console.log(i, "Parent text:", parent.text().replace(/\s+/g, ' ').substring(0, 100));
    });
  })
  .catch(err => console.error(err.message));