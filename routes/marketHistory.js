const express = require('express');
const MarketRateHistory = require('../models/MarketRateHistory');
const { syncMarketHistory } = require('../services/marketHistorySync');

const router = express.Router();
const TBILISI_UTC_OFFSET_HOURS = 4;
const DEFAULT_LIMIT = 2000;
const MAX_LIMIT = 10000;

let rangeCache = {
  key: null,
  expiresAt: 0,
  payload: null
};
let syncInProgress = null;

function clearRangeCache() {
  rangeCache = { key: null, expiresAt: 0, payload: null };
}

async function syncMarketHistoryOnce(reason) {
  if (!syncInProgress) {
    syncInProgress = syncMarketHistory()
      .then((result) => {
        clearRangeCache();
        console.log(`📈 market-history auto-sync (${reason}): ${result.fetched} rows, ${result.upserted} new`);
        return result;
      })
      .finally(() => {
        syncInProgress = null;
      });
  }

  return syncInProgress;
}

async function findMarketHistoryRecords(range, limit) {
  return MarketRateHistory
    .find({ timestamp: { $gte: range.from, $lt: range.to } })
    .sort({ timestamp: 1 })
    .limit(limit)
    .lean();
}

function parseDateInput(value) {
  const raw = String(value || '').trim();
  const match = raw.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/)
    || raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);

  if (!match) return null;

  if (match[1].length === 4) {
    return {
      year: Number(match[1]),
      month: Number(match[2]),
      day: Number(match[3])
    };
  }

  return {
    day: Number(match[1]),
    month: Number(match[2]),
    year: Number(match[3])
  };
}

function datePartsToTbilisiStart(dateParts) {
  if (!dateParts || !dateParts.year || !dateParts.month || !dateParts.day) return null;

  const timestamp = new Date(Date.UTC(
    dateParts.year,
    dateParts.month - 1,
    dateParts.day,
    -TBILISI_UTC_OFFSET_HOURS,
    0,
    0,
    0
  ));

  return Number.isNaN(timestamp.getTime()) ? null : timestamp;
}

function addTbilisiDays(dateParts, days) {
  if (!dateParts || !dateParts.year || !dateParts.month || !dateParts.day) return null;

  const timestamp = new Date(Date.UTC(
    dateParts.year,
    dateParts.month - 1,
    dateParts.day + days,
    -TBILISI_UTC_OFFSET_HOURS,
    0,
    0,
    0
  ));

  return Number.isNaN(timestamp.getTime()) ? null : timestamp;
}

function parseRange(req) {
  const slashStyleFrom = req.params.fromDay && req.params.fromMonth && req.params.fromYear
    ? `${req.params.fromDay}/${req.params.fromMonth}/${req.params.fromYear}`
    : null;
  const slashStyleTo = req.params.toDay && req.params.toMonth && req.params.toYear
    ? `${req.params.toDay}/${req.params.toMonth}/${req.params.toYear}`
    : null;
  const fromRaw = slashStyleFrom || req.params.from || req.query.from || req.query.start;
  const toRaw = slashStyleTo || req.params.to || req.query.to || req.query.end;
  const from = datePartsToTbilisiStart(parseDateInput(fromRaw));
  const to = datePartsToTbilisiStart(parseDateInput(toRaw));

  return { fromRaw, toRaw, from, to };
}

function parseSingleDayRange(req) {
  const slashStyleDate = req.params.day && req.params.month && req.params.year
    ? `${req.params.day}/${req.params.month}/${req.params.year}`
    : null;
  const dateRaw = slashStyleDate || req.params.date || req.query.date || req.query.day;
  const dateParts = parseDateInput(dateRaw);
  const from = datePartsToTbilisiStart(dateParts);
  const to = addTbilisiDays(dateParts, 1);

  return { fromRaw: dateRaw, toRaw: 'next-day', from, to };
}

function buildPayload(records, range) {
  return {
    from: range.from.toISOString(),
    to: range.to.toISOString(),
    timezone: 'Asia/Tbilisi',
    count: records.length,
    records: records.map((record) => ({
      timestamp: record.timestamp,
      date: record.date,
      time: record.time,
      usdgel: record.usdgel,
      eurgel: record.eurgel,
      spread: {
        usdgel: record.usdgel?.spread ?? null,
        eurgel: record.eurgel?.spread ?? null
      }
    }))
  };
}

async function respondWithMarketHistory(req, res, range) {
  try {
    if (!range.from || !range.to) {
      return res.status(400).json({
        error: 'Invalid date',
        example: '/api/market-history?from=10/06/2026&to=11/06/2026',
        singleDayExamples: [
          '/api/market-history/day/10-06-2026',
          '/api/market-history/10-06-2026'
        ],
        acceptedFormats: ['DD/MM/YYYY', 'DD.MM.YYYY', 'DD-MM-YYYY', 'YYYY-MM-DD']
      });
    }

    if (range.from >= range.to) {
      return res.status(400).json({ error: 'from date must be earlier than to date' });
    }

    const limit = Math.min(Number(req.query.limit) || DEFAULT_LIMIT, MAX_LIMIT);
    const cacheKey = `${range.from.toISOString()}_${range.to.toISOString()}_${limit}`;
    const now = Date.now();
    if (rangeCache.key === cacheKey && rangeCache.expiresAt > now && rangeCache.payload) {
      return res.json({ ...rangeCache.payload, cached: true });
    }

    let records = await findMarketHistoryRecords(range, limit);
    if (!records.length) {
      await syncMarketHistoryOnce('empty-range');
      records = await findMarketHistoryRecords(range, limit);
    }

    const payload = buildPayload(records, range);
    rangeCache = {
      key: cacheKey,
      expiresAt: now + 60_000,
      payload
    };

    res.json({ ...payload, cached: false });
  } catch (error) {
    console.error('API შეცდომა (market history):', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}

async function getMarketHistoryRange(req, res) {
  return respondWithMarketHistory(req, res, parseRange(req));
}

async function getMarketHistorySingleDay(req, res) {
  return respondWithMarketHistory(req, res, parseSingleDayRange(req));
}

async function refreshMarketHistory(req, res) {
  try {
    const result = await syncMarketHistory();
    clearRangeCache();
    res.json({
      message: 'Market history synced',
      ...result
    });
  } catch (error) {
    console.error('API შეცდომა (market history sync):', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}

router.get('/sync', refreshMarketHistory);
router.post('/sync', refreshMarketHistory);
router.get('/latest', async (req, res) => {
  try {
    let record = await MarketRateHistory.findOne().sort({ timestamp: -1 }).lean();
    const latestAgeMs = record ? Date.now() - new Date(record.timestamp).getTime() : Infinity;
    if (!record || latestAgeMs > 45 * 60 * 1000) {
      await syncMarketHistoryOnce('stale-latest');
      record = await MarketRateHistory.findOne().sort({ timestamp: -1 }).lean();
    }

    if (!record) {
      return res.status(404).json({ error: 'Market history is empty' });
    }

    res.json({
      timestamp: record.timestamp,
      date: record.date,
      time: record.time,
      usdgel: record.usdgel,
      eurgel: record.eurgel,
      spread: {
        usdgel: record.usdgel?.spread ?? null,
        eurgel: record.eurgel?.spread ?? null
      }
    });
  } catch (error) {
    console.error('API შეცდომა (latest market history):', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});
router.get('/day/:day/:month/:year', getMarketHistorySingleDay);
router.get('/day/:date', getMarketHistorySingleDay);
router.get('/:fromDay/:fromMonth/:fromYear-:toDay/:toMonth/:toYear', getMarketHistoryRange);
router.get('/range/:from/:to', getMarketHistoryRange);
router.get('/:date', getMarketHistorySingleDay);
router.get('/:from/:to', getMarketHistoryRange);
router.get('/', getMarketHistoryRange);

module.exports = router;
