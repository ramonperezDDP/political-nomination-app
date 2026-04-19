#!/usr/bin/env node
/**
 * Bio preview CLI — generates auto-bios for every candidate in
 * scripts/data/candidates-PA-{01,02}.json and writes a reviewable
 * markdown preview file per district, plus a stats block.
 *
 * Exits non-zero if the blocklist / smell-scan flags any bio; the
 * preview files are still written so the offending rows can be
 * located and the template iterated on.
 *
 * Usage: node scripts/buildBios.js
 */

const fs = require('fs');
const path = require('path');
const { buildBio } = require('./lib/buildBio');
const { scanBio } = require('./lib/blocklist');

const DATA_DIR = path.join(__dirname, 'data');

function buildForDistrict(district) {
  const srcPath = path.join(DATA_DIR, `candidates-${district}.json`);
  const outPath = path.join(DATA_DIR, `bios-preview-${district}.md`);
  const src = JSON.parse(fs.readFileSync(srcPath, 'utf8'));

  const rows = [];
  const flags = [];
  let sumSummaryLen = 0;
  let sumSentences = 0;
  let shortBackgroundCount = 0;

  for (const c of src.candidates) {
    const bio = buildBio(c, src.questions);
    const issues = scanBio(bio);
    if (issues.length) {
      flags.push({ pn: c.pn, name: c.displayName, issues });
    }

    sumSummaryLen += bio.summary.length;
    const sentenceCount = (bio.background.match(/[.!?](?:\s|$)/g) || []).length;
    sumSentences += sentenceCount;
    if (sentenceCount < 3) shortBackgroundCount++;

    rows.push({ candidate: c, bio, sentenceCount });
  }

  // ---- emit the markdown file ----
  const lines = [];
  lines.push(`# Bio Preview — ${district}`);
  lines.push('');
  lines.push(`Generated ${new Date().toISOString()} from \`candidates-${district}.json\`. Review wording, then iterate on \`scripts/lib/buildBio.js\`.`);
  lines.push('');
  lines.push('## Stats');
  lines.push('');
  lines.push(`- Candidates: **${src.candidates.length}**`);
  lines.push(`- Avg \`summary\` length: **${Math.round(sumSummaryLen / src.candidates.length)} chars**`);
  lines.push(`- Avg \`background\` length: **${(sumSentences / src.candidates.length).toFixed(1)} sentences**`);
  lines.push(`- Bios with short (<3 sentence) background: **${shortBackgroundCount}**`);
  lines.push(`- Blocklist / smell-scan flags: **${flags.length}**`);
  if (flags.length) {
    lines.push('');
    lines.push('### Flagged bios');
    for (const f of flags) {
      const items = f.issues.map((i) => `${i.field}: ${i.issue}`).join('; ');
      lines.push(`- PN ${f.pn} (${f.name}) — ${items}`);
    }
  }
  lines.push('');
  lines.push('---');
  lines.push('');

  for (const { candidate: c, bio } of rows) {
    lines.push(`## PN ${c.pn} — ${c.displayName}`);
    lines.push('');
    lines.push(`**${c.age}** · **${c.gender}** · **${c.ethnicity}** · ${c.neighborhood} (${c.zipCode}) · img \`${c.imageFilename}\``);
    lines.push('');
    lines.push(`**summary:** ${bio.summary}`);
    lines.push('');
    lines.push(`**background:** ${bio.background}`);
    lines.push('');
    lines.push(`**reasonForRunning:** ${bio.reasonForRunning}`);
    lines.push('');
    lines.push('---');
    lines.push('');
  }

  fs.writeFileSync(outPath, lines.join('\n'));
  return { district, count: src.candidates.length, outPath, flags: flags.length };
}

function main() {
  let totalFlags = 0;
  for (const district of ['PA-01', 'PA-02']) {
    const { count, outPath, flags } = buildForDistrict(district);
    totalFlags += flags;
    console.log(`${district}: wrote ${count} bios to ${outPath}${flags ? `  (${flags} FLAGGED)` : ''}`);
  }
  if (totalFlags > 0) {
    console.error(`\n${totalFlags} bio(s) flagged by the blocklist / smell-scan. Review the preview files and fix scripts/lib/buildBio.js before seeding.`);
    process.exit(1);
  }
}

main();
