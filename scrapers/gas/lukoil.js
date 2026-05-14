const GasPrice = require('../../models/GasPrice');
const { getHtml, stripTags, toNumber, logSaved, logError } = require('./utils');

const LUKOIL_URL = 'https://www.lukoil.ge/';

function parseLukoilFuelPrices(html) {
  const priceBlockMatch = String(html).match(/<div[^>]*lg:grid-cols-5[\s\S]*?<\/div>\s*<div[^>]*>\s*<a\s+href=["']\/prices-history["']/i);
  if (!priceBlockMatch) throw new Error('Lukoil price cards block was not found.');

  const prices = [...priceBlockMatch[0].matchAll(/<span[^>]*border-\[1px\][\s\S]*?<\/span>/gi)]
    .map((cardMatch) => {
      const values = [...cardMatch[0].matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
        .map((match) => stripTags(match[1]))
        .filter(Boolean);

      if (values.length < 2) return null;

      return {
        product: values.slice(1).join(' '),
        price: toNumber(values[0]),
        currency: 'GEL'
      };
    })
    .filter(Boolean);

  if (!prices.length) throw new Error('Lukoil price rows were not found.');
  return prices;
}

async function fetchLukoilGasPrices() {
  try {
    const html = await getHtml(LUKOIL_URL);
    const prices = parseLukoilFuelPrices(html);

    const doc = new GasPrice({
      company: 'Lukoil',
      source: LUKOIL_URL,
      prices
    });

    await doc.save();
    logSaved('Lukoil', doc.prices.length);
    return doc;
  } catch (error) {
    logError('Lukoil', error);
    throw error;
  }
}

module.exports = fetchLukoilGasPrices;
module.exports.parseLukoilFuelPrices = parseLukoilFuelPrices;
