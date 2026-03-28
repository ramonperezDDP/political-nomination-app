# PLAN-14: Profile Page Fixes — SPLIT INTO 14A + 14B

> **Updated 2026-03-25:** Split per round 3 review. Original plan mixed safe header fixes with deferred features.

## PLAN-14A: Profile Header + Beta CTA Hiding ✅ COMPLETE (2026-03-27)

> **Sequence:** Implement after PLAN-17 (hard dependency — file paths changed). No dependency on PLAN-16 (independent work).

### 1. Update profile header defaults

**File:** `app/(main)/(profile)/index.tsx` (post-PLAN-17 location)

- Default display name: `'Your Name'` (shows "YN" initials in UserAvatar)
- Add verification label under name using **capability selectors** (NOT legacy `verificationStatus`):

```tsx
import { selectFullyVerified } from '@/stores';

const isFullyVerified = useUserStore(selectFullyVerified);

<Text variant="bodySmall" style={{ color: isFullyVerified ? theme.colors.primary : theme.colors.outline }}>
  {isFullyVerified ? 'Verified' : 'Unverified'}
</Text>
```

### 2. Hide Run for Office CTA during beta

**Files:** `app/(main)/(profile)/index.tsx`, `src/components/home/VoterHome.tsx`

Use `{false && ...}` guard. **Do NOT delete the code or styles** — will be re-enabled post-beta.

**Must be replaced** with `partyConfig.features?.runForOffice` before beta exits. This is a migration requirement, not a nice-to-have — `{false && ...}` is not an acceptable long-term feature control.

### Testing

- [x] Profile shows "YN" initials when no photo and name is default
- [x] "Unverified" appears for users missing any verification axis
- [x] "Verified" appears (primary color) when `selectFullyVerified` returns true
- [x] Run for Office card hidden on Profile (not present in VoterHome)

All tests verified 2026-03-27 via console log instrumentation and visual screenshot confirmation.

---

## PLAN-14B: Endorsements Page Redesign — 🔴 BLOCKED

> **Blocked on:** PLAN-12 (bookmark data model), PLAN-00 Phase 2 (round-scoped endorsements), [PLAN-17](./PLAN-17-unified-app-shell.md) (route restructure).

**Do NOT implement the endorsements page code from the original plan.** It contains:
- `verificationStatus === 'verified'` (stale — use capability selectors)
- Bookmark references (`bookmarks`, `handleEndorseAllBookmarks`) that don't exist yet
- Route paths (`/settings/endorsements`, `/(tabs)/for-you`) that will change under PLAN-17
- Flat endorsed/bookmarked split without round-scoping

**Before this can be implemented:**
1. PLAN-12 bookmark data model must be finalized and built (Firestore-persisted, round-aware)
2. PLAN-00 Phase 2 must land (round-scoped endorsements)
3. PLAN-17 must land (routes will change)
4. Endorsements page must distinguish current-round endorsements from all-time history

**Navigation:** Back button issues are solved by PLAN-17 (settings nested under Profile tab). Do NOT add local fixes.
