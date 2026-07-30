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
const fetchLeaderRates = require("./scrapers/leader");
const fetchSmartiRates = require("./scrapers/smarti");
const fetchCentralRates = require("./scrapers/central");
const fetchGeorgianCreditRates = require("./scrapers/georgiancredit");
const fetchTbmcRates = require("./scrapers/tbmc");
const fetchBermeliRates = require("./scrapers/bermeli");
const fetchAlphaExpressRates = require("./scrapers/alphaexpress");
const fetchScappRates = require("./scrapers/scapp");
const fetchExpressLombardRates = require("./scrapers/expresslombard");
const fetchAllGasPrices = require('./scrapers/gas');
const Rate = require('./models/Rate');

// Auth Routes-ის იმპორტი
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const dashboardRoutes = require('./routes/dashboard');
const gasRoutes = require('./routes/gas');
const alertRoutes = require('./routes/alerts');
const marketHistoryRoutes = require('./routes/marketHistory');
const sheetsRoutes = require('./routes/sheets');
const { processRateAlerts } = require('./services/alertProcessor');
const { syncMarketHistory } = require('./services/marketHistorySync');
const { getSheetsCache } = require('./services/sheetsCache');

const app = express();
app.use(cors());
app.use(express.json());

// ============================================
// ავტორიზაციის და რეგისტრაციის სისტემის მიბმა
// ============================================
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/gas', gasRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/market-history', marketHistoryRoutes);
app.use('/api/sheets', sheetsRoutes.router);
app.get('/api/data', sheetsRoutes.dataHandler);

const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI;
let alertProcessingInProgress = false;
let marketHistorySyncInProgress = false;

function isInvalidCrystalTry(rate) {
  const buy = Number(rate?.tryBuy);
  const sell = Number(rate?.trySell);
  if (!Number.isFinite(buy) || !Number.isFinite(sell)) return true;
  return buy <= 0 || sell <= 0 || buy < 0.01 || sell < 0.01 || buy === sell;
}

async function getLatestCompanyRates() {
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

  return Promise.all(latestRates
    .filter(rate => !String(rate.company || '').toLowerCase().includes('procredit'))
    .map(async rate => {
      if (!String(rate.company || '').toLowerCase().includes('crystal')) return rate;
      const fixed = { ...rate };
      if (Number(fixed.rubBuy) > 1) fixed.rubBuy = Number((Number(fixed.rubBuy) / 100).toFixed(4));
      if (Number(fixed.rubSell) > 1) fixed.rubSell = Number((Number(fixed.rubSell) / 100).toFixed(4));

      if (isInvalidCrystalTry(fixed)) {
        try {
          const liveCrystal = await fetchCrystalRates.getCurrentCrystalRates();
          Object.assign(fixed, liveCrystal);
        } catch (error) {
          console.warn('⚠️ Crystal TRY live correction failed:', error.message);
          fixed.tryBuy = null;
          fixed.trySell = null;
        }
      }

      return fixed;
    }));
}

async function runAlertProcessing(source) {
  if (alertProcessingInProgress) return;
  alertProcessingInProgress = true;
  try {
    const alertResult = await processRateAlerts();
    if (alertResult.sent) console.log(`📩 გაიგზავნა ${alertResult.sent} alert იმეილი (${source})`);
  } catch (alertError) {
    console.error(`⚠️ Alert-ების შემოწმების შეცდომა (${source}):`, alertError.message);
  } finally {
    alertProcessingInProgress = false;
  }
}

async function runMarketHistorySync(source) {
  if (marketHistorySyncInProgress) return;
  marketHistorySyncInProgress = true;
  try {
    const result = await syncMarketHistory();
    console.log(`📈 საბაზრო კურსების ისტორია განახლდა (${source}): ${result.fetched} rows, ${result.upserted} new`);
  } catch (error) {
    console.error(`⚠️ საბაზრო კურსების ისტორიის განახლების შეცდომა (${source}):`, error.message);
  } finally {
    marketHistorySyncInProgress = false;
  }
}

// Connect to MongoDB
mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('✅ დაკავშირებულია MongoDB-სთან წარმატებით!');
    sheetsRoutes.startSheetsCacheRefresh();
    runMarketHistorySync('startup');
    
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
        fetchLeaderRates(),
        fetchSmartiRates(),
        fetchCentralRates(),
        fetchGeorgianCreditRates(),
        fetchTbmcRates(),
        fetchBermeliRates(),
        fetchAlphaExpressRates(),
        fetchScappRates(),
        fetchExpressLombardRates()
      ]);
      
      console.log('✅ კურსების განახლება დასრულდა!');
    });

    cron.schedule('* * * * *', async () => {
      await runAlertProcessing('cron');
    });

    cron.schedule('*/30 * * * *', async () => {
      await runMarketHistorySync('cron');
    }, {
      timezone: 'Asia/Tbilisi'
    });

    // Fuel prices change slowly, so refresh them once per day.
    cron.schedule('15 4 * * *', async () => {
      console.log('⛽ ვიწყებ საწვავის ფასების განახლებას (Cron Job)...');
      await fetchAllGasPrices();
      console.log('✅ საწვავის ფასების განახლება დასრულდა!');
    }, {
      timezone: 'Asia/Tbilisi'
    });
  })
  .catch(err => console.error('❌ MongoDB-სთან დაკავშირების შეცდომა:', err));

// Basic route to test API
app.get('/', (req, res) => {
    res.json({ message: "AllRates API Server is running!" });
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'allrates-backend-api',
    checkedAt: new Date().toISOString()
  });
});

// GET /api/rates/latest - აბრუნებს ყველა კომპანიის ბოლო განახლებულ კურსს
app.get('/api/rates/latest', async (req, res) => {
  try {
    const latestRates = await getLatestCompanyRates();
    res.json(latestRates);
  } catch (error) {
    console.error("API შეცდომა (latest rates):", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get('/api/unified', async (req, res) => {
  try {
    const [sheetsCache, companyRates] = await Promise.all([
      getSheetsCache(),
      getLatestCompanyRates()
    ]);

    res.json({
      updatedAt: new Date().toISOString(),
      sources: {
        googleSheet: {
          endpoint: '/api/data',
          range: sheetsCache.range,
          source: sheetsCache.source,
          updatedAt: sheetsCache.updatedAt,
          error: sheetsCache.error || null
        },
        companyRates: {
          endpoint: '/api/rates/latest',
          source: 'mongodb:scrapers',
          count: companyRates.length
        }
      },
      googleSheet: {
        data: sheetsCache.data || []
      },
      companyRates
    });
  } catch (error) {
    console.error("API შეცდომა (unified data):", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.listen(PORT, () => {
    console.log(`🚀 სერვერი გაშვებულია პორტზე: ${PORT}`);
});
