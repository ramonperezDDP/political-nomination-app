# PLAN-18: Endorsement Gate Consistency

> **Status:** Revised after two PM reviews (2026-03-29). Ready for implementation.
>
> **Priority:** High — unverified users can currently endorse via candidate detail and PSACard
>
> **Depends on:** None (independent fix)

## PM Review Findings

### Review 1 (2026-03-29)
1. **District check at store level (HIGH):** Added `candidateDistrict` parameter to `endorseCandidate()`.
2. **Firestore security rules (HIGH):** Current rules use a broken `isVerified()` helper. Rules must be fixed.
3. **Regression strategy (MEDIUM):** Added impact assessment step.
4. **Observability (MEDIUM):** Added analytics instrumentation.
5. **District mismatch test case (HIGH):** Added to testing checklist.

### Review 2 (2026-03-29)
6. **District enforcement in Firestore rules (HIGH):** Store `candidateDistrict` and `userDistrictIds` on endorsement docs and validate membership in rules.
7. **Make `candidateDistrict` required (MEDIUM):** Optional param silently disables the gate. Changed to required with compile-time enforcement.
8. **Verify actual verification field values (MEDIUM):** Confirmed `'verified'` is the literal string used — see `VerificationState` type in `src/types/index.ts` line 7.
9. **Legacy endorsement cleanup policy (MEDIUM):** Defined: grandfather existing endorsements in beta, add `legacyUnverified: true` flag for future audit.

## Problem

Only `FullScreenPSA` checks `selectEndorseLockReason` before calling `endorseCandidate()`. Three other endorsement entry points skip all verification:

| Component | Has Lock Check? | Has Lock UI? |
|-----------|----------------|--------------|
| `FullScreenPSA.tsx` | ✅ Full | ✅ Lock icon + EndorseLockModal |
| `CandidateDetailScreen.tsx` | ❌ None | ❌ Button always active |
| `PSACard.tsx` | ❌ None | ❌ Button always active |
| `MassEndorseButton.tsx` | ⚠️ Render-time only | ✅ Hidden when unverified |

Additionally, the Firestore security rules have a **broken verification check**: `isVerified()` references `data.verificationStatus` which doesn't exist on user documents (the actual fields are `data.verification.email`, `.voterRegistration`, `.photoId` — all using the literal string `'verified'` per the `VerificationState` type). This means the server-side endorsement gate is non-functional.

## Root Cause

1. Lock logic was implemented only in `FullScreenPSA` and never propagated to other endorsement surfaces.
2. Firestore `isVerified()` helper was written against a schema that was later changed to a nested `verification` object, but the rule was never updated.
3. No district eligibility check exists at any layer (client or server).

## Fix: Three-Layer Defense

### Layer 1: Firestore Security Rules (server-side — the real security boundary)

Fix the broken `isVerified()` helper, add district validation, and add bookmarks rules:

```javascript
// Fixed helper: check all three verification fields
// VerificationState type confirms literal 'verified' string (src/types/index.ts:7)
function isFullyVerified() {
  let userData = get(/databases/$(database)/documents/users/$(request.auth.uid)).data;
  return isAuthenticated() &&
    userData.verification.email == 'verified' &&
    userData.verification.voterRegistration == 'verified' &&
    userData.verification.photoId == 'verified';
}

// District check: endorsement doc must include candidateDistrict and userDistrictIds.
// Client writes both; rule validates candidateDistrict is in userDistrictIds.
// odid == auth.uid prevents impersonation of another user's districts.
function isInDistrict() {
  return request.resource.data.candidateDistrict in request.resource.data.userDistrictIds;
}

// Endorsements — requires full verification, ownership, and district match
match /endorsements/{endorsementId} {
  allow read: if isAuthenticated();
  allow create: if isFullyVerified() &&
    request.resource.data.odid == request.auth.uid &&
    isInDistrict();
  allow update: if request.auth.uid == resource.data.odid;
  allow delete: if request.auth.uid == resource.data.odid || isAdmin();
}

// Bookmarks (new collection from PLAN-00 Phase 2)
match /bookmarks/{bookmarkId} {
  allow read: if isAuthenticated();
  allow create: if isAuthenticated() &&
    bookmarkId.matches(request.auth.uid + '_.*');
  allow update: if bookmarkId.matches(request.auth.uid + '_.*');
  allow delete: if bookmarkId.matches(request.auth.uid + '_.*') || isAdmin();
}
```

**District validation approach:** The client writes `candidateDistrict` (string) and `userDistrictIds` (string[] of the user's verified district IDs) on each endorsement doc. The rule checks `candidateDistrict in userDistrictIds`. The `odid == auth.uid` check prevents impersonation — a tampered client can't claim another user's districts since the odid must match the auth token.

### Layer 2: Store-level gate (client-side safety net)

Add verification + district checks inside `userStore.endorseCandidate()`. **`candidateDistrict` is required** (not optional) for compile-time enforcement:

```ts
endorseCandidate: async (
  odid: string,
  candidateId: string,
  candidateDistrict: string,  // REQUIRED — compile-time enforcement
  roundId?: string
) => {
  if (get().hasEndorsedCandidate(candidateId)) return true;

  const profile = get().userProfile;

  // Gate: must have an account
  if (!profile || profile.isAnonymous) {
    set({ error: 'Create an account to endorse' });
    return false;
  }

  // Gate: must be fully verified
  if (profile.verification?.email !== 'verified' ||
      profile.verification?.voterRegistration !== 'verified' ||
      profile.verification?.photoId !== 'verified') {
    set({ error: 'Complete verification to endorse' });
    return false;
  }

  // Gate: must be in candidate's district
  const userDistrictIds = profile.districts?.map(d => d.id) || [];
  if (!userDistrictIds.includes(candidateDistrict)) {
    set({ error: "You are not verified in this candidate's district" });
    return false;
  }

  // Write endorsement with district fields for Firestore rule validation
  await createEndorsementInFirestore(odid, candidateId, roundId, {
    candidateDistrict,
    userDistrictIds,
  });
  // ...
}
```

### Layer 3: UI-level gating (user feedback)

Apply the `FullScreenPSA` lock pattern to the other two components:

#### `CandidateDetailScreen.tsx`
- Import `selectEndorseLockReason`, `selectHasAccount` from `@/stores`
- Import `EndorseLockModal` from `@/components/feed/EndorseLockModal`
- Derive `lockReason` using the candidate's district
- Gate `handleToggleEndorsement`: if locked, show modal instead of endorsing
- Update button: lock icon + muted styling when locked
- District mismatch UX: modal message "You are not verified in this candidate's district. Complete voter registration to endorse."

#### `PSACard.tsx`
- Same pattern as CandidateDetailScreen

#### `MassEndorseButton.tsx`
- Already hides button for unverified users at render time
- Add per-candidate district filter inside the batch loop as defense-in-depth

## Implementation Steps

### Step 0: Impact assessment

Before implementing, run a one-time query to count endorsements from unverified users:
```
Query endorsements collection → for each unique odid, check user verification status.
```

**Policy for existing endorsements:** In beta with seeded data, grandfather all existing endorsements. Tag any from unverified users with `legacyUnverified: true` for future audit. No deletions — endorsement counts remain stable.

### Step 1: Fix Firestore security rules (`firebase/firestore.rules`)

- Replace broken `isVerified()` with `isFullyVerified()` checking nested verification fields
- Add `isInDistrict()` helper validating `candidateDistrict in userDistrictIds`
- Add `bookmarks` collection rules (read: authenticated, write: owner based on doc ID prefix)
- **Deploy order:** Deploy rules AFTER the app update ships, so the app writes the required `candidateDistrict`/`userDistrictIds` fields before the rules start requiring them. Alternatively, make the district rule conditional: `(!('candidateDistrict' in request.resource.data) || isInDistrict())` during transition.

### Step 2: Store-level gate (`src/stores/userStore.ts`)

- Change `candidateDistrict` to a **required** parameter in `endorseCandidate` (move before optional `roundId`)
- Add verification + district checks before the Firestore call
- Return `false` and set descriptive error message on rejection
- Pass `candidateDistrict` and `userDistrictIds` to Firestore write for rule validation
- **All call sites will get a TypeScript error** until updated — this is intentional

### Step 3: UI gating — `CandidateDetailScreen.tsx`

- Import lock selector and EndorseLockModal
- Add `showLockModal` state
- Derive `lockReason` from `selectEndorseLockReason(candidate.district)`
- Gate `handleToggleEndorsement`
- Show lock icon + disabled styling on button when locked

### Step 4: UI gating — `PSACard.tsx`

- Same pattern as Step 3

### Step 5: Update `MassEndorseButton.tsx`

- Add per-candidate district check inside the endorsement loop
- Skip candidates whose district doesn't match user's verified districts

### Step 6: Update all call sites (TypeScript-enforced)

Since `candidateDistrict` is required, TypeScript will flag every call site:
- `FullScreenPSA.tsx` — pass `candidate.district`
- `CandidateDetailScreen.tsx` — pass `candidate.district`
- `PSACard.tsx` — pass `candidate.district`
- `MassEndorseButton.tsx` — pass `item.candidate.district`
- `reEndorseFromBookmark` in userStore — pass district from caller

### Step 7: Observability

- Log endorsement gate rejections: `console.warn('Endorsement blocked:', { reason, odid, candidateId, candidateDistrict })`
- For production: add analytics event `endorsement_blocked` with `{ reason, candidateDistrict }` to monitor impact
- Monitor Firestore rule rejections via Firebase Console > Rules > Monitoring tab

## Testing

- [ ] **Firestore rules:** Unverified user write to endorsements is rejected by rules
- [ ] **Firestore rules:** Verified user writing endorsement without `candidateDistrict` is rejected
- [ ] **Firestore rules:** Verified user writing endorsement with wrong district is rejected
- [ ] **Firestore rules:** Bookmarks collection allows authenticated owner writes
- [ ] **Store gate:** Unverified user calling `endorseCandidate()` returns false with error
- [ ] **Store gate:** User not in candidate's district gets district mismatch error
- [ ] **Store gate:** Verified user in correct district can endorse normally
- [ ] **TypeScript:** All call sites pass `candidateDistrict` (no compilation errors)
- [ ] **CandidateDetailScreen:** Unverified user sees lock icon on endorse button
- [ ] **CandidateDetailScreen:** Tapping locked button shows EndorseLockModal with reason
- [ ] **CandidateDetailScreen:** District mismatch shows appropriate modal message
- [ ] **PSACard:** Unverified user sees lock icon, tapping shows modal
- [ ] **MassEndorseButton:** Skips candidates outside user's districts in batch loop
- [ ] **FullScreenPSA:** No regression — existing lock behavior unchanged
- [ ] **Revocation:** Verified user can still revoke existing endorsements
- [ ] **Legacy:** Existing endorsements without district fields still display correctly

## Files Modified

- `firebase/firestore.rules` — fix `isVerified()`, add `isFullyVerified()`, add `isInDistrict()`, add bookmarks rules
- `src/stores/userStore.ts` — add verification + district gate to `endorseCandidate`, make `candidateDistrict` required
- `src/services/firebase/firestore.ts` — write `candidateDistrict` + `userDistrictIds` on endorsement docs
- `src/services/firebase/firestore.web.ts` — same as above
- `src/screens/CandidateDetailScreen.tsx` — add lock check + EndorseLockModal
- `src/components/feed/PSACard.tsx` — add lock check + EndorseLockModal
- `src/components/feed/MassEndorseButton.tsx` — add per-candidate district filter in loop
- `src/components/feed/FullScreenPSA.tsx` — pass `candidateDistrict` to `endorseCandidate`

## Rollback Strategy

If the gate causes unexpected blocking in beta:
1. **Store gate:** Revert `userStore.ts` to make `candidateDistrict` optional again (single file)
2. **Firestore rules:** Roll back via `firebase deploy --only firestore:rules` with the previous version. Transition rule (`!('candidateDistrict' in request.resource.data) || isInDistrict()`) allows graceful degradation.
3. **UI changes:** Lock icons/modals are cosmetic and don't block functionality on their own — can be reverted independently
