const GasPrice = require('../../models/GasPrice');
const { getHtml, stripTags, toNumber, logSaved, logError } = require('./utils');

const GULF_URL = 'https://gulf.ge/ge/fuel_prices';

function parseGulfFuelPrices(html) {
  const visibleHtml = String(html).replace(/<!--[\s\S]*?-->/g, '');
  const headerMatch = visibleHtml.match(/<tr[^>]*class=["'][^"']*prices_header[^"']*["'][^>]*>([\s\S]*?)<\/tr>/i);
  if (!headerMatch) throw new Error('Gulf price table header was not found.');

  const headers = [...headerMatch[1].matchAll(/<span[^>]*class=["']normal["'][^>]*>([\s\S]*?)<\/span>/gi)]
    .map((match) => stripTags(match[1]))
    .filter(Boolean);

  const rowMatch = visibleHtml.match(/<tr[^>]*class=["'][^"']*prices_cnt[^"']*["'][^>]*>([\s\S]*?)<\/tr>/i);
  if (!rowMatch) throw new Error('Gulf latest price row was not found.');

  const cells = [...rowMatch[1].matchAll(/<td[^>]*>\s*<span>([\s\S]*?)<\/span>\s*<\/td>/gi)]
    .map((match) => stripTags(match[1]));

  const [latestDate, ...priceCells] = cells;
  const prices = headers.slice(1).map((product, index) => ({
    product,
    price: toNumber(priceCells[index]),
    currency: 'GEL'
  }));

  return { latestDate, prices };
}

async function fetchGulfGasPrices() {
  try {
    const html = await getHtml(GULF_URL);
    const parsed = parseGulfFuelPrices(html);

    const doc = new GasPrice({
      company: 'Gulf',
      source: GULF_URL,
      latestDate: parsed.latestDate,
      prices: parsed.prices
    });

    await doc.save();
    logSaved('Gulf', doc.prices.length);
    return doc;
  } catch (error) {
    logError('Gulf', error);
    return null;
  }
}

module.exports = fetchGulfGasPrices;
module.exports.parseGulfFuelPrices = parseGulfFuelPrices;
