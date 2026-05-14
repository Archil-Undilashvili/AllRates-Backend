const express = require('express');
const router = express.Router();
const GasPrice = require('../models/GasPrice');
const fetchAllGasPrices = require('../scrapers/gas');

// GET /api/gas/latest
// აბრუნებს ყველა კომპანიის ბოლო შენახულ საწვავის ფასებს.
router.get('/latest', async (req, res) => {
  try {
    const latestGasPrices = await GasPrice.aggregate([
      { $sort: { createdAt: -1 } },
      { $group: { _id: '$company', latestRecord: { $first: '$$ROOT' } } },
      { $replaceRoot: { newRoot: '$latestRecord' } },
      { $sort: { company: 1 } }
    ]);

    res.json(latestGasPrices);
  } catch (error) {
    console.error('API შეცდომა (latest gas prices):', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

async function refreshGasPrices(req, res) {
  try {
    const savedRecords = await fetchAllGasPrices();

    res.json({
      message: 'Gas prices refreshed',
      savedCount: savedRecords.length,
      companies: savedRecords.map((record) => record.company),
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
// cron-job.org-ისთვის მარტივი URL, რომელიც Render-საც აღვიძებს და ფასებსაც აახლებს.
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
