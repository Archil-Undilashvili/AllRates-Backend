require('dotenv').config();
const mongoose = require('mongoose');
const fetchCrystalRates = require('./scrapers/crystal');
const fetchGoaRates = require('./scrapers/goa');

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  console.log('Connected to MongoDB');
  await fetchCrystalRates();
  await fetchGoaRates();
  console.log('Done');
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
