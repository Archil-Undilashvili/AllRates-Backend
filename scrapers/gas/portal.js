const GasPrice = require('../../models/GasPrice');
const { getHtml, toNumber, logSaved, logError } = require('./utils');

const PORTAL_URL = 'https://portal.com.ge/ka/fuel-prices';

function unescapeNextString(value) {
  return String(value)
    .replace(/\\"/g, '"')
    .replace(/\\n/g, '\n')
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, code) => String.fromCharCode(parseInt(code, 16)));
}

function extractBalancedArray(text, startIndex) {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = startIndex; index < text.length; index += 1) {
    const char = text[index];
    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === '\\') {
      escaped = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (char === '[') depth += 1;
    if (char === ']') {
      depth -= 1;
      if (depth === 0) return text.slice(startIndex, index + 1);
    }
  }

  return null;
}

function parsePortalFuelPrices(html) {
  const unescapedHtml = unescapeNextString(html);
  const marker = '"fuelPricesData":';
  const markerIndex = unescapedHtml.lastIndexOf(marker);
  if (markerIndex === -1) throw new Error('Portal fuelPricesData payload was not found.');

  const arrayStart = unescapedHtml.indexOf('[', markerIndex + marker.length);
  const arrayText = extractBalancedArray(unescapedHtml, arrayStart);
  if (!arrayText) throw new Error('Portal fuelPricesData array could not be parsed.');

  const fuelPricesData = JSON.parse(arrayText);
  if (!Array.isArray(fuelPricesData) || !fuelPricesData.length) {
    throw new Error('Portal price rows were not found.');
  }

  return fuelPricesData.map((item) => ({
    product: item.name,
    type: item.type,
    price: toNumber(item.latestPrice),
    onlinePrice: toNumber(item.latestOnlinePrice),
    currency: 'GEL',
    details: {
      country: item.fuelType && item.fuelType.country,
      standard: item.fuelType && item.fuelType.standard,
      octane: item.fuelType && item.fuelType.octane ? toNumber(item.fuelType.octane) : null,
      cetaneNumber: item.fuelType && item.fuelType.cetaneNumber ? toNumber(item.fuelType.cetaneNumber) : null,
      sulfurContent: item.fuelType && item.fuelType.sulfurContent ? toNumber(item.fuelType.sulfurContent) : null
    }
  }));
}

async function fetchPortalGasPrices() {
  try {
    const html = await getHtml(PORTAL_URL);
    const prices = parsePortalFuelPrices(html);

    const doc = new GasPrice({
      company: 'Portal',
      source: PORTAL_URL,
      prices
    });

    await doc.save();
    logSaved('Portal', doc.prices.length);
    return doc;
  } catch (error) {
    logError('Portal', error);
    return null;
  }
}

module.exports = fetchPortalGasPrices;
module.exports.parsePortalFuelPrices = parsePortalFuelPrices;
