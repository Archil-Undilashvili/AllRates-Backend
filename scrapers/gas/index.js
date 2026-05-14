const fetchGulfGasPrices = require('./gulf');
const fetchWissolGasPrices = require('./wissol');
const fetchSocarGasPrices = require('./socar');
const fetchRompetrolGasPrices = require('./rompetrol');
const fetchLukoilGasPrices = require('./lukoil');
const fetchPortalGasPrices = require('./portal');

async function fetchAllGasPrices() {
  const results = await Promise.allSettled([
    fetchGulfGasPrices(),
    fetchWissolGasPrices(),
    fetchSocarGasPrices(),
    fetchRompetrolGasPrices(),
    fetchLukoilGasPrices(),
    fetchPortalGasPrices()
  ]);

  return results
    .filter((result) => result.status === 'fulfilled' && result.value)
    .map((result) => result.value);
}

module.exports = fetchAllGasPrices;
module.exports.fetchGulfGasPrices = fetchGulfGasPrices;
module.exports.fetchWissolGasPrices = fetchWissolGasPrices;
module.exports.fetchSocarGasPrices = fetchSocarGasPrices;
module.exports.fetchRompetrolGasPrices = fetchRompetrolGasPrices;
module.exports.fetchLukoilGasPrices = fetchLukoilGasPrices;
module.exports.fetchPortalGasPrices = fetchPortalGasPrices;
