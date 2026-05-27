const fetchGulfGasPrices = require('./gulf');
const fetchWissolGasPrices = require('./wissol');
const fetchSocarGasPrices = require('./socar');
const fetchRompetrolGasPrices = require('./rompetrol');
const fetchLukoilGasPrices = require('./lukoil');
const fetchPortalGasPrices = require('./portal');
const fetchConnectGasPrices = require('./connect');
const fetchNeogasGasPrices = require('./neogas');

const SCRAPERS = [
  { company: 'Gulf', fetcher: fetchGulfGasPrices },
  { company: 'Wissol', fetcher: fetchWissolGasPrices },
  { company: 'Socar', fetcher: fetchSocarGasPrices },
  { company: 'Rompetrol', fetcher: fetchRompetrolGasPrices },
  { company: 'Lukoil', fetcher: fetchLukoilGasPrices },
  { company: 'Portal', fetcher: fetchPortalGasPrices },
  { company: 'Connect', fetcher: fetchConnectGasPrices },
  { company: 'Neogas', fetcher: fetchNeogasGasPrices }
];

async function fetchAllGasPrices() {
  const results = await Promise.allSettled(SCRAPERS.map((scraper) => scraper.fetcher()));

  const savedRecords = [];
  const failures = [];

  results.forEach((result, index) => {
    const company = SCRAPERS[index].company;

    if (result.status === 'fulfilled' && result.value) {
      savedRecords.push(result.value);
      return;
    }

    failures.push({
      company,
      error: result.reason ? result.reason.message : 'Unknown scraper error'
    });
  });

  savedRecords.failures = failures;
  return savedRecords;
}

module.exports = fetchAllGasPrices;
module.exports.fetchGulfGasPrices = fetchGulfGasPrices;
module.exports.fetchWissolGasPrices = fetchWissolGasPrices;
module.exports.fetchSocarGasPrices = fetchSocarGasPrices;
module.exports.fetchRompetrolGasPrices = fetchRompetrolGasPrices;
module.exports.fetchLukoilGasPrices = fetchLukoilGasPrices;
module.exports.fetchPortalGasPrices = fetchPortalGasPrices;
module.exports.fetchConnectGasPrices = fetchConnectGasPrices;
module.exports.fetchNeogasGasPrices = fetchNeogasGasPrices;
