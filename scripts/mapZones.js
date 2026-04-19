#!/usr/bin/env node
/**
 * Zone mapping preview CLI — runs `zipToZone` over every candidate in
 * scripts/data/candidates-PA-{01,02}.json and emits a markdown file
 * grouped by assigned zone for QC review.
 *
 * Usage: node scripts/mapZones.js
 */

const fs = require('fs');
const path = require('path');
const { zipToZone, listZonesForDistrict } = require('./lib/zipToZone');

const DATA_DIR = path.join(__dirname, 'data');

function mapDistrict(district) {
  const src = JSON.parse(fs.readFileSync(path.join(DATA_DIR, `candidates-${district}.json`), 'utf8'));
  const zones = listZonesForDistrict(district);
  const byZone = Object.fromEntries(zones.map((z) => [z, []]));
  const defaults = [];

  for (const c of src.candidates) {
    const { zone, isDefault } = zipToZone(c.zipCode, district);
    byZone[zone].push(c);
    if (isDefault) defaults.push({ pn: c.pn, name: c.displayName, zip: c.zipCode, neighborhood: c.neighborhood, defaultZone: zone });
  }

  // Heuristic mismatch check — zone suffix appearing nowhere in neighborhood string.
  // Very weak signal; just surfaces candidates for manual review.
  const mismatches = [];
  for (const [zone, members] of Object.entries(byZone)) {
    const suffix = zone.split('-').pop(); // "north", "central", "south", "west", "center", "northeast"
    for (const c of members) {
      const nb = (c.neighborhood || '').toLowerCase();
      if (suffix === 'northeast' && !/northeast|far northeast|fox chase|lawn|torresdale|bustleton|somerton|rhawn|parkwood|normandy|olney|feltonville|frankford|mayfair|holmesburg|tacony|wissinoming/.test(nb)) {
        // too loose a check — skip
      }
      // No precise heuristic; we just note counts per zone.
    }
  }

  const lines = [];
  lines.push(`# Zone Assignment Preview — ${district}`);
  lines.push('');
  lines.push(`Generated ${new Date().toISOString()}. Review groupings; edit \`scripts/lib/zipToZone.js\` to adjust.`);
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push(`- Total candidates: **${src.candidates.length}**`);
  for (const z of zones) {
    lines.push(`- \`${z}\`: **${byZone[z].length}** candidates`);
  }
  lines.push(`- Fell back to district default: **${defaults.length}**`);
  lines.push('');
  if (defaults.length) {
    lines.push('### Fell back to default (zip code not in table)');
    for (const d of defaults) {
      lines.push(`- PN ${d.pn} — ${d.name} (${d.neighborhood}, ${d.zip}) → \`${d.defaultZone}\``);
    }
    lines.push('');
  }
  lines.push('---');
  lines.push('');

  for (const z of zones) {
    lines.push(`## \`${z}\` (${byZone[z].length})`);
    lines.push('');
    if (byZone[z].length === 0) {
      lines.push('_No candidates assigned to this zone._');
      lines.push('');
      lines.push('---');
      lines.push('');
      continue;
    }
    // Group by zip for easier scanning
    const byZip = {};
    for (const c of byZone[z]) {
      (byZip[c.zipCode] = byZip[c.zipCode] || []).push(c);
    }
    const sortedZips = Object.keys(byZip).sort();
    for (const zip of sortedZips) {
      const members = byZip[zip];
      const neighborhoods = [...new Set(members.map((c) => c.neighborhood))].join(', ');
      lines.push(`### ${zip} — ${neighborhoods}`);
      for (const c of members) {
        lines.push(`- PN ${c.pn}: ${c.displayName} (${c.neighborhood})`);
      }
      lines.push('');
    }
    lines.push('---');
    lines.push('');
  }

  const outPath = path.join(DATA_DIR, `zones-preview-${district}.md`);
  fs.writeFileSync(outPath, lines.join('\n'));
  return { district, count: src.candidates.length, outPath, defaults: defaults.length };
}

function main() {
  for (const district of ['PA-01', 'PA-02']) {
    const { count, outPath, defaults } = mapDistrict(district);
    console.log(`${district}: assigned ${count} candidates to zones, wrote ${outPath}${defaults ? `  (${defaults} fell back to default)` : ''}`);
  }
}

main();
