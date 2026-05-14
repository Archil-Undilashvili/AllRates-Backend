const GasPrice = require('../../models/GasPrice');
const { getHtml, stripTags, toNumber, logSaved, logError } = require('./utils');

const WISSOL_URL = 'https://wissol.ge/ka/fuel-prices';

function parseWissolFuelPrices(html) {
  const rows = [...String(html).matchAll(/<button\b[^>]*class=["'][^"']*prices_row[^"']*["'][^>]*>([\s\S]*?)<\/button>/gi)]
    .map((rowMatch) => {
      const rowHtml = rowMatch[1];
      const productMatch = rowHtml.match(/class=["'][^"']*horizontal-text-wrapper[^"']*["'][^>]*>[\s\S]*?<p>([\s\S]*?)<\/p>/i);
      const priceMatches = [...rowHtml.matchAll(/<p\b[^>]*class=["']([^"']*\bprices_price\b[^"']*)["'][^>]*>([\s\S]*?)<\/p>/gi)];

      if (!productMatch || !priceMatches.length) return null;

      const standardMatch = priceMatches.find((match) => !match[1].includes('is-self-service'));
      const selfServiceMatch = priceMatches.find((match) => match[1].includes('is-self-service'));

      return {
        product: stripTags(productMatch[1]),
        standardPrice: standardMatch ? toNumber(stripTags(standardMatch[2])) : null,
        selfServicePrice: selfServiceMatch ? toNumber(stripTags(selfServiceMatch[2])) : null,
        currency: 'GEL'
      };
    })
    .filter(Boolean);

  if (!rows.length) throw new Error('Wissol price rows were not found.');
  return rows;
}

async function fetchWissolGasPrices() {
  try {
    const html = await getHtml(WISSOL_URL);
    const prices = parseWissolFuelPrices(html);

    const doc = new GasPrice({
      company: 'Wissol',
      source: WISSOL_URL,
      prices
    });

    await doc.save();
    logSaved('Wissol', doc.prices.length);
    return doc;
  } catch (error) {
    logError('Wissol', error);
    throw error;
  }
}

module.exports = fetchWissolGasPrices;
module.exports.parseWissolFuelPrices = parseWissolFuelPrices;
