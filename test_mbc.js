require('dotenv').config();
const mongoose = require('mongoose');
const fetchMBCRates = require('./scrapers/mbc');

mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log('Connected to DB. Running MBC...');
    await fetchMBCRates();
    console.log('Done.');
    process.exit(0);
  })
  .catch(err => {
    console.error('DB Error:', err);
    process.exit(1);
  });