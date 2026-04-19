/**
 * buildBio — deterministic candidate-bio generator.
 *
 * Given a candidate record (from scripts/data/candidates-PA-XX.json) and the
 * question schema, returns { summary, background, reasonForRunning }.
 *
 * Style inspiration: the legacy hardcoded bios (`seedCandidates()` in
 * src/services/firebase/firestore.ts) lead with a professional identity
 * + a short career sketch + a motivation-forward reasonForRunning. This
 * generator captures that tone without political-archetype framing
 * (no "progressive" / "conservative" / "libertarian" / "hawk" labels)
 * and without restating quiz answers.
 *
 * Ethnicity is available as internal modeling context but is NEVER
 * rendered into prose. Outputs are deterministic: the same candidate
 * always produces the same bio, so re-runs are idempotent.
 */

// ==================== DETERMINISTIC SELECTION ====================

function seedOf(candidate) {
  const districtInt = candidate.district === 'PA-02' ? 2 : 1;
  // Simple mix; we just need stable per-candidate selection, not crypto.
  return (candidate.pn * 2654435761 + districtInt * 1013904223) >>> 0;
}
function pick(seed, salt, pool) {
  const idx = (seed ^ (salt * 16777619)) >>> 0;
  return pool[idx % pool.length];
}

// ==================== POOLS ====================

// Professional archetypes. Each is policy-neutral; the distribution is
// not correlated with quiz answers.
//   article   — 'a' or 'an'
//   noun      — short identity used in summary and background
//   careerFmt — (firstName, yrs) => "..."; produces one sentence
//   tenureMin — minimum years to allow this archetype (filters out
//               young candidates from retired / veteran roles)
const PROFESSIONS = [
  {
    article: 'a', noun: 'public-school teacher',
    tenureMin: 2,
    careerFmt: (n, y) => `${n} has taught in local public schools for ${y} years.`,
  },
  {
    article: 'a', noun: 'small-business owner',
    tenureMin: 3,
    careerFmt: (n, y) => `${n} has run a neighborhood business for ${y} years, employing local residents along the way.`,
  },
  {
    article: 'a', noun: 'nurse',
    tenureMin: 2,
    careerFmt: (n, y) => `${n} has worked as a nurse for ${y} years at community hospitals across the district.`,
  },
  {
    article: 'a', noun: 'social worker',
    tenureMin: 2,
    careerFmt: (n, y) => `${n} has spent ${y} years as a social worker, most of them supporting families and kids in the district.`,
  },
  {
    article: 'an', noun: 'electrician',
    tenureMin: 3,
    careerFmt: (n, y) => `${n} has worked the trades as an electrician for ${y} years and runs a small crew of apprentices.`,
  },
  {
    article: 'a', noun: 'community organizer',
    tenureMin: 3,
    careerFmt: (n, y) => `${n} has organized neighbors around local issues for ${y} years, from township meetings to door-knocking on weekends.`,
  },
  {
    article: 'a', noun: 'paramedic',
    tenureMin: 3,
    careerFmt: (n, y) => `${n} has been a paramedic for ${y} years, answering calls across the district at all hours.`,
  },
  {
    article: 'a', noun: 'librarian',
    tenureMin: 2,
    careerFmt: (n, y) => `${n} runs youth programming at the public library and has worked there for ${y} years.`,
  },
  {
    article: 'an', noun: 'accountant',
    tenureMin: 3,
    careerFmt: (n, y) => `${n} has spent ${y} years as an accountant, mostly helping small businesses and families make sense of their finances.`,
  },
  {
    article: 'a', noun: 'civil engineer',
    tenureMin: 3,
    careerFmt: (n, y) => `${n} has worked on infrastructure projects across the district for ${y} years as a civil engineer.`,
  },
  {
    article: 'a', noun: 'farmer',
    tenureMin: 5,
    careerFmt: (n, y) => `${n} has farmed the same land for ${y} years and is active in the county agricultural co-op.`,
  },
  {
    article: 'a', noun: 'retail manager',
    tenureMin: 2,
    careerFmt: (n, y) => `${n} manages a local store and has been part of the neighborhood's retail community for ${y} years.`,
  },
  {
    article: 'a', noun: 'veteran',
    tenureMin: 6, // requires enough life runway for military service + civilian career
    ageMin: 30,
    careerFmt: (n, y) => `${n} served in the armed forces before coming home to the district and now works in the local trades.`,
  },
  {
    article: 'a', noun: 'nonprofit director',
    tenureMin: 4,
    careerFmt: (n, y) => `${n} leads a neighborhood nonprofit focused on housing and community development.`,
  },
  {
    article: 'a', noun: 'carpenter',
    tenureMin: 3,
    careerFmt: (n, y) => `${n} has worked as a carpenter for ${y} years, building and repairing homes across the district.`,
  },
  {
    article: 'a', noun: 'school counselor',
    tenureMin: 3,
    careerFmt: (n, y) => `${n} has spent ${y} years as a school counselor, sitting with students and families through hard moments.`,
  },
  {
    article: 'a', noun: 'truck driver',
    tenureMin: 3,
    careerFmt: (n, y) => `${n} has driven trucks for ${y} years and is active in the local drivers' association.`,
  },
  {
    article: 'a', noun: 'restaurant owner',
    tenureMin: 3,
    careerFmt: (n, y) => `${n} owns a neighborhood restaurant and has been feeding the community for ${y} years.`,
  },
  {
    article: 'a', noun: 'paralegal',
    tenureMin: 3,
    careerFmt: (n, y) => `${n} has worked as a paralegal for ${y} years, most recently at a firm that handles local housing cases.`,
  },
  {
    article: 'a', noun: 'retired firefighter',
    tenureMin: 20,
    ageMin: 50,
    careerFmt: (n, y) => `${n} retired after ${y} years as a firefighter and still volunteers with the department's mentorship program.`,
  },
];

// Civic / community hooks — policy-neutral. Used as background sentence 2.
const CIVIC_HOOKS = [
  'sits on the township planning board',
  'helps organize the annual neighborhood block party',
  'coaches a youth sports team on weekends',
  'volunteers at the local food pantry',
  'runs a monthly cleanup along the district\'s parks',
  'serves on the school parent advisory committee',
  'volunteers with the library\'s adult literacy program',
  'helps coordinate rides to medical appointments for older neighbors',
  'leads a mutual-aid network that started during the pandemic',
  'volunteers with the local animal shelter',
];

// Character lines — third sentence of background. Mix up tone so not all
// 202 candidates read the same.
const CHARACTER_LINES = [
  'Neighbors know {obj} as someone who listens before speaking.',
  '{cap_subj} has a reputation for showing up — to meetings, to funerals, to school fundraisers.',
  'People in {neighborhood} describe {obj} as plain-spoken and hard to rattle.',
  '{cap_subj} is the kind of neighbor who keeps a spare key, a jumper cable, and a strong opinion about the township budget.',
  '{cap_subj} is known around the district for asking the quiet, useful question at a loud meeting.',
  'People who have worked with {obj} say {subj} cares more about getting it right than getting credit.',
];

// Motivation themes for reasonForRunning. Policy-neutral, conversational,
// voter-facing. No policy restatements.
const MOTIVATIONS = [
  'is running because {subj} thinks the district deserves representatives who live here and show up.',
  'is running to make sure the next generation in {neighborhood} has the same opportunities that theirs did.',
  'is running because {subj} is tired of watching decisions get made without neighbors at the table.',
  'believes local experience matters more than political posturing, and is running to prove it.',
  'is running to bring straight talk and steady work to a system that rewards neither.',
  'is running because {subj} thinks families like {poss} shouldn\'t have to fight this hard to stay in the neighborhood they helped build.',
  'is running because the people who know the district best should be the ones speaking for it.',
  'wants the district\'s representative to be someone who actually answers the phone.',
];

// Age bucket → years-in-field derivation helper
function yearsInField(candidate, profession) {
  const age = candidate.age || 40;
  // Assume career start around 22; cap at 40 years.
  const raw = Math.max(age - 22, profession.tenureMin || 2);
  const capped = Math.min(raw, 40);
  return capped;
}

// Profession filter: require candidate age >= ageMin when set.
function pickProfession(seed, candidate) {
  const age = candidate.age || 40;
  const eligible = PROFESSIONS.filter((p) => !p.ageMin || age >= p.ageMin);
  return pick(seed, 0x9e3779b1, eligible);
}

// ==================== PRONOUNS ====================

function pronouns(gender) {
  switch ((gender || '').toLowerCase()) {
    case 'male':   return { subj: 'he',   poss: 'his',   obj: 'him'  };
    case 'female': return { subj: 'she',  poss: 'her',   obj: 'her'  };
    default:       return { subj: 'they', poss: 'their', obj: 'them' };
  }
}

function cap(s) {
  if (!s) return s;
  return s[0].toUpperCase() + s.slice(1);
}

// Expand templated placeholders in pool entries.
function expand(tpl, ctx) {
  return tpl
    .replace(/\{subj\}/g, ctx.subj)
    .replace(/\{poss\}/g, ctx.poss)
    .replace(/\{obj\}/g, ctx.obj)
    .replace(/\{cap_subj\}/g, cap(ctx.subj))
    .replace(/\{neighborhood\}/g, ctx.neighborhood)
    .replace(/\{firstName\}/g, ctx.firstName)
    .replace(/\{district\}/g, ctx.district);
}

// ==================== MAIN ====================

function buildBio(candidate /*, questions */) {
  const { firstName, displayName, age, gender, neighborhood, district } = candidate;
  const { subj, poss, obj } = pronouns(gender);
  const ctx = { subj, poss, obj, neighborhood, firstName, district };
  const seed = seedOf(candidate);

  const profession = pickProfession(seed, candidate);
  const years = yearsInField(candidate, profession);
  const civicHook = pick(seed, 0x45d9f3b, CIVIC_HOOKS);
  const characterTpl = pick(seed, 0x27d4eb2f, CHARACTER_LINES);
  const motivationTpl = pick(seed, 0x165667b1, MOTIVATIONS);

  // summary
  const summary = `${displayName}, ${age}, ${profession.article} ${profession.noun} from ${neighborhood}.`;

  // background sentences
  const careerSentence = profession.careerFmt(firstName, years);
  const civicSentence = `Outside work, ${subj} ${civicHook}.`;
  const characterSentence = expand(characterTpl, ctx);
  const background = `${careerSentence} ${civicSentence} ${characterSentence}`;

  // reasonForRunning
  const reasonForRunning = `${firstName} ${expand(motivationTpl, ctx)}`;

  return { summary, background, reasonForRunning };
}

module.exports = { buildBio };
