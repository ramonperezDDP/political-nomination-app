# PLAN-19: Remove Pre-Nomination Round

## Goal

Eliminate the `pre_nomination` round so the contest starts at `round_1_endorsement` (First Round: Endorsement). The Pre-Nomination round has no voting method, no endorsements, and no candidate filtering — it is dead air. Starting directly at Round 1 makes the app feel more immediate and active from day one.

## Impact Summary

| Area | Files | Change |
|------|-------|--------|
| Types | 2 | Remove `'pre_nomination'` from `ContestRoundId` union |
| Seed data | 3 | Remove pre_nomination row; **keep existing order values** (1-7) |
| Config store | 1 | Change all `'pre_nomination'` fallbacks to `'round_1_endorsement'` |
| FAQs | 1 | Remove `pre_nomination` FAQ entry, update fallback, review all copy |
| AppHeader | 1 | Remove `'pre_nomination'` from debug round cycling array |
| Cron function | 1 | Update beta cycle-back target and fallback |
| Admin functions | 1 | Fully update deprecated stage references (not left half-alive) |
| Migration script | 1 | Update fallback |
| Migration (new) | 1 | New one-time Firestore migration script |
| Firestore | — | Coordinated update via migration script |

**Total: 11 files + Firestore migration**

---

## Key Design Decisions

### Decision 1: Do NOT renumber round orders

The original plan proposed renumbering all round `order` values to start from 0. **This is too risky.** The `order` field is used for:
- Timeline rendering (past/current/future derivation)
- Next-round resolution in transition logic
- Beta cron progression
- Historical `contestTransitions` records reference rounds by ID + order

**Approach:** Remove `pre_nomination` and leave a gap at order 0. Existing rounds keep their current order values (1-7). A missing zero is far safer than changing the ordinal meaning of every downstream round.

| Round | Order (unchanged) |
|-------|-------------------|
| ~~pre_nomination~~ | ~~0~~ (removed) |
| round_1_endorsement | 1 |
| round_2_endorsement | 2 |
| round_3_endorsement | 3 |
| virtual_town_hall | 4 |
| debate | 5 |
| final_results | 6 |
| post_election | 7 |

### Decision 2: Targeted Firestore migration, not destructive reseed

Do NOT re-seed all contest rounds. Reseeding would overwrite all round documents, risking:
- Wiping admin-managed `startDate`/`endDate` fields
- Clobbering any future config tweaks stored in Firestore
- Creating inconsistencies with existing `contestTransitions` history

**Approach:** A migration script that does only:
1. Delete `contestRounds/pre_nomination`
2. Update `partyConfig.currentRoundId` and `contestStage`
3. Leave all other round docs untouched

### Decision 3: Keep the `pre_nomination` Firestore doc for historical interpretability

On reflection: **retain** the `contestRounds/pre_nomination` document in Firestore rather than deleting it. Existing `contestTransitions` audit entries may reference this round, and keeping the doc preserves audit readability at negligible cost.

The doc simply won't appear in the app because:
- It's removed from the type union
- It's removed from the seed arrays (so auto-seed won't recreate it)
- The configStore won't select it

### Decision 4: Coordinated migration, not deploy-then-manual-fix

The Firestore migration must happen in lockstep with code deployment, not as a separate manual afterthought. If new code runs while `partyConfig.currentRoundId` is still `'pre_nomination'`, TypeScript won't protect at runtime and fallbacks may behave unexpectedly.

**Approach:** A single migration script that atomically updates `partyConfig` fields. Run it immediately before or after code deployment, not days later.

---

## Detailed Changes

### 1. Type Definitions

**`src/types/index.ts`** (line 309-317) and **`src/types/index.web.ts`** (line 309-317)

Remove `'pre_nomination'` from the `ContestRoundId` union type:

```typescript
// Before
export type ContestRoundId =
  | 'pre_nomination'
  | 'round_1_endorsement'
  ...

// After
export type ContestRoundId =
  | 'round_1_endorsement'
  ...
```

**Note:** This means live Firestore data with `currentRoundId: 'pre_nomination'` won't match the type at runtime. The migration script (Section 10) must run in coordination with deployment.

### 2. Seed Data (3 locations) — Remove row only, no renumbering

**`src/services/firebase/firestore.ts`** (line 1892) — client seed
**`src/services/firebase/firestore.web.ts`** (line 1649) — web client seed
**`functions/src/admin/seedContestRounds.ts`** (line 18-19) — Cloud Function seed

Remove the `pre_nomination` entry from each array. **Do not change any `order` values.** The remaining rounds keep orders 1-7.

### 3. Config Store

**`src/stores/configStore.ts`**

Change every `'pre_nomination'` fallback to `'round_1_endorsement'`:

- **Line 28** (`deriveCurrentRound`): `|| 'round_1_endorsement'`
- **Line 151** (`setDebugRound`): `|| 'round_1_endorsement'`
- **Line 185** (`selectContestStage`): `|| 'round_1_endorsement'`
- **Line 188** (`selectCurrentRoundId`): `|| 'round_1_endorsement'`
- **Line 207** (`selectCurrentRoundLabel`): `|| 'First Round: Endorsement'`
- **Lines 264-265** (`defaultPartyConfig`): `contestStage: 'round_1_endorsement'`, `currentRoundId: 'round_1_endorsement'`

### 4. FAQs — Remove entry + content review

**`src/constants/faqs.ts`**

- **Line 33**: Remove the `pre_nomination` key and its FAQ entries
- **Line 120**: Change fallback to `ROUND_FAQS.round_1_endorsement`:
  ```typescript
  const roundSpecific = ROUND_FAQS[roundId] || ROUND_FAQS.round_1_endorsement || [];
  ```
- **Content review**: Check all FAQ copy across rounds for language that implies "voting is not yet open" or "the contest starts later" or references a pre-contest stage. The product meaning has changed — copy should reflect that Round 1 is the starting state.

### 5. AppHeader Debug Cycling

**`src/components/layout/AppHeader.tsx`** (line 17-25)

Remove `'pre_nomination'` from the `ROUND_IDS` array:

```typescript
const ROUND_IDS = [
  'round_1_endorsement',
  'round_2_endorsement',
  'round_3_endorsement',
  'virtual_town_hall',
  'debate',
  'final_results',
];
```

Also update the fallback on line 46: `|| 'round_1_endorsement'`

### 6. Beta Cron Function

**`functions/src/cron/advanceContestRound.ts`**

- **Line 27**: Change fallback: `|| 'round_1_endorsement'`
- **Lines 49-51**: Update cycle-back logic. When at the last round (`post_election`), cycle back to `round_1_endorsement` instead of `pre_nomination`
- **Line 162**: Update the beta reset condition: `if (isLastRound && nextRound.id === 'round_1_endorsement')`
- **Lines 17, 161**: Update comments to reference `round_1_endorsement`
- **Beta reset scope**: The reset currently sets `contestStatus: 'active'` only for candidates with status `'eliminated'`. Verify this remains scoped to `eliminated` only — do not accidentally reset `withdrawn`, `disqualified`, or `winner` statuses. The current code's `.where('contestStatus', '==', 'eliminated')` query already enforces this, but confirm it remains unchanged during the edit.

### 7. Admin Functions — Fully update, not left half-alive

**`functions/src/admin/partyConfig.ts`**

Deprecated code survives longer than intended. These must be fully updated and verified to compile:

- **Line 55**: Change fallback: `|| 'round_1_endorsement'`
- **Line 58**: Change fallback in seed logic: `|| 'round_1_endorsement'`
- **Lines 12, 21**: Remove `'pre_nomination'` from the deprecated stage type unions
- **Lines 189-191**: Replace `pre_nomination` notification template with `round_1_endorsement`:
  ```typescript
  round_1_endorsement: {
    title: 'First Round: Endorsement',
    body: 'The endorsement round is now open. Browse candidates and endorse those who align with your values.',
  },
  ```

### 8. Migration Script (existing)

**`scripts/migrateEndorsements.ts`** (line 32): Change fallback `|| 'round_1_endorsement'`

### 9. AboutContestCard — Verify, no code changes expected

**`src/components/home/AboutContestCard.tsx`**

No code changes expected, but **must be manually verified** after implementation:

- [ ] First timeline item renders correctly (Round 1 as first entry, no dangling connector above it)
- [ ] "Current" chip displays on Round 1
- [ ] Candidate count text ("100 candidates -> 20 advance") renders correctly as first entry
- [ ] Timeline shows exactly 6 items: Round 1, Round 2, Round 3, Virtual Town Hall, Debate, Final Results (`post_election` already filtered by existing code). Any automated tests asserting round counts must be updated to expect 6 displayed / 7 total (down from 7 displayed / 8 total).

### 10. Firestore Migration Script (new)

Create **`scripts/migrateRemovePreNomination.ts`** — a one-time migration script:

```
1. Read config/partyConfig
2. If currentRoundId === 'pre_nomination':
   - Update currentRoundId to 'round_1_endorsement'
   - Update contestStage to 'round_1_endorsement'
3. (Optional) Delete contestRounds/pre_nomination doc
   — OR keep it for historical audit interpretability (preferred)
4. Log results
```

**Do not** delete or modify any other round documents. **Do not** touch `contestTransitions` history.

The `contestRounds/pre_nomination` Firestore doc will be retained for audit trail readability but excluded from the app via type system and seed data removal.

---

## Pre-Merge Audit Requirement

Before merging, run a project-wide search and verify zero remaining references to:

- `'pre_nomination'` (string literal)
- `"Pre-Nomination"` (display text)
- `'Pre-Nom'` (short label)
- Any hardcoded round count assumptions (e.g., `=== 8`, `.length === 8`, `7 displayable rounds`)
- Any test fixtures that assert specific round counts or ordering

```bash
grep -rn "pre_nomination\|Pre-Nomination\|Pre-Nom" --include="*.ts" --include="*.tsx" src/ app/ functions/ scripts/
```

This must return zero hits in production code. Exceptions:
- The retained `contestRounds/pre_nomination` Firestore doc (not in code directories)
- This plan document and feedback docs
- The migration script itself may reference `pre_nomination` (that's its purpose) — but any temporary comments or TODOs referencing it should be cleaned before merge

---

## Order of Operations

1. **Run migration script** — update `partyConfig.currentRoundId` and `contestStage` to `'round_1_endorsement'` in Firestore. This is safe to do first because the currently deployed app already handles `round_1_endorsement` as a valid `currentRoundId` — it is a member of the existing `ContestRoundId` union, the configStore's `deriveCurrentRound` will find it in the `contestRounds` array, and all selectors/components consume it through the store. No code path rejects or special-cases this value. The migration simply moves the pointer from one valid round to another.
2. **Deploy code changes** (all 11 files) — type removal, seed data, fallbacks, cron, admin functions
3. **Deploy Cloud Functions** — updated cron and admin functions
4. **Verify** (see regression checklist below)

**Alternative:** If deploying code and running migration simultaneously isn't feasible, the code changes have fallbacks to `'round_1_endorsement'` everywhere, so a brief window where Firestore still says `pre_nomination` will resolve correctly via fallback. But minimize this window.

---

## Risk Assessment

**Moderate risk.** While `pre_nomination` gates no user-facing functionality, this change touches:
- The first valid state in the contest state machine
- The active round fallback across the entire app
- Beta cron cycle-back behavior
- The interpretation of historical transitions

Mitigated by: preserving round order values, targeted (not destructive) migration, coordinated deployment, and the pre-merge audit.

**Rollback:** Re-add `'pre_nomination'` to the type union and seed arrays, set `partyConfig.currentRoundId` back to `'pre_nomination'`. No user data is affected — this only touches config/round definitions.

---

## Post-Deployment Regression Checklist

- [ ] **Header**: Shows "First Round: Endorsement" (not "Pre-Nomination")
- [ ] **About Contest timeline**: Starts at Round 1, shows 6 items, "Current" chip on Round 1
- [ ] **FAQs**: Round 1 FAQs display correctly, no stale "voting not yet open" language
- [ ] **Debug round cycling**: Tap header cycles through Round 1 -> Round 2 -> ... -> Final Results -> Round 1
- [ ] **Long-press reset**: Resets to Firestore value (round_1_endorsement)
- [ ] **Endorsement**: Can endorse candidates in Round 1 (approval voting active)
- [ ] **Beta cron** (if testable): Advances from post_election back to round_1_endorsement, resets eliminated candidates
- [ ] **Fallback behavior**: If `partyConfig.currentRoundId` is missing/null, app defaults to Round 1
- [ ] **Web**: Same behavior on web (check header, timeline, FAQs)
