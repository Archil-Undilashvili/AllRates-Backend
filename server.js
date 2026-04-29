require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cron = require('node-cron');

// Scrapers
const fetchRicoRates = require('./scrapers/rico');
const fetchCrystalRates = require('./scrapers/crystal');
const fetchKursiRates = require('./scrapers/kursige');
const fetchGiroRates = require('./scrapers/giro');
const fetchValutoRates = require('./scrapers/valuto');
const fetchBOGRates = require('./scrapers/bog');
const fetchTBCRates = require('./scrapers/tbc');
const fetchLibertyRates = require('./scrapers/liberty');
const fetchBBRates = require('./scrapers/bb');
const fetchCredoRates = require('./scrapers/credo');
const fetchCartuRates = require('./scrapers/cartu');
const fetchInteliExpressRates = require('./scrapers/inex');
const fetchMBCRates = require('./scrapers/mbc');
const fetchGoaRates = require('./scrapers/goa');
const fetchHashRates = require('./scrapers/hash');
const fetchTerabankRates = require('./scrapers/tera');
const fetchHalykRates = require('./scrapers/halyk');
const fetchIsBankRates = require('./scrapers/isbank');
const fetchSilkRates = require('./scrapers/silk');
const fetchProcreditRates = require("./scrapers/procredit");
const Rate = require('./models/Rate');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI;

// Connect to MongoDB
mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('✅ დაკავშირებულია MongoDB-სთან წარმატებით!');
    
    // Start Cron Jobs (Runs every 1 minute)
    cron.schedule('* * * * *', async () => {
      console.log('⏳ ვიწყებ კურსების განახლებას (Cron Job)...');
      
      // Promise.allSettled runs all scrapers in parallel and continues even if one fails
      await Promise.allSettled([
        fetchRicoRates(),
        fetchCrystalRates(),
        fetchKursiRates(),
        fetchGiroRates(),
        fetchValutoRates(),
        fetchBOGRates(),
        fetchTBCRates(),
        fetchLibertyRates(),
        fetchBBRates(),
        fetchCredoRates(),
        fetchCartuRates(),
        fetchInteliExpressRates(),
        fetchMBCRates(),
        fetchGoaRates(),
        fetchHashRates(),
        fetchTerabankRates(),
        fetchHalykRates(),
        fetchIsBankRates(),
        fetchSilkRates(),
        fetchProcreditRates()
      ]);
      
      console.log('✅ კურსების განახლება დასრულდა!');
    });
  })
  .catch(err => console.error('❌ MongoDB-სთან დაკავშირების შეცდომა:', err));

// Basic route to test API
app.get('/', (req, res) => {
    res.json({ message: "AllRates API Server is running!" });
});

// GET /api/rates/latest - აბრუნებს ყველა კომპანიის ბოლო განახლებულ კურსს
app.get('/api/rates/latest', async (req, res) => {
  try {
    const latestRates = await Rate.aggregate([
      // ჯერ ვასორტირებთ კლებადობით (ყველაზე ახალი პირველი იყოს)
      { $sort: { createdAt: -1 } },
      // ვაჯგუფებთ კომპანიების მიხედვით და თითოეულისთვის ვიღებთ მხოლოდ პირველს (ყველაზე ახალს)
      { $group: { _id: "$company", latestRecord: { $first: "$$ROOT" } } },
      // ჯგუფის სტრუქტურის მაგივრად პირდაპირ დოკუმენტებს ვწევთ ზევით
      { $replaceRoot: { newRoot: "$latestRecord" } },
      // ვასორტირებთ ანბანის მიხედვით
      { $sort: { company: 1 } }
    ]);
    
    res.json(latestRates);
  } catch (error) {
    console.error("API შეცდომა (latest rates):", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.listen(PORT, () => {
    console.log(`🚀 სერვერი გაშვებულია პორტზე: ${PORT}`);
});
