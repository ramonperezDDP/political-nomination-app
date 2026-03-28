# PLAN-10: Quiz Improvements — REPLACED BY SUCCESSOR PLANS

> **Updated 2026-03-28:** Comprehensive rewrite incorporating reviewer feedback (`docs/feedback/Quiz Updates feedback.md`). 10A expanded with audit requirements. 10B scoped to presentation-only. 10C split into 10C1/10C2/10C3 per reviewer recommendation — it is a new matching architecture, not a content refresh.
>
> **Product decisions (confirmed):** Dealbreakers removed entirely. Quiz is standalone (`app/(main)/quiz.tsx`), NOT onboarding.

---

## PLAN-10A: Dealbreaker Removal Migration

**Status:** Ready to implement after expanding scope per review.

**Scope:** Cross-system migration removing all dealbreaker references from the product. This is NOT just a cleanup — it is a silent product change that affects capability gating, feed filtering, alignment explanation, and user expectations.

### Impact Inventory

| Area | Files | What to Remove |
|------|-------|----------------|
| Types | `src/types/index.ts` | `dealbreakers` field from User type |
| Stores | `src/stores/userStore.ts` | `updateDealbreakers()`, `selectUserDealbreakers`, `selectDealbreakersComplete` |
| Alignment | `src/utils/alignment.ts` | `hasDealbreaker` from `calculateAlignmentScore()`, entire `DEALBREAKER_MAP` |
| Feed | `app/(main)/(feed)/index.tsx` | `no-dealbreakers` filter logic |
| PSA Card | `src/components/feed/FullScreenPSA.tsx` | Dealbreaker badge display |
| Candidate detail | `src/screens/CandidateDetailScreen.tsx` | Dealbreaker warnings from alignment explainer |
| Onboarding | `app/(auth)/onboarding/dealbreakers.tsx` | Entire screen + navigation references |
| Profile | `app/(main)/(profile)/index.tsx` | "Manage Dealbreakers" menu item |
| Verification | `src/components/ui/VerificationChecklist.tsx` | Dealbreaker route |
| Capability selectors | `src/stores/userStore.ts` | PLAN-01/05/06 selector audit |

### Additional Requirements (from review)

1. **Search-and-destroy string audit.** Find every user-facing string containing "dealbreaker," "top picks," or equivalent language across all screens, components, and constants.

2. **Selector audit.** Ensure no capability logic or filter availability still references removed completion states (e.g., `selectDealbreakersComplete`, `selectCanSeeDealbreakers`).

3. **Feed semantics rewrite.** Removing dealbreakers means "Most Important" / "Top Picks" either **disappears or gets redefined.** This is a product decision, not a code decision:
   - Does the filter drop from 4 to 3?
   - Does "Top Picks" get replaced with something else (e.g., "Best Match")?
   - Does mass endorse behavior change when the exclusion filter is gone?
   - **This is a blocker** — PLAN-05's experience menu depended on dealbreaker-based "Most Important" logic.

4. **Saved filter/preference migration.** If users have stale local/UI state tied to removed filter IDs (e.g., `most_important` experience mode), handle gracefully.

5. **Firestore data.** Leave existing `dealbreakers` field in Firestore (no harm), remove from all reads. Not a schema migration, but a product migration.

### Rollout

**Not a casual single deploy.** Despite being a "removal," this touches capability gating, feed filtering, alignment explanation, and user expectations. Recommend:
- Full QA pass on all 4 tabs after removal
- Verify no empty states reference dealbreakers
- Verify feed filter count updates correctly (4→3 or renamed)

---

## PLAN-10B: Standalone Quiz UX Cleanup

**Status:** Safe to implement whenever. Low priority.

**Scope:** Presentation-only improvements to the standalone quiz (`app/(main)/quiz.tsx`).

**Hard boundaries (from review):**
- **NO data-model changes**
- **NO scoring changes**
- **NO question taxonomy changes**
- **NO candidate-answer changes**

This keeps 10B safely shippable and prevents it from becoming a dumping ground for unresolved 10C decisions.

**Potential items:**
- Quiz completion progress indicator improvements
- Better empty state when no issues selected
- Visual polish for question cards

**Note:** Quiz deselect capability already exists — do not re-implement.

---

## PLAN-10C: Quiz v2 — New Matching Architecture

> **Status: 🔴 NOT IMPLEMENTABLE YET.** This is not a content update — it is a new matching system. Needs foundational decisions before implementation planning.
>
> **Reviewer verdict:** "The product idea is good. I do not think it is implementable yet from this document."

### What This Actually Is

The plan frames 10C as "new quiz question content + scope taxonomy," but the actual scope is:
- New question format (multiple-choice replacing or coexisting with spectrum sliders)
- New data model (Issue vs Question separation)
- District-specific question activation
- Candidate answer model
- Alignment scoring redesign
- Feed filter redesign
- Adaptive rotation/versioning
- Historical response handling

**This is Quiz v2, not a content refresh.** Per reviewer recommendation, split into three sub-plans:

---

### PLAN-10C1: Quiz Data Model and Activation

**Scope:** Define the normalized data model and move configuration to Firestore. No scoring changes.

**Key decisions required before implementation:**

1. **Replacement vs coexistence.** Do multiple-choice questions replace spectrum sliders or run alongside them? This is the core architectural fork:
   - **If replace:** Need migration path for existing `questionnaireResponses`; current alignment scoring becomes obsolete; seeded candidate spectrum positions stop being primary matching asset
   - **If coexist:** Two incompatible answer systems; must define how each contributes to matching; risk confusing users with mixed question types

2. **Normalized data model.** Do NOT overload the Issue type further. Recommended separation:
   - **Issue** = stable policy topic (trade, inflation, borders). Has `id`, `name`, `scope`, `icon`.
   - **Question** = answerable prompt tied to an issue. Has `issueId`, `text`, `type`, `options[]`, `isActive`, `addedAt`, `retiredAt`, `districtFilter[]`.
   - **QuizConfig** = active question set per district/version. Has `districtId`, `questionIds[]`, `version`.

3. **District taxonomy.** Do NOT encode "red" or "blue" as the operating abstraction. Use explicit district IDs:
   - `quizConfig/PA-01` → specific question IDs
   - `quizConfig/PA-02` → specific question IDs
   - This keeps the model usable when districts don't fit a partisan template.

4. **Existing `questions` collection.** Decide explicitly: reuse with extended schema, or introduce new normalized model. Do not drift into half-migration where old and new question documents coexist without clear semantics.

**Implementation items (once decisions are made):**
- Define Issue, Question, QuizConfig types
- Move `DISTRICT_ISSUES` from hardcoded `quiz.tsx` to Firestore `quizConfig` collection
- Add `isActive` / `retiredAt` / `addedAt` to Question type
- Add `questionSetVersion` to QuizConfig for change detection
- Graceful handling of retired questions (preserve responses, exclude from quiz)

---

### PLAN-10C2: Matching and Scoring Redesign

**Scope:** Define how multiple-choice maps to alignment, candidate answer model, feed/filter behavior, and migration from existing spectrum responses.

**Key decisions required before implementation:**

1. **Scoring model.** Engineering cannot build feed behavior without a scoring contract. Provisional model needed:
   - Exact match = 1.0
   - Adjacent/compatible option = 0.5
   - Opposite option = 0.0
   - Unanswered by candidate = excluded from denominator
   - Unanswered by user = excluded from denominator
   - Minimum-answer threshold before showing match confidence

2. **Candidate answer contract:**
   - Are candidate answers first-class campaign content or derived placeholders?
   - Can a candidate skip a question?
   - Are answers public on the candidate profile?
   - Can answers change mid-contest?
   - If a question rotates in later, do existing candidates need to backfill before remaining visible in Issues/My Issues filtering?
   - What happens when a candidate hasn't answered an active question but a user has?

3. **Feed filter behavior after dealbreaker removal:**
   - What replaces "Top Picks" if dealbreakers are gone (10A dependency)?
   - How do "My Issues" and "Top Picks" filters map to the new question-based matching?

4. **Short label governance.** Labels like "Protection" or "Free Trade" are politically loaded compressions. Require:
   - Word-limit and style rule
   - Consistency across questions
   - Review for bias/loaded phrasing
   - Distinction between display shorthand and canonical answer text

---

### PLAN-10C3: Content Rollout

**Scope:** Seed actual questions and candidate answers, update UI presentation. Only implementable after 10C1 and 10C2.

**Question Content** (from `docs/feedback/Possible Questions for App Module.md`):

**Global (all districts):**

| Question | Options (short label) |
|----------|-----------------------|
| **Trade** — How should foreign goods be treated? | Free Trade, Limited Trade, Protection |
| **Iran** — What should we do next with Iran? | Escalation, Limited Response, No Involvement |

**National (all districts):**

| Question | Options (short label) |
|----------|-----------------------|
| **Inflation** — What measures should be used to control the cost of living? | Regulation, Strengthen Production, Fiscal Policy |
| **Borders** — How do we treat those here illegally and foreigners seeking to immigrate? | Open, Partially Close, Close |
| **Welfare** — What should be done with Social Security and Medicare/Medicaid? | Socialize, Maintain, Privatize |

**Local (PA-01):**

| Question | Options |
|----------|---------|
| **Infrastructure** — Provide federal funding for flood mitigation and stormwater projects? | Yes, No |
| **Housing** — Approve stricter environmental and preservation standards on new homes? | Yes, No |

**Local (PA-02):**

| Question | Options |
|----------|---------|
| **Grants** — Increase funding for community-based violence prevention programs? | Yes, No |
| **Transit** — Provide federal funding for safety improvements to light rail systems? | Yes, No |

**Implementation items:**
- Seed questions into Firestore using 10C1 data model
- Seed candidate answers for all avatar candidates, varying by political lean
- Update quiz UI to render multiple-choice (radio buttons) alongside or replacing spectrum sliders
- Group questions under Global/National/Local section headers
- Display short labels on candidate cards and feed tags

**Question rotation policy (must be defined before rotation is enabled):**
- Question sets may only rotate at round boundaries? Or event-driven? Or admin discretion?
- No more than once every X days?
- Retired questions continue contributing to matching for the current contest round?
- How many unanswered new questions before "My Issues" becomes low confidence?
- Do users get prompted to revisit the quiz after each rotation?

**References:**
- [Ballard, 2026 — YouGov party issue priorities](https://today.yougov.com/politics/articles/53958-the-issues-that-democrats-and-republicans-want-their-parties-to-focus-on-more)
- [Marquette, 2026 — ICE approval survey](https://today.marquette.edu/2026/02/new-marquette-law-school-national-survey-finds-60-disapprove-of-the-work-of-ice-with-democrats-and-independents-opposed-to-ice-and-republicans-in-favor/)
- [Orth, 2023 — Inflation blame survey](https://today.yougov.com/economy/articles/45890-more-americans-now-blame-inflation-corporations)

---

## Summary: What's Implementable Now

| Sub-plan | Status | Dependencies |
|----------|--------|-------------|
| **10A** | Ready after scope expansion | PLAN-05 filter semantics decision (blocker) |
| **10B** | Safe whenever | None (presentation-only) |
| **10C1** | Blocked on replacement-vs-coexistence decision | 10A should land first |
| **10C2** | Blocked on scoring model + candidate answer contract | 10C1 |
| **10C3** | Blocked on 10C1 + 10C2 | Everything above |

**Recommended sequence:** 10B → 10A → 10C1 → 10C2 → 10C3

---

## Archived Original Plan

The original PLAN-10 body has been archived to `docs/plans/archive/PLAN-10-original.md`. It contained outdated implementation details referencing the old onboarding quiz flow, stale route paths (`app/(tabs)/`, `app/settings/`), and mixed concerns. Do not reference it for implementation — use the successor plans above.
