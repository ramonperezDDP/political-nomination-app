/**
 * zipToZone — map a candidate's zip code to one of the district's zones.
 *
 * First-cut geography, hand-authored. Edit freely; the `mapZones.js` CLI
 * writes a preview so the output can be QC'd before the seeder consumes it.
 *
 * PA-01 covers parts of Bucks/Montgomery counties. Zones: pa01-north,
 *   pa01-central, pa01-south.
 * PA-02 covers Philadelphia. Zones: pa02-west, pa02-center, pa02-northeast,
 *   pa02-south.
 *
 * Unknown zip codes fall back to the district's default (center-ish) and
 * are surfaced as a warning in the preview.
 */

// PA-01 — Bucks County + adjacent. Rough geographic split.
const PA01_ZIP_TO_ZONE = {
  // Upper Bucks / outlying north
  '17057': 'pa01-north', // Middletown (outlier)
  '17087': 'pa01-north', // Richland (outlier)
  '18039': 'pa01-north', // Durham
  '18041': 'pa01-north', // East Greenfield / Upper Hanover
  '18054': 'pa01-north', // Marlborough Township
  '18067': 'pa01-north', // Northampton
  '18073': 'pa01-north', // Pennsburg
  '18076': 'pa01-north', // Red Hill
  '18077': 'pa01-north', // Riegelsville
  '18337': 'pa01-north', // Milford (PA)
  '18615': 'pa01-north', // Falls (outlier)
  '18901': 'pa01-north', // Doylestown
  '18910': 'pa01-north', // Bedminster
  '18912': 'pa01-north', // Buckingham
  '18913': 'pa01-north', // Carversville
  '18917': 'pa01-north', // Dublin
  '18924': 'pa01-north', // Franconia Township
  '18935': 'pa01-north', // Milford Square
  '18942': 'pa01-north', // Ottsville / Harrow
  '18944': 'pa01-north', // Perkasie / Elephant
  '18947': 'pa01-north', // Pipersville
  '18951': 'pa01-north', // Quakertown area
  '18953': 'pa01-north', // Revere
  '18955': 'pa01-north', // Richlandtown
  '18957': 'pa01-north', // Salford Township
  '18960': 'pa01-north', // Sellersville / West Rockhill
  '18962': 'pa01-north', // Silverdale
  '18963': 'pa01-north', // Solebury
  '18964': 'pa01-north', // Souderton
  '18968': 'pa01-north', // Spinnerstown
  '18969': 'pa01-north', // Telford
  '18970': 'pa01-north', // Trumbauersville
  '18972': 'pa01-north', // Bridgeton / Nockamixon
  '18976': 'pa01-north', // Warrington (upper edge)

  // Central Bucks / middle
  '18914': 'pa01-central', // Chalfont / Eureka
  '18925': 'pa01-central', // Furlong
  '18927': 'pa01-central', // Hilltown
  '18938': 'pa01-central', // New Hope / Hood
  '18940': 'pa01-central', // Newtown / Upper Makefield / Wrightstown
  '18949': 'pa01-central', // Plumstead / Plumsteadville
  '18956': 'pa01-central', // Rushland
  '18966': 'pa01-central', // Upper Southampton / Churchville / Holland
  '18974': 'pa01-central', // Ivyland / Warminster
  '19002': 'pa01-central', // Mapleglen
  '19044': 'pa01-central', // Horsham Township
  '19440': 'pa01-central', // Hatfield
  '19454': 'pa01-central', // Montgomery Township

  // Lower Bucks / south
  '19007': 'pa01-south', // Bristol / Tullytown
  '19020': 'pa01-south', // Bensalem / Cornwell Heights / Eddington
  '19021': 'pa01-south', // Croydon
  '19029': 'pa01-south', // Tinicum
  '19030': 'pa01-south', // Fairless Hills / Oxford Valley
  '19047': 'pa01-south', // Langhorne / Penndel / Woodbourne / Hulmeville
  '19053': 'pa01-south', // Lower Southampton / Feasterville / Trevose
  '19057': 'pa01-south', // Levittown
  '19064': 'pa01-south', // Springfield
  '19067': 'pa01-south', // Yardley / Morrisville / Lower Makefield
  '19520': 'pa01-south', // Warwick (outlier)
};

// PA-02 — Philadelphia. Zones: west, center, northeast, south.
const PA02_ZIP_TO_ZONE = {
  // Northeast Philly
  '19111': 'pa02-northeast', // Fox Chase / Lawncrest / Lawndale
  '19114': 'pa02-northeast', // Academy Gardens / Torresdale / Millbrook
  '19115': 'pa02-northeast', // Bustleton / Krewstown
  '19116': 'pa02-northeast', // Somerton
  '19136': 'pa02-northeast', // Holmesburg
  '19135': 'pa02-northeast', // Tacony / Wissinoming
  '19152': 'pa02-northeast', // Rhawnhurst
  '19154': 'pa02-northeast', // Parkwood / Normandy
  '19120': 'pa02-northeast', // Olney / Feltonville
  '19124': 'pa02-northeast', // Frankford / Mayfair

  // Center / North Philly core
  '19102': 'pa02-center',  // Center City
  '19107': 'pa02-center',  // Center City (East)
  '19121': 'pa02-center',  // North Philly East
  '19122': 'pa02-center',  // East Kensington / Norris Square / Yorktown
  '19123': 'pa02-center',  // Ashton Wooden Bridge / Poplar
  '19125': 'pa02-center',  // Fishtown / Port Richmond / Olde Richmond
  '19132': 'pa02-center',  // Glenwood / N. Philly West
  '19133': 'pa02-center',  // Fairhill / Hartranft / W. Kensington
  '19134': 'pa02-center',  // Harrowgate
  '19137': 'pa02-center',  // Bridesburg / Wissinoming
  '19140': 'pa02-center',  // Hunting Park
  '19141': 'pa02-center',  // Logan / Ogontz / Fern Rock

  // West / Northwest Philly
  '19128': 'pa02-west',    // Roxborough / Manayunk / Lexington Park

  // South Philly — no zip codes present in data today
  // Outliers (not truly in PA-02)
  '16683': 'pa02-center',  // Franklinville (Centre County, PA — geographic outlier)
};

const DISTRICT_DEFAULTS = {
  'PA-01': 'pa01-central',
  'PA-02': 'pa02-center',
};

/**
 * Map a zip code to a zone ID.
 * @param {string} zipCode
 * @param {string} district — 'PA-01' or 'PA-02'
 * @returns {{ zone: string, isDefault: boolean }}
 */
function zipToZone(zipCode, district) {
  const table = district === 'PA-01' ? PA01_ZIP_TO_ZONE : PA02_ZIP_TO_ZONE;
  const zone = table[zipCode];
  if (zone) return { zone, isDefault: false };
  return { zone: DISTRICT_DEFAULTS[district], isDefault: true };
}

function listZonesForDistrict(district) {
  if (district === 'PA-01') return ['pa01-north', 'pa01-central', 'pa01-south'];
  return ['pa02-west', 'pa02-center', 'pa02-northeast', 'pa02-south'];
}

module.exports = { zipToZone, listZonesForDistrict, PA01_ZIP_TO_ZONE, PA02_ZIP_TO_ZONE, DISTRICT_DEFAULTS };
