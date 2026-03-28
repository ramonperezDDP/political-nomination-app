# PLAN-10: Quiz Improvements — 🔴 REPLACED BY SUCCESSOR PLANS

> **Updated 2026-03-28:** PLAN-10C updated with concrete question content from feedback document (`docs/feedback/Possible Questions for App Module.md`). Questions organized by scope (Global/National/Local) with district-specific local questions.
>
> **Updated 2026-03-26:** Original plan archived. Replaced with 3 successor plan stubs below. Quiz deselect capability already exists (not part of remaining work).
>
> **Product decisions (confirmed):** Dealbreakers removed entirely. Quiz is standalone (`app/(main)/quiz.tsx`), NOT onboarding.

## Successor Plans

### PLAN-10A: Dealbreaker Removal Migration

**Status:** Not yet written. Prerequisite for PLAN-12 (alignment explainer reuse).

**Scope:** Cross-system migration removing all dealbreaker references from the product.

**Impact analysis required:**
- Types: remove `dealbreakers` field from User type
- Stores: remove `updateDealbreakers()`, `selectUserDealbreakers`, `selectDealbreakersComplete`
- Alignment: remove `hasDealbreaker` from `calculateAlignmentScore()` in `src/utils/alignment.ts`
- Feed: remove `no-dealbreakers` filter from `app/(main)/(feed)/index.tsx`
- PSACard: remove dealbreaker badge display
- Candidate detail: remove dealbreaker warnings from alignment explainer in `src/screens/CandidateDetailScreen.tsx`
- Onboarding: remove `app/(auth)/onboarding/dealbreakers.tsx` and navigation to it
- Profile: remove "Manage Dealbreakers" menu item from `app/(main)/(profile)/index.tsx`
- Verification checklist: remove dealbreaker route from `src/components/ui/VerificationChecklist.tsx`
- PLAN-01/05/06 capability selectors: audit for dealbreaker dependencies

**Migration considerations:**
- Existing user data with `dealbreakers` field: leave in Firestore (no harm), remove from reads
- Alignment calculations must degrade gracefully for clients that haven't updated
- `DEALBREAKER_MAP` in `src/utils/alignment.ts` can be deleted entirely
- Rollout: single deploy, no phased rollout needed (field simply stops being read)

---

### PLAN-10B: Standalone Quiz UX Cleanup

**Status:** Not yet written. Low priority — quiz already works.

**Scope:** UX improvements to the standalone quiz (`app/(main)/quiz.tsx`).

**Potential items (to be confirmed):**
- Direct quiz launch from home (currently already routes to `/quiz`)
- Quiz completion progress indicator improvements
- Better empty state when no issues selected

**Note:** Quiz deselect capability already exists — do not re-implement.

---

### PLAN-10C: New Quiz Question Content + Scope Taxonomy

**Status:** Content finalized from feedback. Ready for implementation planning.

**Source:** `docs/feedback/Possible Questions for App Module.md`

**Scope:** Replace or augment the current 7 spectrum-slider issues with a new multiple-choice question format organized by Global/National/Local scope, with district-specific local questions.

#### Question Format Change

The current quiz uses a **spectrum slider** (Progressive ↔ Conservative) for each issue. The new questions use a **multiple-choice format** with 2-3 options per question. Each option has a full description and a short label (in parentheses) used for display.

**Key design decision needed:** Do the new multiple-choice questions *replace* the existing spectrum sliders, or run alongside them? This affects alignment scoring, candidate matching, and the `questionnaireResponses` data model.

#### Shared Questions (All Districts)

**Global:**

| Question | Options |
|----------|---------|
| **Trade** — How should foreign goods be treated? | Free Trade, Limited Trade, Protection |
| **Iran** — What should we do next with Iran? | Escalation, Limited Response, No Involvement |

**National:**

| Question | Options |
|----------|---------|
| **Inflation** — What measures should be used to control the cost of living? | Regulation, Strengthen Production, Fiscal Policy |
| **Borders** — How do we treat those here illegally and foreigners seeking to immigrate? | Open, Partially Close, Close |
| **Welfare** — What should be done with Social Security and Medicare/Medicaid? | Socialize, Maintain, Privatize |

#### District-Specific Local Questions

**Majority Red Districts (e.g., PA-01):**

| Question | Options |
|----------|---------|
| **Infrastructure** — Provide federal funding for flood mitigation and stormwater projects? | Yes, No |
| **Housing** — Approve stricter environmental and preservation standards on new homes? | Yes, No |

**Majority Blue Districts (e.g., PA-02):**

| Question | Options |
|----------|---------|
| **Grants** — Increase funding for community-based violence prevention programs? | Yes, No |
| **Transit** — Provide federal funding for safety improvements to light rail systems? | Yes, No |

#### Implementation Requirements

1. **Data model:** Add `scope: 'global' | 'national' | 'local'` to the `Issue` type
2. **Question format:** Add `questionType: 'spectrum' | 'multiple_choice'` and `options?: { label: string; shortLabel: string }[]` to the `Issue` type (or a new `Question` type)
3. **District-specific questions:** Add `districtFilter?: string[]` to control which questions show for which districts (e.g., `['PA-01']` for red-district local questions)
4. **Quiz UI:** Group questions under Global/National/Local section headers
5. **Quiz UI:** Render multiple-choice questions as radio-button style selectors (not spectrum sliders)
6. **Seed data:** Update `seedIssues()` or create new `seedQuestions()` with the content above
7. **Alignment scoring:** Define how multiple-choice responses map to candidate matching (current system uses spectrum position — new system needs a different approach)
8. **Short labels:** The parenthetical labels (e.g., "Free Trade", "Protection") should be stored and used for display on candidate cards and feed tags
9. **Candidate answers:** All seed/avatar candidates must have responses to the new questions so users can filter and match on them. This means:
   - Add a `questionResponses` (or extend existing `issuePositions`) field on the Candidate type to store multiple-choice answers
   - Update `seedCandidates()` to generate plausible answers for each avatar candidate, varying by candidate's political lean
   - Ensure the For You feed filters (Issues, Top Picks) work against the new question-based matching, not just the old spectrum positions
   - Real candidates will answer these questions as part of their campaign profile setup
10. **Feed integration:** The Experience Menu filters ("My Issues", "Top Picks") must support filtering candidates by match on the new multiple-choice questions — a user who picks "Free Trade" should see candidates who also picked "Free Trade" ranked higher
11. **Adaptive question system:** Questions must be rotatable without code deploys as campaigns evolve and news cycles shift. This requires:
    - **Move `DISTRICT_ISSUES` mapping to Firestore.** Currently hardcoded in `quiz.tsx` — this is the main bottleneck for adaptability. Create a `quizConfig` collection keyed by district that lists active question/issue IDs.
    - **Add `isActive` flag to questions.** Old questions can be deactivated without deletion so existing user responses remain valid. New questions are added and activated via Firestore.
    - **Add `addedAt` / `retiredAt` timestamps to questions.** Tracks when questions entered/left rotation for analytics and user experience (e.g., "3 new questions since your last visit").
    - **Versioned question sets.** Consider a `questionSetVersion` on the quiz config so the app can detect when new questions are available and prompt users to revisit the quiz.
    - **Graceful handling of retired questions.** If a user answered a question that's been retired, their response is preserved for historical matching but the question no longer appears in the quiz. Alignment scoring should handle responses to questions that no longer exist in the active set.

#### Current System Capabilities (Reference)

The existing architecture is already partially adaptive:
- **Questions** are Firestore-driven (`questions` collection), auto-seeded on first load
- **Issues** are Firestore-driven (`issues` collection), auto-seeded on first load
- **Candidate positions** are generated from 5 political leaning templates with per-issue spectrum values (-100 to +100)
- **Alignment scoring** (`src/utils/alignment.ts`) compares user spectrum answers to candidate spectrum positions
- **Question types** already support `single_choice`, `multiple_choice`, `slider`, and `ranking`

What's **NOT** adaptive today:
- `DISTRICT_ISSUES` mapping in `quiz.tsx` is hardcoded (must move to Firestore)
- No `isActive`/retirement concept for questions — all seeded questions are always shown
- No mechanism to notify users of new questions
- Alignment scoring only handles spectrum values, not exact-match multiple-choice

#### Open Questions

- How do multiple-choice answers map to alignment scoring? The current spectrum model uses a -1 to 1 range. Multiple-choice = exact match (1.0) vs mismatch (0.0)? Or weighted partial matches?
- Should the 7 existing spectrum questions be removed, kept alongside, or migrated to multiple-choice?
- How should candidate answer diversity be distributed in seed data? (e.g., random, correlated with existing spectrum positions, or manually curated per avatar)
- What's the cadence for question rotation? Per-round? Event-driven? Admin-triggered?

#### References

- [Ballard, 2026 — YouGov party issue priorities](https://today.yougov.com/politics/articles/53958-the-issues-that-democrats-and-republicans-want-their-parties-to-focus-on-more)
- [Marquette, 2026 — ICE approval survey](https://today.marquette.edu/2026/02/new-marquette-law-school-national-survey-finds-60-disapprove-of-the-work-of-ice-with-democrats-and-independents-opposed-to-ice-and-republicans-in-favor/)
- [Orth, 2023 — Inflation blame survey](https://today.yougov.com/economy/articles/45890-more-americans-now-blame-inflation-corporations)

---

## Archived Original Plan

The original PLAN-10 body has been archived to `docs/plans/archive/PLAN-10-original.md`. It contained outdated implementation details referencing the old onboarding quiz flow, stale route paths (`app/(tabs)/`, `app/settings/`), and mixed concerns. Do not reference it for implementation — use the successor plans above.
