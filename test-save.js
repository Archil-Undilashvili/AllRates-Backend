require('dotenv').config();
const mongoose = require('mongoose');
const Rate = require('./models/Rate');

mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    const r = new Rate({
      company: 'Test Company',
      usdBuy: 2.7
    });
    await r.save();
    console.log(r);
    process.exit(0);
  });
