const GasPrice = require('../../models/GasPrice');
const { getHtml, stripTags, toNumber, logSaved, logError } = require('./utils');

const CONNECT_URL = 'https://connect.com.ge/';

function parseConnectPriceCard(cardHtml) {
  const productMatch = String(cardHtml).match(/class=["'][^"']*(?:fpc-card-name|fpc-feat-name)[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
  if (!productMatch) return null;

  const standardMatch = String(cardHtml).match(/class=["'][^"']*(?:fpc-pstd|fpc-feat-std)[^"']*["'][^>]*>([\s\S]*?)<\/span>/i);
  const selfServiceMatch = String(cardHtml).match(/class=["'][^"']*(?:fpc-pself|fpc-feat-self)[^"']*["'][^>]*>([\s\S]*?)<\/span>/i);

  return {
    product: stripTags(productMatch[1]),
    standardPrice: standardMatch ? toNumber(stripTags(standardMatch[1])) : null,
    selfServicePrice: selfServiceMatch ? toNumber(stripTags(selfServiceMatch[1])) : null,
    currency: 'GEL'
  };
}

function parseConnectFuelPrices(html) {
  const pageHtml = String(html);
  const featuredCards = [...pageHtml.matchAll(/<div[^>]*class=["'][^"']*fpc-featured[^"']*["'][^>]*>([\s\S]*?)<\/div>\s*<\/div>/gi)]
    .map((match) => parseConnectPriceCard(match[0]));

  const regularCards = [...pageHtml.matchAll(/<div[^>]*class=["'][^"']*fpc-card[^"']*["'][^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/gi)]
    .map((match) => parseConnectPriceCard(match[0]));

  const prices = [...featuredCards, ...regularCards]
    .filter(Boolean)
    .filter((price, index, all) => all.findIndex((item) => item.product === price.product) === index);

  if (!prices.length) throw new Error('Connect price cards were not found.');
  return prices;
}

async function fetchConnectGasPrices() {
  try {
    const html = await getHtml(CONNECT_URL);
    const prices = parseConnectFuelPrices(html);

    const doc = new GasPrice({
      company: 'Connect',
      source: CONNECT_URL,
      prices
    });

    await doc.save();
    logSaved('Connect', doc.prices.length);
    return doc;
  } catch (error) {
    logError('Connect', error);
    throw error;
  }
}

module.exports = fetchConnectGasPrices;
module.exports.parseConnectFuelPrices = parseConnectFuelPrices;
