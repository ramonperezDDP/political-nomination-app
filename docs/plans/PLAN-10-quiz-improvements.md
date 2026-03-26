# PLAN-10: Quiz Improvements — 🔴 REPLACED BY SUCCESSOR PLANS

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

### PLAN-10C: Issue Scope Taxonomy (Global / National / Local)

**Status:** Not yet written. Requires content team input.

**Scope:** Add `scope: 'global' | 'national' | 'local'` to the Issue type and organize quiz sections under scope headers.

**Requirements:**
- Add `scope` field to `Issue` type in `src/types/index.ts` and `index.web.ts`
- Update issue seed data with scope assignments (needs content team confirmation)
- Update quiz UI to group issues under Global/National/Local section headers
- Update Firestore seed function to include scope

**Scope mapping (tentative — needs confirmation):**
- Global: Climate/Environment, Immigration
- National: Economy, Healthcare, Education, Gun Policy
- Local: Infrastructure, Housing, Public Safety

---

## Archived Original Plan

The original PLAN-10 body has been archived to `docs/plans/archive/PLAN-10-original.md`. It contained outdated implementation details referencing the old onboarding quiz flow, stale route paths (`app/(tabs)/`, `app/settings/`), and mixed concerns. Do not reference it for implementation — use the successor plans above.
