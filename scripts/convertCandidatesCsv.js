#!/usr/bin/env node
/**
 * Converts scripts/data/candidates-PA-XX.csv into JSON ready for Firestore
 * ingestion or hand-editing.
 *
 * Run: node scripts/convertCandidatesCsv.js
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');

// Question definitions.
// `csvCols` lists the data-column indexes (0-based) whose "X" marker corresponds
// to each option, in the same order as `options`. Spectrum values and shortLabels
// mirror the seeded question documents in src/services/firebase/firestore.ts.
const SHARED_QUESTIONS = [
  {
    id: 'trade-1',
    issueId: 'trade',
    csvCols: [8, 9, 10],
    options: [
      { shortLabel: 'Free Trade',    spectrumValue: -80 },
      { shortLabel: 'Limited Trade', spectrumValue:   0 },
      { shortLabel: 'Protection',    spectrumValue:  80 },
    ],
  },
  {
    id: 'iran-1',
    issueId: 'iran',
    csvCols: [12, 13, 14],
    options: [
      { shortLabel: 'No Involvement',   spectrumValue: -80 },
      { shortLabel: 'Limited Response', spectrumValue:   0 },
      { shortLabel: 'Escalation',       spectrumValue:  80 },
    ],
  },
  {
    id: 'inflation-1',
    issueId: 'inflation',
    csvCols: [16, 17, 18],
    options: [
      { shortLabel: 'Regulation',            spectrumValue: -70 },
      { shortLabel: 'Strengthen Production', spectrumValue:   0 },
      { shortLabel: 'Fiscal Policy',         spectrumValue:  70 },
    ],
  },
  {
    id: 'borders-1',
    issueId: 'borders',
    csvCols: [20, 21, 22],
    options: [
      { shortLabel: 'Open',            spectrumValue: -80 },
      { shortLabel: 'Partially Close', spectrumValue:   0 },
      { shortLabel: 'Close',           spectrumValue:  80 },
    ],
  },
  {
    id: 'welfare-1',
    issueId: 'welfare',
    csvCols: [24, 25, 26],
    options: [
      { shortLabel: 'Socialize', spectrumValue: -80 },
      { shortLabel: 'Maintain',  spectrumValue:   0 },
      { shortLabel: 'Privatize', spectrumValue:  80 },
    ],
  },
];

const DISTRICT_QUESTIONS = {
  'PA-01': [
    {
      id: 'pa01-infrastructure-1',
      issueId: 'pa01-infrastructure',
      csvCols: [28, 30],
      options: [
        { shortLabel: 'Yes', spectrumValue: -50 },
        { shortLabel: 'No',  spectrumValue:  50 },
      ],
    },
    {
      id: 'pa01-housing-1',
      issueId: 'pa01-housing',
      csvCols: [32, 34],
      options: [
        { shortLabel: 'Yes', spectrumValue: -50 },
        { shortLabel: 'No',  spectrumValue:  50 },
      ],
    },
  ],
  'PA-02': [
    {
      id: 'pa02-budget-1',
      issueId: 'pa02-budget',
      csvCols: [28, 30],
      options: [
        { shortLabel: 'Yes', spectrumValue:  50 },
        { shortLabel: 'No',  spectrumValue: -50 },
      ],
    },
    {
      id: 'pa02-transit-1',
      issueId: 'pa02-transit',
      csvCols: [32, 34],
      options: [
        { shortLabel: 'Yes', spectrumValue: -50 },
        { shortLabel: 'No',  spectrumValue:  50 },
      ],
    },
  ],
};

// Minimal RFC-4180-ish CSV parser — handles quoted fields and embedded commas.
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else { inQuotes = false; }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field); field = '';
    } else if (c === '\n') {
      row.push(field); field = '';
      rows.push(row); row = [];
    } else if (c === '\r') {
      // ignore
    } else {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function normalizeGender(s) {
  const g = (s || '').trim().toLowerCase();
  if (g === 'male' || g === 'female' || g === 'non-binary') return g;
  return 'prefer-not-to-say';
}

function parseIntOrNull(s) {
  const t = (s || '').trim();
  if (!t) return null;
  const n = parseInt(t, 10);
  return Number.isFinite(n) ? n : null;
}

function convertFile(district) {
  const csvPath = path.join(DATA_DIR, `candidates-${district}.csv`);
  const jsonPath = path.join(DATA_DIR, `candidates-${district}.json`);
  const text = fs.readFileSync(csvPath, 'utf8');
  const rows = parseCsv(text);

  const questions = [...SHARED_QUESTIONS, ...DISTRICT_QUESTIONS[district]];

  // Data rows: those whose PN column (index 6) is a positive integer.
  const dataRows = rows.filter((r) => /^\d+$/.test((r[6] || '').trim()));

  const candidates = dataRows.map((r) => {
    const firstName = (r[36] || '').trim();
    const lastName = (r[37] || '').trim();
    const age = parseIntOrNull(r[38]);
    const gender = normalizeGender(r[39]);
    const ethnicity = (r[40] || '').trim();
    const neighborhood = (r[41] || '').trim();
    const zipCode = (r[42] || '').trim();
    const imageFilename = (r[43] || '').trim();
    const pn = parseInt(r[6], 10);

    const endorsements = {
      start: parseIntOrNull(r[0]),
      afterTop20: parseIntOrNull(r[1]),
      afterTop10: parseIntOrNull(r[2]),
      afterVTH: parseIntOrNull(r[3]),
      afterDebate: parseIntOrNull(r[4]),
      winner: parseIntOrNull(r[5]),
    };

    const quizResponses = questions.map((q) => {
      let selectedIdx = -1;
      for (let i = 0; i < q.csvCols.length; i++) {
        if ((r[q.csvCols[i]] || '').trim().toUpperCase() === 'X') {
          selectedIdx = i;
          break;
        }
      }
      const opt = selectedIdx >= 0 ? q.options[selectedIdx] : null;
      return {
        questionId: q.id,
        issueId: q.issueId,
        answer: opt ? opt.spectrumValue : null,
        optionShortLabel: opt ? opt.shortLabel : null,
      };
    });

    const missing = quizResponses.filter((a) => a.answer === null).map((a) => a.questionId);

    return {
      pn,
      firstName,
      lastName,
      displayName: `${firstName} ${lastName}`.trim(),
      age,
      gender,
      ethnicity,
      neighborhood,
      zipCode,
      district,
      imageFilename,
      endorsements,
      quizResponses,
      ...(missing.length ? { _missingAnswers: missing } : {}),
    };
  });

  const output = {
    district,
    generatedAt: new Date().toISOString(),
    questions: questions.map((q) => ({
      id: q.id,
      issueId: q.issueId,
      options: q.options,
    })),
    candidates,
  };

  fs.writeFileSync(jsonPath, JSON.stringify(output, null, 2) + '\n');
  return { district, count: candidates.length, path: jsonPath, missing: candidates.filter((c) => c._missingAnswers).length };
}

function main() {
  for (const district of ['PA-01', 'PA-02']) {
    const { count, path: out, missing } = convertFile(district);
    console.log(`${district}: wrote ${count} candidates to ${out}${missing ? `  (${missing} with missing answers)` : ''}`);
  }
}

main();
