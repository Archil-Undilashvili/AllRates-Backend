const express = require('express');
const router = express.Router();
const GasPrice = require('../models/GasPrice');
const fetchAllGasPrices = require('../scrapers/gas');

const EXPECTED_GAS_COMPANIES = ['Gulf', 'Wissol', 'Socar', 'Rompetrol', 'Lukoil', 'Portal', 'Connect', 'Neogas'];
const GAS_REFRESH_INTERVAL_MS = 23 * 60 * 60 * 1000;
const GAS_MARKET_SUMMARY_CACHE_MS = 5 * 60 * 1000;

let gasMarketSummaryCache = {
  expiresAt: 0,
  payload: null
};

const GAS_MARKET_CATEGORIES = [
  {
    key: 'super',
    label: 'სუპერი',
    match: (text) => (text.includes('სუპერ') || text.includes('super')) && !text.includes('premium') && !text.includes('პრემიუმ')
  },
  {
    key: 'premium',
    label: 'პრემიუმი',
    match: (text) => text.includes('პრემიუმ') || text.includes('premium') || text.includes('avangard')
  },
  {
    key: 'regular',
    label: 'რეგულარი',
    match: (text) => text.includes('რეგულარ') || text.includes('regular')
  },
  {
    key: 'diesel',
    label: 'დიზელი',
    match: (text) => text.includes('დიზელ') || text.includes('diesel')
  },
  {
    key: 'lpg',
    label: 'თხევადი გაზი',
    match: (text) => (text.includes('lpg') || text.includes('თხევად') || text.includes('გაზი') || text.includes('აირი')) && !text.includes('ბუნებრივ')
  }
];

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

function getGasPrimaryPrice(price) {
  if (price.standardPrice !== null && price.standardPrice !== undefined) return Number(price.standardPrice);
  if (price.price !== null && price.price !== undefined) return Number(price.price);
  return NaN;
}

function getGasComparablePrice(price) {
  const values = [];
  const primary = getGasPrimaryPrice(price);

  if (Number.isFinite(primary) && primary > 0) values.push(primary);
  if (Number(price.selfServicePrice) > 0) values.push(Number(price.selfServicePrice));
  if (Number(price.onlinePrice) > 0) values.push(Number(price.onlinePrice));

  return values.length ? Math.min(...values) : NaN;
}

function calculateGasCategoryAverage(records, category) {
  const companyBestPrices = [];

  records.forEach((record) => {
    const companyBestPrice = getGasCategoryCompanyBestPrice(record, category);
    if (Number.isFinite(companyBestPrice) && companyBestPrice > 0) companyBestPrices.push(companyBestPrice);
  });

  return {
    average: companyBestPrices.length
      ? companyBestPrices.reduce((sum, value) => sum + value, 0) / companyBestPrices.length
      : null,
    count: companyBestPrices.length
  };
}

function getGasCategoryCompanyBestPrice(record, category) {
  const prices = Array.isArray(record?.prices) ? record.prices : [];
  const companyCategoryPrices = prices
    .filter((price) => category.match(`${price.product || ''} ${price.productEng || ''} ${price.code || ''} ${price.type || ''}`.toLowerCase()))
    .map(getGasComparablePrice)
    .filter((value) => Number.isFinite(value) && value > 0);

  return companyCategoryPrices.length ? Math.min(...companyCategoryPrices) : null;
}

function calculateGasComparableChange(companyPairs, category) {
  const currentComparable = [];
  const previousComparable = [];

  companyPairs.forEach((group) => {
    const [latestRecord, previousRecord] = Array.isArray(group.records) ? group.records : [];
    if (!latestRecord || !previousRecord) return;

    const currentPrice = getGasCategoryCompanyBestPrice(latestRecord, category);
    const previousPrice = getGasCategoryCompanyBestPrice(previousRecord, category);
    if (!Number.isFinite(currentPrice) || !Number.isFinite(previousPrice) || previousPrice <= 0) return;

    currentComparable.push(currentPrice);
    previousComparable.push(previousPrice);
  });

  if (!currentComparable.length || !previousComparable.length) {
    return {
      currentAverage: null,
      previousAverage: null,
      changePercent: null,
      comparableCount: 0
    };
  }

  const currentAverage = currentComparable.reduce((sum, value) => sum + value, 0) / currentComparable.length;
  const previousAverage = previousComparable.reduce((sum, value) => sum + value, 0) / previousComparable.length;

  return {
    currentAverage,
    previousAverage,
    changePercent: ((currentAverage - previousAverage) / previousAverage) * 100,
    comparableCount: currentComparable.length
  };
}

function buildGasMarketSummaryFromCompanyPairs(companyPairs) {
  const latestRecords = [];
  const previousRecords = [];

  companyPairs.forEach((group) => {
    const [latestRecord, previousRecord] = Array.isArray(group.records) ? group.records : [];
    if (latestRecord) latestRecords.push(latestRecord);
    if (previousRecord) previousRecords.push(previousRecord);
  });

  const latestUpdatedAt = latestRecords.reduce((latest, record) => {
    const recordDate = new Date(record.createdAt || record.fetchedAt || 0);
    return !latest || recordDate > latest ? recordDate : latest;
  }, null);

  return {
    updatedAt: latestUpdatedAt ? latestUpdatedAt.toISOString() : new Date().toISOString(),
    categories: GAS_MARKET_CATEGORIES.map((category) => {
      const current = calculateGasCategoryAverage(latestRecords, category);
      const previous = calculateGasCategoryAverage(previousRecords, category);
      const comparable = calculateGasComparableChange(companyPairs, category);

      return {
        key: category.key,
        label: category.label,
        average: current.average,
        previousAverage: comparable.previousAverage,
        changePercent: comparable.changePercent,
        count: current.count,
        previousCount: previous.count,
        comparableCount: comparable.comparableCount
      };
    })
  };
}

async function getGasMarketSummary() {
  const now = Date.now();
  if (gasMarketSummaryCache.payload && gasMarketSummaryCache.expiresAt > now) {
    return gasMarketSummaryCache.payload;
  }

  const companyPairs = await GasPrice.aggregate([
    { $sort: { company: 1, createdAt: -1 } },
    { $group: { _id: '$company', records: { $push: '$$ROOT' } } },
    { $project: { company: '$_id', records: { $slice: ['$records', 2] } } }
  ]);

  const payload = buildGasMarketSummaryFromCompanyPairs(companyPairs);
  gasMarketSummaryCache = {
    expiresAt: now + GAS_MARKET_SUMMARY_CACHE_MS,
    payload
  };

  return payload;
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

// GET /api/gas/market-summary
// აბრუნებს მთავარ გვერდზე გამოსატან საწვავის საშუალო ფასებს და წინა snapshot-თან ცვლილებას.
router.get('/market-summary', async (req, res) => {
  try {
    const summary = await getGasMarketSummary();
    res.json(summary);
  } catch (error) {
    console.error('API შეცდომა (gas market summary):', error);
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
    gasMarketSummaryCache = { expiresAt: 0, payload: null };

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
