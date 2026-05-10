const fetchLibertyRates = require('./scrapers/liberty');
const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  await fetchLibertyRates();
  process.exit(0);
}).catch(console.error);
