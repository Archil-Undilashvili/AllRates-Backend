const axios = require('axios');
const GasPrice = require('../../models/GasPrice');
const { DEFAULT_HEADERS, toNumber, logSaved, logError } = require('./utils');

const SOCAR_URL = 'https://sgp.ge/sgp-backend/api/integration/info/current-prices';

function parseSocarFuelPrices(data) {
  const currentPrices = data && data.GetCurrentPrices;
  if (!currentPrices || currentPrices.Status !== '1') {
    const message = currentPrices && currentPrices.Message ? currentPrices.Message : 'Unknown API response';
    throw new Error(`Socar prices API did not return success: ${message}`);
  }

  if (!Array.isArray(currentPrices.Results) || !currentPrices.Results.length) {
    throw new Error('Socar price rows were not found.');
  }

  return currentPrices.Results.map((item) => ({
    product: item.FuelNameGeo,
    productEng: item.FuelNameEng ? item.FuelNameEng.trim() : null,
    code: item.FuelCode,
    price: toNumber(item.FuelUnitPrice),
    currency: 'GEL',
    actionDate: item.ActionDate
  }));
}

async function fetchSocarGasPrices() {
  try {
    const { data } = await axios.get(SOCAR_URL, {
      timeout: 30000,
      headers: { ...DEFAULT_HEADERS, accept: 'application/json' }
    });

    const prices = parseSocarFuelPrices(data);
    const doc = new GasPrice({
      company: 'Socar',
      source: SOCAR_URL,
      prices
    });

    await doc.save();
    logSaved('Socar', doc.prices.length);
    return doc;
  } catch (error) {
    logError('Socar', error);
    throw error;
  }
}

module.exports = fetchSocarGasPrices;
module.exports.parseSocarFuelPrices = parseSocarFuelPrices;
