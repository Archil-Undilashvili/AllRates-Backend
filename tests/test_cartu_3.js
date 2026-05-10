const fetchCartuRates = require('./scrapers/cartu');
const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  await fetchCartuRates();
  process.exit(0);
}).catch(console.error);
