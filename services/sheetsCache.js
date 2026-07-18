const axios = require('axios');

const DEFAULT_SHEET_ID = '16X6WVCMDCdjlSienfe2we2M-Ljcvfw7MSFyYfQO5Y7s';
const DEFAULT_SHEET_NAME = 'COMB1';
const DEFAULT_RANGE = 'COMB1!A1:S22';
const DEFAULT_REFRESH_MS = 30_000;

const SHEET_ID = process.env.SHEET_ID || DEFAULT_SHEET_ID;
const SHEET_NAME = process.env.SHEET_NAME || DEFAULT_SHEET_NAME;
const API_KEY = process.env.GOOGLE_SHEETS_API_KEY;
const configuredRange = process.env.SHEET_RANGE || DEFAULT_RANGE;
const RANGE = configuredRange === 'COMB1!A1:F9' ? DEFAULT_RANGE : configuredRange;
const REFRESH_MS = Number(process.env.SHEETS_REFRESH_MS) || DEFAULT_REFRESH_MS;
const LEGACY_SOURCE_URL = process.env.SHEETS_LEGACY_SOURCE_URL;
const SHEET_CSV_URL = process.env.SHEET_CSV_URL
  || `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(SHEET_NAME)}`;

let cache = {
  data: null,
  updatedAt: 0,
  error: null,
  source: null,
  range: RANGE
};

let refreshInProgress = null;
let intervalHandle = null;

async function fetchFromGoogleSheetsApi() {
  if (!SHEET_ID || !API_KEY) {
    throw new Error('Missing SHEET_ID or GOOGLE_SHEETS_API_KEY');
  }

  const encodedRange = encodeURIComponent(RANGE);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodedRange}?key=${API_KEY}`;
  const response = await axios.get(url, { timeout: 20_000 });
  return {
    data: response.data?.values || [],
    source: 'google-sheets-api'
  };
}

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

function columnNumber(columnLetters) {
  return String(columnLetters || '').toUpperCase().split('').reduce((total, char) => {
    const code = char.charCodeAt(0);
    if (code < 65 || code > 90) return total;
    return total * 26 + (code - 64);
  }, 0);
}

function trimRowsToConfiguredRange(rows) {
  const rangeMatch = RANGE.match(/!([A-Z]+)(\d+):([A-Z]+)(\d+)$/i);
  if (!rangeMatch) return rows;

  const [, startCol, startRow, endCol, endRow] = rangeMatch;
  const fromColumnIndex = Math.max(columnNumber(startCol) - 1, 0);
  const toColumnIndex = columnNumber(endCol);
  const fromRowIndex = Math.max(Number(startRow) - 1, 0);
  const toRowIndex = Number(endRow);

  return rows
    .slice(fromRowIndex, toRowIndex)
    .map(row => row.slice(fromColumnIndex, toColumnIndex));
}

async function fetchFromPublicCsv() {
  const response = await axios.get(SHEET_CSV_URL, {
    responseType: 'text',
    timeout: 20_000
  });

  return {
    data: trimRowsToConfiguredRange(parseCsv(response.data)),
    source: 'public-google-sheet-csv'
  };
}

async function fetchFromLegacySource() {
  if (!LEGACY_SOURCE_URL) {
    throw new Error('SHEETS_LEGACY_SOURCE_URL is not configured');
  }

  const response = await axios.get(LEGACY_SOURCE_URL, { timeout: 20_000 });
  const payload = response.data;
  const data = Array.isArray(payload?.data) ? payload.data : payload;
  if (!Array.isArray(data)) {
    throw new Error('Legacy sheets source did not return an array');
  }

  return {
    data,
    source: 'legacy-source'
  };
}

async function refreshSheetsCache() {
  if (refreshInProgress) return refreshInProgress;

  refreshInProgress = (async () => {
    try {
      let result;
      try {
        result = API_KEY ? await fetchFromGoogleSheetsApi() : await fetchFromPublicCsv();
      } catch (primaryError) {
        try {
          result = await fetchFromPublicCsv();
        } catch (_) {
          if (!LEGACY_SOURCE_URL) throw primaryError;
          result = await fetchFromLegacySource();
        }
      }

      cache = {
        data: result.data,
        updatedAt: Date.now(),
        error: null,
        source: result.source,
        range: RANGE
      };
      console.log(`📄 Sheets cache refreshed (${result.source}, ${result.data.length} rows)`);
      return cache;
    } catch (error) {
      cache = {
        ...cache,
        error: error.message
      };
      console.error('⚠️ Sheets cache refresh failed:', error.message);
      return cache;
    } finally {
      refreshInProgress = null;
    }
  })();

  return refreshInProgress;
}

async function getSheetsCache() {
  const isStale = !cache.updatedAt || Date.now() - cache.updatedAt > REFRESH_MS;
  if (isStale) {
    await refreshSheetsCache();
  }
  return cache;
}

function startSheetsCacheRefresh() {
  if (intervalHandle) return;
  refreshSheetsCache();
  intervalHandle = setInterval(refreshSheetsCache, REFRESH_MS);
}

module.exports = {
  getSheetsCache,
  refreshSheetsCache,
  startSheetsCacheRefresh
};
