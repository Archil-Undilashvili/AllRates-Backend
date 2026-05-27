const https = require('https');
const GasPrice = require('../../models/GasPrice');
const { getHtml, stripTags, toNumber, logSaved, logError } = require('./utils');

const NEOGAS_URL = 'https://neogas.ge/ka/stations';
const TARGET_ADDRESS_KEYWORD = 'უნივერსიტეტის';
const NEOGAS_HTTPS_AGENT = new https.Agent({ rejectUnauthorized: false });

function parseNeogasFuelPrices(html) {
  const rows = [...String(html).matchAll(/<span[^>]*class=["']district["'][^>]*>([\s\S]*?)<\/span>[\s\S]*?<h1[^>]*class=["']address["'][^>]*>([\s\S]*?)<\/h1>/gi)];

  const targetRow = rows
    .map((match) => ({
      district: stripTags(match[1]),
      address: stripTags(match[2])
    }))
    .find((row) => row.address.includes(TARGET_ADDRESS_KEYWORD));

  if (!targetRow) throw new Error('Neogas target station was not found.');

  const prices = targetRow.district
    .split('|')
    .map((part) => {
      const match = part.match(/\s*(CNG|LPG)\s*-\s*([\d.,]+)/i);
      if (!match) return null;

      return {
        product: match[1].toUpperCase(),
        price: toNumber(match[2]),
        currency: 'GEL',
        details: {
          address: targetRow.address
        }
      };
    })
    .filter(Boolean);

  if (!prices.length) throw new Error('Neogas target station prices were not found.');
  return prices;
}

async function fetchNeogasGasPrices() {
  try {
    const html = await getHtml(NEOGAS_URL, { httpsAgent: NEOGAS_HTTPS_AGENT });
    const prices = parseNeogasFuelPrices(html);

    const doc = new GasPrice({
      company: 'Neogas',
      source: NEOGAS_URL,
      prices
    });

    await doc.save();
    logSaved('Neogas', doc.prices.length);
    return doc;
  } catch (error) {
    logError('Neogas', error);
    throw error;
  }
}

module.exports = fetchNeogasGasPrices;
module.exports.parseNeogasFuelPrices = parseNeogasFuelPrices;
