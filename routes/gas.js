const express = require('express');
const router = express.Router();
const GasPrice = require('../models/GasPrice');
const fetchAllGasPrices = require('../scrapers/gas');

const EXPECTED_GAS_COMPANIES = ['Gulf', 'Wissol', 'Socar', 'Rompetrol', 'Lukoil', 'Portal', 'Connect', 'Neogas'];
const GAS_REFRESH_INTERVAL_MS = 23 * 60 * 60 * 1000;

function isForceRefresh(req) {
  return ['1', 'true', 'yes'].includes(String(req.query.force || '').toLowerCase());
}

async function getLatestGasSnapshot() {
  return GasPrice.aggregate([
    { $sort: { createdAt: -1 } },
    { $group: { _id: '$company', latestRecord: { $first: '$$ROOT' } } },
    { $replaceRoot: { newRoot: '$latestRecord' } },
    { $sort: { company: 1 } }
  ]);
}

function getGasRefreshDecision(latestGasPrices, force = false) {
  if (force) return { shouldRefresh: true, reason: 'forced' };
  if (!latestGasPrices.length) return { shouldRefresh: true, reason: 'empty-cache' };

  const existingCompanies = new Set(latestGasPrices.map((record) => record.company));
  const missingCompanies = EXPECTED_GAS_COMPANIES.filter((company) => !existingCompanies.has(company));
  if (missingCompanies.length) {
    return { shouldRefresh: true, reason: 'missing-companies', missingCompanies };
  }

  const newestRecord = latestGasPrices.reduce((newest, record) => {
    const recordTime = new Date(record.createdAt || record.date || 0).getTime();
    const newestTime = newest ? new Date(newest.createdAt || newest.date || 0).getTime() : 0;
    return recordTime > newestTime ? record : newest;
  }, null);

  const lastUpdatedAt = newestRecord ? new Date(newestRecord.createdAt || newestRecord.date) : null;
  const ageMs = lastUpdatedAt ? Date.now() - lastUpdatedAt.getTime() : Infinity;

  return {
    shouldRefresh: ageMs >= GAS_REFRESH_INTERVAL_MS,
    reason: ageMs >= GAS_REFRESH_INTERVAL_MS ? 'stale-cache' : 'fresh-cache',
    lastUpdatedAt,
    nextRefreshAfter: lastUpdatedAt ? new Date(lastUpdatedAt.getTime() + GAS_REFRESH_INTERVAL_MS) : null
  };
}

// GET /api/gas/latest
// აბრუნებს ყველა კომპანიის ბოლო შენახულ საწვავის ფასებს.
router.get('/latest', async (req, res) => {
  try {
    const latestGasPrices = await getLatestGasSnapshot();

    res.json(latestGasPrices);
  } catch (error) {
    console.error('API შეცდომა (latest gas prices):', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

async function refreshGasPrices(req, res) {
  try {
    const latestGasPrices = await getLatestGasSnapshot();
    const decision = getGasRefreshDecision(latestGasPrices, isForceRefresh(req));

    if (!decision.shouldRefresh) {
      return res.json({
        message: 'Gas prices are fresh; refresh skipped',
        skipped: true,
        reason: decision.reason,
        lastUpdatedAt: decision.lastUpdatedAt,
        nextRefreshAfter: decision.nextRefreshAfter,
        records: latestGasPrices
      });
    }

    const savedRecords = await fetchAllGasPrices();

    res.json({
      message: 'Gas prices refreshed',
      skipped: false,
      reason: decision.reason,
      savedCount: savedRecords.length,
      companies: savedRecords.map((record) => record.company),
      failedCount: savedRecords.failures ? savedRecords.failures.length : 0,
      failures: savedRecords.failures || [],
      records: savedRecords
    });
  } catch (error) {
    console.error('API შეცდომა (refresh gas prices):', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}

// POST /api/gas/refresh
// ხელით უშვებს ყველა gas scraper-ს და ახალ ჩანაწერებს ინახავს MongoDB-ში.
router.post('/refresh', refreshGasPrices);

// GET /api/gas/refresh
// cron-job.org-ისთვის მარტივი URL. ხშირად გამოძახების შემთხვევაშიც რეალური refresh დღეში ერთხელ გაეშვება.
router.get('/refresh', refreshGasPrices);

// GET /api/gas/health
// მსუბუქი wake endpoint, თუ მხოლოდ სერვერის გაღვიძება გვინდა მონაცემების განახლების გარეშე.
router.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'gas-api', checkedAt: new Date().toISOString() });
});

// GET /api/gas/history?company=Gulf&limit=20
// აბრუნებს საწვავის ფასების ბოლო ისტორიას, სურვილისამებრ კომპანიის ფილტრით.
router.get('/history', async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const filter = req.query.company ? { company: String(req.query.company) } : {};
    const history = await GasPrice.find(filter).sort({ createdAt: -1 }).limit(limit);

    res.json(history);
  } catch (error) {
    console.error('API შეცდომა (gas history):', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;
