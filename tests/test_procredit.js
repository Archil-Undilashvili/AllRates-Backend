const fetchProcreditRates = require('./scrapers/procredit');
const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  console.log("Connected to DB, running scraper...");
  await fetchProcreditRates();
  console.log("Done");
  process.exit(0);
}).catch(console.error);
