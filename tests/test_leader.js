const fetchLeaderRates = require('./scrapers/leader');
const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  await fetchLeaderRates();
  process.exit(0);
}).catch(console.error);
