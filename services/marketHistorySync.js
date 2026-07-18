const axios = require('axios');
const MarketRateHistory = require('../models/MarketRateHistory');

const DEFAULT_SHEET_ID = '16X6WVCMDCdjlSienfe2we2M-Ljcvfw7MSFyYfQO5Y7s';
const DEFAULT_SHEET_NAME = 'M_DB';
const DEFAULT_SHEET_GID = '830142944';
const TBILISI_UTC_OFFSET_HOURS = 4;

const SHEET_ID = process.env.MARKET_HISTORY_SHEET_ID || DEFAULT_SHEET_ID;
const SHEET_NAME = process.env.MARKET_HISTORY_SHEET_NAME || DEFAULT_SHEET_NAME;
const SHEET_GID = process.env.MARKET_HISTORY_SHEET_GID || DEFAULT_SHEET_GID;
const SHEET_CSV_URL = process.env.MARKET_HISTORY_SHEET_CSV_URL
  || `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${encodeURIComponent(SHEET_GID)}`;

function parseCsv(csv) {
  const rows = [];
  let currentRow = [];
  let currentValue = '';
  let insideQuotes = false;

  for (let index = 0; index < csv.length; index += 1) {
    const char = csv[index];
    const nextChar = csv[index + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        currentValue += '"';
        index += 1;
      } else {
        insideQuotes = !insideQuotes;
      }
      continue;
    }

    if (char === ',' && !insideQuotes) {
      currentRow.push(currentValue);
      currentValue = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !insideQuotes) {
      if (char === '\r' && nextChar === '\n') index += 1;
      currentRow.push(currentValue);
      if (currentRow.some(value => value !== '')) rows.push(currentRow);
      currentRow = [];
      currentValue = '';
      continue;
    }

    currentValue += char;
  }

  if (currentValue || currentRow.length) {
    currentRow.push(currentValue);
    if (currentRow.some(value => value !== '')) rows.push(currentRow);
  }

  return rows;
}

function parseNumber(value) {
  if (typeof value === 'number') return value;
  const normalized = String(value || '').replace(/,/g, '').trim();
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeDateParts(dateValue) {
  const raw = String(dateValue || '').trim();
  const match = raw.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  if (!day || !month || !year) return null;

  return { day, month, year };
}

function normalizeTimeParts(timeValue) {
  const raw = String(timeValue || '').trim();
  const match = raw.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;

  return { hour, minute };
}

function toTbilisiTimestamp(dateValue, timeValue) {
  const dateParts = normalizeDateParts(dateValue);
  const timeParts = normalizeTimeParts(timeValue);
  if (!dateParts || !timeParts) return null;

  return new Date(Date.UTC(
    dateParts.year,
    dateParts.month - 1,
    dateParts.day,
    timeParts.hour - TBILISI_UTC_OFFSET_HOURS,
    timeParts.minute,
    0,
    0
  ));
}

function toIsoDateString(dateValue) {
  const dateParts = normalizeDateParts(dateValue);
  if (!dateParts) return String(dateValue || '').trim();
  return [
    String(dateParts.day).padStart(2, '0'),
    String(dateParts.month).padStart(2, '0'),
    String(dateParts.year)
  ].join('.');
}

function rowsToObjects(rows) {
  const headers = rows[0] || [];
  return rows.slice(1).map((row, rowIndex) => {
    const item = { sourceRow: rowIndex + 2 };
    headers.forEach((header, index) => {
      item[String(header || '').trim()] = row[index];
    });
    return item;
  });
}

function mapMarketRow(row) {
  const timestamp = toTbilisiTimestamp(row.Date, row.Time);
  if (!timestamp || Number.isNaN(timestamp.getTime())) return null;

  const usdBuy = parseNumber(row['USDGEL (Buy)']);
  const usdSell = parseNumber(row['USDGEL (Sell)']);
  const eurBuy = parseNumber(row['EURGEL (Buy)'] || row['EURDGEL (Buy)']);
  const eurSell = parseNumber(row['EURGEL (Sell)']);

  return {
    timestamp,
    date: toIsoDateString(row.Date),
    time: String(row.Time || '').trim(),
    usdgel: {
      buy: usdBuy,
      sell: usdSell,
      spread: parseNumber(row['Spread (USDGEL)']) ?? (
        Number.isFinite(usdBuy) && Number.isFinite(usdSell) ? Number((usdSell - usdBuy).toFixed(4)) : null
      )
    },
    eurgel: {
      buy: eurBuy,
      sell: eurSell,
      spread: parseNumber(row['Spread (EURGEL)']) ?? (
        Number.isFinite(eurBuy) && Number.isFinite(eurSell) ? Number((eurSell - eurBuy).toFixed(4)) : null
      )
    },
    source: `google-sheet:${SHEET_NAME}`,
    sourceRow: row.sourceRow,
    tbilisiDateString: `${toIsoDateString(row.Date)} ${String(row.Time || '').trim()}`
  };
}

async function fetchMarketHistoryRows() {
  const response = await axios.get(SHEET_CSV_URL, {
    responseType: 'text',
    timeout: 20000
  });

  const rows = parseCsv(response.data);
  return rowsToObjects(rows).map(mapMarketRow).filter(Boolean);
}

async function syncMarketHistory() {
  const records = await fetchMarketHistoryRows();
  if (!records.length) {
    return { fetched: 0, upserted: 0, modified: 0 };
  }

  const operations = records.map((record) => ({
    updateOne: {
      filter: { timestamp: record.timestamp },
      update: { $set: record },
      upsert: true
    }
  }));

  const result = await MarketRateHistory.bulkWrite(operations, { ordered: false });

  return {
    fetched: records.length,
    upserted: result.upsertedCount || 0,
    modified: result.modifiedCount || 0,
    matched: result.matchedCount || 0,
    latestTimestamp: records.reduce((latest, record) => (
      !latest || record.timestamp > latest ? record.timestamp : latest
    ), null)
  };
}

module.exports = {
  fetchMarketHistoryRows,
  syncMarketHistory,
  toTbilisiTimestamp
};
