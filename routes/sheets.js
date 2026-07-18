const express = require('express');
const {
  getSheetsCache,
  refreshSheetsCache,
  startSheetsCacheRefresh
} = require('../services/sheetsCache');

const router = express.Router();

async function dataHandler(req, res) {
  const cache = await getSheetsCache();
  if (!cache.data && cache.error) {
    return res.status(503).json({
      error: 'Sheets data is unavailable',
      details: cache.error,
      updatedAt: cache.updatedAt
    });
  }

  res.json({
    data: cache.data,
    updatedAt: cache.updatedAt,
    range: cache.range,
    source: cache.source,
    error: cache.error
  });
}

async function healthHandler(req, res) {
  const cache = await getSheetsCache();
  res.status(cache.data ? 200 : 503).json({
    status: cache.data ? 'ok' : 'degraded',
    service: 'sheets-api',
    range: cache.range,
    source: cache.source,
    updatedAt: cache.updatedAt,
    error: cache.error
  });
}

router.get('/data', dataHandler);
router.get('/health', healthHandler);
router.post('/refresh', async (req, res) => {
  const cache = await refreshSheetsCache();
  res.json({
    message: 'Sheets cache refresh completed',
    data: cache.data,
    updatedAt: cache.updatedAt,
    range: cache.range,
    source: cache.source,
    error: cache.error
  });
});

module.exports = {
  router,
  dataHandler,
  healthHandler,
  startSheetsCacheRefresh
};
