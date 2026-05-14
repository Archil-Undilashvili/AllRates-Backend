const GasPrice = require('../../models/GasPrice');
const { getHtml, stripTags, toNumber, logSaved, logError } = require('./utils');

const ROMPETROL_URL = 'https://www.rompetrol.ge/';

function parseRompetrolFuelPrices(html) {
  const priceSectionMatch = String(html).match(/<a\s+id=["']pricelist["'][^>]*><\/a>([\s\S]*?)<\/section>/i);
  if (!priceSectionMatch) throw new Error('Rompetrol price section was not found.');

  const prices = [...priceSectionMatch[1].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)]
    .map((rowMatch) => {
      const cells = [...rowMatch[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)]
        .map((match) => stripTags(match[1]));

      if (cells.length < 2) return null;

      return {
        product: cells[0],
        price: toNumber(cells[1]),
        currency: 'GEL'
      };
    })
    .filter(Boolean);

  if (!prices.length) throw new Error('Rompetrol price rows were not found.');
  return prices;
}

async function fetchRompetrolGasPrices() {
  try {
    const html = await getHtml(ROMPETROL_URL);
    const prices = parseRompetrolFuelPrices(html);

    const doc = new GasPrice({
      company: 'Rompetrol',
      source: ROMPETROL_URL,
      prices
    });

    await doc.save();
    logSaved('Rompetrol', doc.prices.length);
    return doc;
  } catch (error) {
    logError('Rompetrol', error);
    return null;
  }
}

module.exports = fetchRompetrolGasPrices;
module.exports.parseRompetrolFuelPrices = parseRompetrolFuelPrices;
