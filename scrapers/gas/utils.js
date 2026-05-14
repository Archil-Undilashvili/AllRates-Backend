const axios = require('axios');

const DEFAULT_HEADERS = {
  'accept-language': 'ka,en;q=0.8',
  'user-agent': 'Mozilla/5.0 allrates-gas-fetch/1.0'
};

function decodeHtml(value = '') {
  return String(value)
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function stripTags(value = '') {
  return decodeHtml(String(value).replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

function toNumber(value) {
  const normalized = String(value).replace(',', '.').match(/\d+(?:\.\d+)?/);
  return normalized ? Number(normalized[0]) : null;
}

async function getHtml(url, options = {}) {
  const { data } = await axios.get(url, {
    timeout: 30000,
    headers: { ...DEFAULT_HEADERS, ...(options.headers || {}) },
    ...options
  });

  return data;
}

function logSaved(company, count) {
  console.log(`✅ [Gas/${company}] მონაცემები შეინახა ბაზაში (${count} პროდუქტი)`);
}

function logError(company, error) {
  console.error(`❌ [Gas/${company}] სკრეპინგის შეცდომა:`, error.message);
}

module.exports = {
  DEFAULT_HEADERS,
  decodeHtml,
  stripTags,
  toNumber,
  getHtml,
  logSaved,
  logError
};
