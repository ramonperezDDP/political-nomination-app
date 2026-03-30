# PLAN-12: For You Page Improvements — 🟡 Partially Implemented

> **Status:** Partially implemented. Bookmarks complete (PLAN-00 Phase 2). Remaining: extract alignment explainer to reusable modal component.
>
> **Blocked on:** PLAN-00 Phase 2 (written, ready for review). ~~Bookmark domain spec~~ — resolved in PLAN-00 Phase 2 (bookmarks = converted endorsements, subcollection). ~~dealbreaker removal (PLAN-10)~~ — resolved 2026-03-28.

> **Depends on:** [PLAN-00 Phase 2](./PLAN-00-contest-round-architecture.md) — hiding eliminated candidates, round-scoped endorsements. Phase 3 — round-appropriate voting UI.

## Product Decisions (Confirmed 2026-03-25)

1. **Bookmarks are round-aware pre-endorsements.** If a bookmarked candidate is eliminated, alert the user and block conversion to endorsement.
2. **Remove share gating.** Sharing is discovery/advocacy, not a binding political action. Do NOT require verification to share.
3. ~~**Dealbreakers are being removed** (PLAN-10).~~ **RESOLVED 2026-03-28:** Dealbreaker code fully removed in PLAN-10A. Alignment explainer no longer contains dealbreaker content.

## What This Plan Covers (Intent)

1. **Alignment explainer modal** — extract from candidate detail, make tappable on feed cards
2. **Bookmarking system** — unverified users "save" candidates; converts to endorsements after verification
3. **Sharing** — enable for all users (no verification gate)

## What Must Be Specified Before Implementation

### Bookmark Domain Spec (prerequisite — write this first)

**Core principle:** Bookmarks are round-aware endorsement intent records, but remain user-visible as historical saves after they become non-convertible.

The original plan proposed `{ id, odid, candidateId, createdAt }`. That is insufficient for round-aware pre-endorsements. A dedicated spec must define:

**Data model:**
- `userId`, `candidateId`, `roundId`, `browsingDistrict`, `createdAt`
- `status`: `'active' | 'endorsed' | 'invalidated'`
- `invalidatedReason?`: `'candidate_eliminated' | 'round_changed' | 'district_mismatch'`
- `endorsedAt?`, `endorsementId?`

**`browsingDistrict` semantics:** This field is **informational only** — it records which district the user was browsing when they bookmarked. It is NOT used in conversion validation (verified district eligibility is checked at endorsement time, not bookmark time). It exists for audit/analytics and for user messaging ("you bookmarked this candidate while browsing PA-02").

**Firestore collection:** `bookmarks` (user-scoped subcollection or top-level with userId index)

**Lifecycle rules:**
- When a bookmarked candidate is eliminated → set `status: 'invalidated'`, `invalidatedReason: 'candidate_eliminated'`
- When round advances → existing bookmarks for the old round remain readable but cannot be converted
- When user verifies in a district that doesn't match the bookmarked candidate → alert but don't auto-invalidate (user may have browsing-district bookmarks)
- Post-verification: show active bookmarks with "Endorse" option; show invalidated bookmarks with explanation

**Subscription strategy:**
- Firestore-persisted (NOT in-memory userStore only)
- Feed screen does NOT subscribe directly — userStore subscribes once on auth, exposes via selectors
- Must work across sessions and devices

### Alignment Explainer Refactor

Before extracting the alignment modal for reuse:
- **Hard dependency:** PLAN-10 dealbreaker migration must remove dealbreaker content from the explainer FIRST
- Then PLAN-12 can extract and reuse the cleaned modal
- Source file: `src/screens/CandidateDetailScreen.tsx` (post-PLAN-17 location, was `app/candidate/[id].tsx`)
- Target: `src/components/feed/AlignmentExplainerModal.tsx`

## Original Implementation Details

> **WARNING:** The code examples below are from the original plan and contain stale patterns:
> - Share gating code (REMOVED — product decision)
> - `Bookmark` type with only 3 fields (INSUFFICIENT — see spec above)
> - In-memory bookmark state in userStore (BROKEN — needs Firestore persistence)
> - `verificationStatus === 'verified'` (STALE — use capability selectors)
>
> Do NOT copy these examples. Write fresh implementation after the Bookmark Domain Spec is complete.

## Testing (Updated)

- Tap alignment badge on any candidate card → explainer modal appears (no dealbreaker content)
- Tap share → native share sheet (NO verification gate)
- Unverified user taps endorse → candidate is bookmarked with confirmation
- Bookmarked candidate is eliminated → user sees alert, bookmark shows as invalidated
- Round advances → old-round bookmarks are not convertible
- After verification, active bookmarks show "Endorse" option
- Bookmarks persist across app restart (Firestore-backed)
