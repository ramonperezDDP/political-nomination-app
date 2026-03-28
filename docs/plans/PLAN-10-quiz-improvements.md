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

#### Open Questions

- How do multiple-choice answers map to alignment scoring? The current spectrum model uses a -1 to 1 range. Multiple-choice options may need a different scoring model.
- Do candidates also answer these questions? If so, how do candidate responses get entered?
- Should the 7 existing spectrum questions be removed, kept alongside, or migrated to multiple-choice?
- Are these questions fixed in code or Firestore-driven (like the current issues)?

#### References

- [Ballard, 2026 — YouGov party issue priorities](https://today.yougov.com/politics/articles/53958-the-issues-that-democrats-and-republicans-want-their-parties-to-focus-on-more)
- [Marquette, 2026 — ICE approval survey](https://today.marquette.edu/2026/02/new-marquette-law-school-national-survey-finds-60-disapprove-of-the-work-of-ice-with-democrats-and-independents-opposed-to-ice-and-republicans-in-favor/)
- [Orth, 2023 — Inflation blame survey](https://today.yougov.com/economy/articles/45890-more-americans-now-blame-inflation-corporations)

---

## Archived Original Plan

The original PLAN-10 body has been archived to `docs/plans/archive/PLAN-10-original.md`. It contained outdated implementation details referencing the old onboarding quiz flow, stale route paths (`app/(tabs)/`, `app/settings/`), and mixed concerns. Do not reference it for implementation — use the successor plans above.
