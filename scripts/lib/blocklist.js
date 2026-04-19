/**
 * Blocklist and sanity checks for auto-generated candidate bios.
 *
 * Defense-in-depth against a template bug (unrendered `{placeholders}`,
 * stray `undefined`/`null`) or an offensive substring sneaking into a bio.
 * Invoked by both the preview CLI and the seeder; any match fails the run.
 */

// Intentionally conservative list — explicit English profanity + major slurs.
// Kept short on purpose; grow via PR if real-world content demands it.
const BLOCKED_WORDS = [
  'fuck', 'shit', 'bitch', 'cunt', 'dick', 'pussy', 'asshole',
  'nigger', 'nigga', 'faggot', 'fag', 'retard', 'retarded',
  'kike', 'spic', 'chink', 'gook', 'wetback', 'tranny',
];

// Template / code-smell markers that should never appear in a rendered bio.
const SMELL_PATTERNS = [
  { pattern: /\{[a-zA-Z_][a-zA-Z0-9_]*\}/, label: 'unrendered template placeholder' },
  { pattern: /\bundefined\b/i,              label: 'literal "undefined"' },
  { pattern: /\bnull\b/i,                   label: 'literal "null"' },
  { pattern: /\bNaN\b/,                     label: 'literal "NaN"' },
  { pattern: /  /,                          label: 'double-space' },
];

/**
 * Scan a string for blocklist hits and rendering smells.
 * @param {string} text
 * @returns {string[]} list of issue descriptions (empty = clean)
 */
function scanText(text) {
  if (typeof text !== 'string') return ['non-string value'];
  const issues = [];
  const lower = text.toLowerCase();
  for (const word of BLOCKED_WORDS) {
    const re = new RegExp(`\\b${word}\\b`, 'i');
    if (re.test(lower)) issues.push(`blocked word: ${word}`);
  }
  for (const { pattern, label } of SMELL_PATTERNS) {
    if (pattern.test(text)) issues.push(label);
  }
  return issues;
}

/**
 * Scan every string field of a bio for issues.
 * @param {{summary: string, background: string, reasonForRunning: string}} bio
 * @returns {Array<{field: string, issue: string}>}
 */
function scanBio(bio) {
  const out = [];
  for (const field of ['summary', 'background', 'reasonForRunning']) {
    for (const issue of scanText(bio[field] || '')) {
      out.push({ field, issue });
    }
  }
  return out;
}

module.exports = { scanText, scanBio, BLOCKED_WORDS };
