# PLAN-10: Quiz Improvements — REPLACED BY SUCCESSOR PLANS

> **Updated 2026-03-28:** Round 3 feedback incorporated (`docs/feedback/Quiz Updates feedback 3.md`). **PLAN-10 APPROVED.** 10A: added "My Issues" semantics note. 10C1: added re-prompt rules. 10C2: added MVP confidence threshold, candidate filter behavior, coexistence migration rule, answer coverage metric. 10C3: added editorial enforcement mechanism.
>
> **Product decisions (confirmed):** Dealbreakers removed entirely. Quiz is standalone (`app/(main)/quiz.tsx`), NOT onboarding. Top Picks filter dropped (3 filters).

---

## PLAN-10A: Dealbreaker Removal Migration

**Status: ✅ COMPLETE (2026-03-28).** 20 files modified, 1 deleted, 751 lines removed. Feed dropped from 4 to 3 filters. Zero dealbreaker references remain in src/ and app/. Verified: filters show Explore/My Area/My Issues only, no dealbreaker badges on cards, Dealbreakers removed from Profile menu, alignment scoring still works.

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

### Additional Requirements

1. **Search-and-destroy string audit.** Find every user-facing string containing "dealbreaker," "top picks," or equivalent language across all screens, components, and constants.

2. **Selector audit.** Ensure no capability logic or filter availability still references removed completion states (e.g., `selectDealbreakersComplete`, `selectCanSeeDealbreakers`).

3. **Progress/completion audit.** Broader than just selectors — audit every place where onboarding progress, readiness, or "complete your profile" is summarized, including:
   - Progress chips
   - Empty states
   - Completion percentage logic
   - VerificationChecklist and any similar components

4. **Feed semantics rewrite.** ~~RESOLVED 2026-03-28:~~ Drop "Top Picks" / "Most Important" filter entirely. Feed goes from 4 filters to 3 (Explore, My Area, My Issues). Mass endorse button behavior unchanged (still works with any active non-random filter). A future 10C2 scoring-based filter can reclaim the 4th slot when Quiz v2 lands.
   - Remove `most_important` from ExperienceMenu options
   - Remove `most_important` filter logic from `app/(main)/(feed)/index.tsx`
   - Remove `selectCanSeeDealbreakers` gating from ExperienceMenu
   - Update MassEndorseButton if it references the removed filter
   - **"My Issues" meaning change:** Previously "My Issues" = overlap, "Top Picks" = overlap minus conflicts. With Top Picks gone, "My Issues" now represents **positive overlap only** and does not exclude conflicting positions. This must be documented in UX copy and understood by the team — otherwise users may misinterpret results and trust erodes.

5. **Analytics/event taxonomy audit.** If any analytics events, logs, funnel names, or dashboard labels reference dealbreakers, top picks, most important, or dealbreaker completion — those become stale the moment 10A lands. Audit and update or remove to prevent distorted product/growth analysis.

6. **Saved filter/preference migration.** If users have stale local/UI state tied to removed filter IDs (e.g., `most_important` experience mode), handle gracefully.

7. **Firestore data.** Leave existing `dealbreakers` field in Firestore (no harm), remove from all reads. Not a schema migration, but a product migration.

### Rollout

**Not a casual single deploy.** Despite being a "removal," this touches capability gating, feed filtering, alignment explanation, and user expectations. Recommend:
- Full QA pass on all 4 tabs after removal
- Verify no empty states reference dealbreakers
- Verify feed filter count updates correctly (4→3 or renamed)

---

## PLAN-10B: Standalone Quiz UX Cleanup

**Status:** ✅ Safe to implement whenever. Low priority.

**Scope:** Presentation-only improvements to the standalone quiz (`app/(main)/quiz.tsx`).

**Hard boundaries:**
- **NO data-model changes**
- **NO scoring changes**
- **NO question taxonomy changes**
- **NO candidate-answer changes**

This keeps 10B safely shippable and prevents it from becoming a dumping ground for unresolved 10C decisions.

**Additional boundary:** Any UI polish must preserve support for both current answer rendering and whatever future 10C introduces — avoid styling assumptions that hard-code slider-only layouts.

**Potential items:**
- Quiz completion progress indicator improvements
- Better empty state when no issues selected
- Visual polish for question cards

**Note:** Quiz deselect capability already exists — do not re-implement.

---

## PLAN-10C: Quiz v2 — New Matching Architecture

> **Status: 🟡 APPROVED, needs 2-3 final decisions before build.** This is not a content update — it is a new matching system. Core architecture is sound; remaining gaps are contained.

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

**This is Quiz v2, not a content refresh.** Split into three sub-plans:

---

### PLAN-10C1: Quiz Data Model and Activation

**Scope:** Define the normalized data model, response model, and move configuration to Firestore. No scoring changes. Includes structural rotation/versioning rules (UX-facing rotation policy lives in 10C3).

**Key decisions required before implementation:**

1. **Replacement vs coexistence.** Do multiple-choice questions replace spectrum sliders or run alongside them? This is the core architectural fork:
   - **If replace:** Need migration path for existing `questionnaireResponses`; current alignment scoring becomes obsolete; seeded candidate spectrum positions stop being primary matching asset
   - **If coexist:** Two incompatible answer systems; must define how each contributes to matching; risk confusing users with mixed question types
   - **Recommended default:** Coexistence only as a temporary bridge, with eventual replacement. This gives a migration path without breaking existing matching immediately.
   - **Migration rule:** During coexistence, feed ranking continues to use spectrum scoring. Question-based scoring runs in parallel but is not used for ranking until full replacement (see 10C2 item 7).

2. **Normalized data model.** Do NOT overload the Issue type further. Recommended separation:
   - **Issue** = stable policy topic (trade, inflation, borders). Has `id`, `name`, `scope`, `icon`.
   - **Question** = answerable prompt tied to an issue. Has `issueId`, `text`, `type`, `options[]`, `isActive`, `addedAt`, `retiredAt`, `districtFilter[]`.
   - **QuizConfig** = active question set per district/version. Has `districtId`, `questionIds[]`, `version`.

3. **Response model.** Define how user answers are stored and versioned:
   - **QuestionResponse** keyed by `questionId` (not just `issueId`)
   - Include `questionSetVersion` or equivalent provenance so responses can be traced to the question version they answered
   - Define what happens when a question's options change after a user has answered (invalidate? preserve with flag? re-prompt?)
   - Retired question responses: preserved for historical matching but excluded from active quiz

4. **District taxonomy.** Do NOT encode "red" or "blue" as the operating abstraction. Use explicit district IDs:
   - `quizConfig/PA-01` → specific question IDs
   - `quizConfig/PA-02` → specific question IDs
   - This keeps the model usable when districts don't fit a partisan template.

5. **Existing `questions` collection.** Decide explicitly: reuse with extended schema, or introduce new normalized model. Do not drift into half-migration where old and new question documents coexist without clear semantics.

6. **Structural rotation/versioning rules:**
   - `isActive` / `retiredAt` / `addedAt` fields on Question type
   - `questionSetVersion` on QuizConfig for change detection
   - Response validity rules: how long do answers to retired questions remain valid for matching?
   - Change detection: how does the app know new questions are available?

7. **Re-prompt rules:** Define when the app prompts users to revisit the quiz:
   - If user has answered < 50% of active questions → show quiz prompt on For You page
   - If new questions added since last quiz visit → soft prompt (non-blocking banner, not modal)
   - If question retired → no action required from user
   - This prevents stale profiles without annoying forced updates

**Implementation items (once decisions are made):**
- Define Issue, Question, QuestionResponse, QuizConfig types
- Move `DISTRICT_ISSUES` from hardcoded `quiz.tsx` to Firestore `quizConfig` collection
- Implement question activation/retirement lifecycle
- Graceful handling of retired questions (preserve responses, exclude from quiz)

---

### PLAN-10C2: Matching and Scoring Redesign

**Scope:** Define how multiple-choice maps to alignment, candidate answer model, feed/filter behavior, and migration from existing spectrum responses.

**Ownership (must be assigned before implementation):**
- **Product** defines scoring goals and user-visible interpretation
- **Engineering** defines implementable mechanics
- **Policy/content team** signs off on label phrasing and candidate-answer interpretation

Without an explicit owner, scoring plans tend to stall or drift.

**Key decisions required before implementation:**

1. **Scoring model.** Engineering cannot build feed behavior without a scoring contract. Provisional model needed:
   - Exact match = 1.0
   - Adjacent/compatible option = 0.5
   - Opposite option = 0.0
   - Unanswered by candidate = excluded from denominator
   - Unanswered by user = excluded from denominator
   - Minimum-answer threshold before showing match confidence

2. **Match confidence vs score.** A candidate with 95% alignment on 2 answered overlaps is not the same as 82% alignment on 8 overlaps. Define whether the product surfaces:
   - Only a score
   - A score plus confidence indicator
   - A minimum overlap threshold before showing strong match labels (e.g., "Strong Match" only if ≥5 shared answers)
   - This matters for feed fairness and user trust.

3. **Candidate answer contract — design principle: candidate answers must be first-class campaign content.**
   - For avatar/seed candidates: generated answers are fine initially
   - For real candidates: must explicitly answer active questions; answers are visible and auditable; profile explanations derive from answers
   - Can a candidate skip a question? (Recommended: yes, but skipped questions reduce their match confidence)
   - Are answers public on the candidate profile? (Recommended: yes)
   - Can answers change mid-contest? (Recommended: yes, with change history visible)
   - If a question rotates in later, do existing candidates need to backfill before remaining visible in filtered views?
   - What happens when a candidate hasn't answered an active question but a user has? (Recommended: exclude from that question's scoring, reduce confidence)

4. **Feed filter behavior after dealbreaker removal:**
   - What replaces "Top Picks" if dealbreakers are gone (10A dependency)?
   - How do "My Issues" and "Top Picks" filters map to the new question-based matching?

5. **MVP confidence threshold.** Default rule to prevent misleading match scores:
   - ≥ 3 shared answered questions → show "Strong Match" labels
   - < 3 shared answers → show score but display "Low Confidence" indicator
   - This provides a consistent baseline without requiring perfection.

6. **Candidate filter behavior for incomplete profiles.** When a candidate hasn't answered questions that a user has:
   - Candidate is **included** in feed (not excluded)
   - But: lower ranking, lower confidence, cannot qualify for "Strong Match" UI states
   - This avoids unpredictable filtering while still rewarding complete profiles.

7. **Coexistence migration rule.** During the temporary coexistence phase:
   - Feed ranking continues to use **spectrum scoring** (existing system)
   - Question-based scoring is introduced **in parallel but not used for ranking** until Phase 2 (full replacement)
   - This avoids mid-transition instability and confusing users with inconsistent results.

8. **Answer coverage metric.** Track candidate profile completeness:
   - `answerCoverage = answeredQuestions / activeQuestions`
   - Use for: profile display (e.g., "Answered 7/9 questions"), ranking boost, confidence calculation
   - Low-cost, high-value addition that drives candidate engagement.

9. **Short label governance.** Labels like "Protection" or "Free Trade" are politically loaded compressions. Require:
   - Word-limit and style rule
   - Consistency across questions
   - Review for bias/loaded phrasing
   - Distinction between display shorthand and canonical answer text

---

### PLAN-10C3: Content Rollout

**Scope:** Seed actual questions and candidate answers, update UI presentation. Only implementable after 10C1 and 10C2.

**Editorial review gates (required before content goes live):**
- Editorial review of question phrasing for neutrality
- Editorial review of option wording (especially politically loaded pairs like Open/Close, Socialize/Privatize, Escalation/No Involvement)
- Consistency review across districts
- Short label review for bias

**Enforcement mechanism:** No question goes live without passing editorial review. Options:
- Admin UI flag on Question document (`editorialStatus: 'approved' | 'pending' | 'rejected'`) — only `approved` questions can be added to QuizConfig
- Or: simple manual checklist process with sign-off before seed/deploy
- Without enforcement, editorial review becomes aspirational.

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

**Question rotation policy (UX/admin-facing — structural rules live in 10C1):**
- Question sets may only rotate at round boundaries? Or event-driven? Or admin discretion?
- No more than once every X days?
- How many unanswered new questions before "My Issues" becomes low confidence?
- Do users get prompted to revisit the quiz after each rotation?
- How does confidence degrade as questions become stale?

**References:**
- [Ballard, 2026 — YouGov party issue priorities](https://today.yougov.com/politics/articles/53958-the-issues-that-democrats-and-republicans-want-their-parties-to-focus-on-more)
- [Marquette, 2026 — ICE approval survey](https://today.marquette.edu/2026/02/new-marquette-law-school-national-survey-finds-60-disapprove-of-the-work-of-ice-with-democrats-and-independents-opposed-to-ice-and-republicans-in-favor/)
- [Orth, 2023 — Inflation blame survey](https://today.yougov.com/economy/articles/45890-more-americans-now-blame-inflation-corporations)

---

## Summary: What's Implementable Now

| Sub-plan | Status | Dependencies |
|----------|--------|-------------|
| **10A** | ✅ Ready | Filter decision made: drop Top Picks to 3 filters |
| **10B** | ✅ Safe whenever | None (presentation-only) |
| **10C1** | 🟡 Nearly ready | Replacement-vs-coexistence decision (recommended: coexist → replace); 10A should land first |
| **10C2** | 🟡 Nearly ready | Scoring model defaults defined; needs ownership assignment + final sign-off; 10C1 |
| **10C3** | 🔴 Blocked | 10C1 + 10C2 + editorial review with enforcement |

**Recommended sequence:** 10A → 10B → 10C1 → 10C2 → 10C3

Filter decision resolved — 10A goes first to remove dead concepts before polishing quiz UI.

---

## Archived Original Plan

The original PLAN-10 body has been archived to `docs/plans/archive/PLAN-10-original.md`. It contained outdated implementation details referencing the old onboarding quiz flow, stale route paths (`app/(tabs)/`, `app/settings/`), and mixed concerns. Do not reference it for implementation — use the successor plans above.
