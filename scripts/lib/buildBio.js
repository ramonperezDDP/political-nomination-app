/**
 * buildBio — deterministic candidate-bio generator.
 *
 * Given a candidate record (from scripts/data/candidates-PA-XX.json) and the
 * question schema, returns { summary, background, reasonForRunning }.
 * Ethnicity is available as internal modeling context but is NEVER rendered
 * into prose. Nothing is fabricated: education/experience are left empty.
 *
 * Consumed by both the preview CLI (scripts/buildBios.js) and the seeder
 * (scripts/seedCandidatesFromJson.ts). Pure function, no I/O.
 */

// Gender → subject/possessive pronoun pair used in bio prose.
// Non-binary / prefer-not-to-say defaults to singular they/their.
function pronouns(gender) {
  switch ((gender || '').toLowerCase()) {
    case 'male':   return { subj: 'he',   poss: 'his'   };
    case 'female': return { subj: 'she',  poss: 'her'   };
    default:       return { subj: 'they', poss: 'their' };
  }
}

// District → county label used in sentence 1 of `background`.
const DISTRICT_LABEL = {
  'PA-01': "Bucks and Montgomery counties' PA-01 district",
  'PA-02': "Philadelphia's PA-02 district",
};

// `issueId` → short phrase used after `optionShortLabel` for the 5 shared
// 3-option questions, e.g. "Protection on trade".
const SHARED_ISSUE_PHRASE = {
  'trade':     'trade',
  'iran':      'Iran policy',
  'inflation': 'inflation',
  'borders':   'borders',
  'welfare':   'social programs',
};

// Local (district-specific) binary questions: per-question Yes/No paraphrases
// used in sentence 3 of `background`. These expand the Yes/No label into a
// full, neutral noun phrase referring to the stated policy position.
const LOCAL_POSITION_PHRASE = {
  'pa01-infrastructure': {
    Yes: 'federal flood-mitigation funding',
    No:  'locally-funded stormwater projects',
  },
  'pa01-housing': {
    Yes: 'stricter environmental standards for new homes',
    No:  'fewer restrictions on new home construction',
  },
  'pa02-budget': {
    Yes: 'partner-match requirements on violence-prevention grants',
    No:  'unconditional violence-prevention grants',
  },
  'pa02-transit': {
    Yes: 'federal funding for light-rail safety improvements',
    No:  'locally-funded light-rail safety',
  },
};

/**
 * Build an index of questionId → { issueId, options } from a schema array.
 * @param {Array<{id: string, issueId: string, options: Array<{shortLabel: string, spectrumValue: number}>}>} questions
 */
function indexQuestions(questions) {
  const idx = {};
  for (const q of questions) idx[q.id] = q;
  return idx;
}

/**
 * Join a list of strings with an Oxford comma (1 → "a"; 2 → "a and b"; 3 → "a, b, and c").
 */
function oxfordJoin(parts) {
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(', ')}, and ${parts[parts.length - 1]}`;
}

/**
 * Pick the top N shared-question responses by |spectrumValue|.
 * Stable tie-break by the quiz order (input array order).
 */
function topSharedResponses(responses, n) {
  return responses
    .filter((r) => SHARED_ISSUE_PHRASE[r.issueId])
    .map((r, i) => ({ ...r, _order: i }))
    .sort((a, b) => {
      const d = Math.abs(b.answer || 0) - Math.abs(a.answer || 0);
      if (d !== 0) return d;
      return a._order - b._order;
    })
    .slice(0, n);
}

/**
 * Describe a candidate's shared-question position as "Protection on trade".
 */
function sharedPhrase(resp) {
  return `${resp.optionShortLabel} on ${SHARED_ISSUE_PHRASE[resp.issueId]}`;
}

/**
 * Describe a candidate's local-question stance as a noun phrase, or null if
 * the question / answer combination isn't in our map (unexpected).
 */
function localPhrase(resp) {
  const map = LOCAL_POSITION_PHRASE[resp.issueId];
  if (!map) return null;
  return map[resp.optionShortLabel] || null;
}

/**
 * Core: build the three bio fields for a single candidate.
 * @param {Object} candidate
 * @param {Array}  questions — the district's question schema (7 entries)
 */
function buildBio(candidate, questions) {
  const { firstName, displayName, age, gender, neighborhood, district, quizResponses } = candidate;
  const { subj, poss } = pronouns(gender);
  const questionIdx = indexQuestions(questions);

  // ---- summary (one sentence, factual) ----
  const summary = `${displayName}, ${age}, is a candidate from ${neighborhood} in ${district}.`;

  // ---- background, sentence 1: geography + age ----
  const districtLabel = DISTRICT_LABEL[district] || district;
  const bg1 = `${firstName} is a ${age}-year-old running in ${districtLabel}, home-based in ${neighborhood}.`;

  // ---- background, sentence 2: top shared-question positions ----
  const topShared = topSharedResponses(quizResponses || [], 3);
  let bg2;
  if (topShared.length >= 2) {
    const phrases = topShared.map(sharedPhrase);
    bg2 = `${cap(poss)} platform leads with ${oxfordJoin(phrases)}.`;
  } else if (topShared.length === 1) {
    bg2 = `${cap(poss)} platform centers on ${sharedPhrase(topShared[0])}.`;
  } else {
    bg2 = `${cap(subj)} hasn't staked out strong positions on the national questions.`;
  }

  // ---- background, sentence 3 (optional): local-question stance ----
  const localResponses = (quizResponses || [])
    .filter((r) => LOCAL_POSITION_PHRASE[r.issueId])
    .map(localPhrase)
    .filter((p) => p !== null);
  let bg3 = '';
  if (localResponses.length >= 2) {
    bg3 = ` Locally, ${subj} backs ${oxfordJoin(localResponses)}.`;
  } else if (localResponses.length === 1) {
    bg3 = ` Locally, ${subj} backs ${localResponses[0]}.`;
  }

  const background = `${bg1} ${bg2}${bg3}`.trim();

  // ---- reasonForRunning (one sentence, top 3 shared positions) ----
  let reasonForRunning;
  if (topShared.length >= 1) {
    const phrases = topShared.map(sharedPhrase);
    reasonForRunning = `${firstName} is running on ${oxfordJoin(phrases)}.`;
  } else {
    reasonForRunning = `${firstName} is running to represent ${neighborhood}.`;
  }

  return { summary, background, reasonForRunning };
}

/** Capitalize the first letter of a short word ("her" → "Her"). */
function cap(s) {
  if (!s) return s;
  return s[0].toUpperCase() + s.slice(1);
}

module.exports = { buildBio, indexQuestions };
