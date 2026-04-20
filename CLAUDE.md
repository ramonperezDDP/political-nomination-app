# CLAUDE.md — Project Instructions

## Project Overview

America's Main Street Party (AMSP) App — a cross-platform (iOS, Android, Web) political nomination platform built with React Native 0.76.9, Expo 52, TypeScript 5.6, and Firebase. Branded with AMSP purple (#5a3977), blue (#067eba), red (#de482e), Nunito Sans typeface, and Material Design 3 via React Native Paper.

## Quick Start

### PATH (required every session)
```bash
export PATH="/opt/homebrew/opt/node@20/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"
```

### iOS Simulator
```bash
npx expo start                                          # Start Metro on :8081
xcrun simctl boot "iPhone 16e" && open -a Simulator     # Boot simulator
xcrun simctl launch booted com.politicalnomination.app  # Launch app
```

### Web (local)
```bash
npx expo export --platform web    # Build to dist/
npx serve dist -s -l 3000        # Serve with SPA mode
```
Requires `.env` with `EXPO_PUBLIC_FIREBASE_*` vars (see `.env.example`). Clear `dist/`, `.expo/`, `node_modules/.cache/` after changing `.env`.

### Common Commands
| Task | Command |
|------|---------|
| Type check | `npx tsc --noEmit` |
| Start Metro | `npx expo start` |
| iOS build | `npx expo run:ios` |
| Web build + deploy | `npm run deploy` |
| Screenshot simulator | `xcrun simctl io booted screenshot /tmp/screenshot.png` |
| Kill stale processes | `pkill -9 -f "expo"; pkill -9 -f "metro"` |
| Bio preview | `npm run build:bios` |
| Zone preview | `npm run map:zones` |
| Seed candidates (dry-run) | `npm run seed:candidates` |
| Seed candidates (apply) | `npm run seed:candidates:apply` |
| Candidate text-only update | `npm run seed:candidates:text` |
| Candidate asset-only update | `npm run seed:candidates:assets` |

## Architecture

### Platform Files
Native uses `@react-native-firebase/*`; web uses `firebase` JS SDK via `.web.ts` files:
- `config.web.ts`, `auth.web.ts`, `firestore.web.ts`, `storage.web.ts`
- `src/types/index.web.ts`, `src/stores/authStore.web.ts`

Metro resolves `.web.ts` automatically on web builds. Consumer code imports from `@/services/firebase/auth` — no platform conditionals needed.

### State Management
- **Zustand** stores: `authStore`, `configStore`, `userStore`, `candidateStore`
- **TanStack Query** for server state
- **ConfigStore** subscribes to `partyConfig` in real-time via Firestore `onSnapshot`

### Contest Rounds (7 total, PLAN-19)
Endorsement One → Endorsement Two → Endorsement Three → Virtual Town Hall → Debate → Final Results → Post-Election

Source of truth: `partyConfig.currentRoundId` in Firestore. Default fallback: `'round_1_endorsement'`. The legacy `pre_nomination` round was removed from types/code but its Firestore doc is retained for audit trail (filtered out in configStore).

## Critical Rules

### Zustand Selectors
**NEVER** create new references in selectors — no `.map()`, `.filter()`, `.sort()`, `[...spread]`, or `|| []`. These cause infinite re-renders that freeze the simulator. Select stable primitives or raw store references; derive computed values with `useMemo` in the component.

### Portal Components (React Native Paper)
Always conditionally render Paper `<Modal>`, `<Menu>`, `<Dialog>` — they block all touch events even when `visible={false}` because Portal sits above other content.
```tsx
// GOOD: {showModal && <Modal visible={showModal} ... />}
// BAD:  <Modal visible={showModal} ... />
```

### Firestore Writes
- Never pass `undefined` values to `update()` / `set()` — filter them out first
- Wrap reseed/write operations in their own try/catch so permission errors don't break the read path

### Web Compatibility
- SafeAreaView must be aliased to `View` on web (style array issue)
- Style arrays on Paper components need `StyleSheet.flatten()`
- `enableScreens(false)` on web; use `<Slot />` instead of `<Stack>`/`<Tabs>`
- `useWindowDimensions()` returns browser window size, not phone frame size — use `onLayout` on web
- Phone frame breakpoints: full >950px, 85% at 800-950px, 75% at 580-800px, hidden ≤580px
- Test CSS breakpoints in Chrome with bookmarks bar visible (Chrome UI eats 150px+)

### iOS Build
Podfile requires `use_frameworks! :linkage => :static` — must re-patch after every `expo prebuild --clean`.

### Environment
- **Node 20 LTS** required (Node 25+ has compatibility issues)
- **Never develop on iCloud Drive** — causes Metro hangs, corrupted node_modules
- `GoogleService-Info.plist` must exist in project root AND `ios/PoliticalNomination/`

## Key Docs
- `docs/TROUBLESHOOTING.md` — comprehensive guide to all known issues and fixes
- `docs/DEPENDENCIES.md` — full dependency catalog
- `docs/plans/PLAN-*.md` — implementation plans (00-20)
- `docs/plans/PLAN-20-seed-candidate-profiles.md` — candidate roster management (JSON source of truth, seeder, bio + zone tools)
- `docs/feedback/` — stakeholder feedback and screenshots

## Candidate Roster Management

The 202 fictional candidates (101 per district, PA-01 and PA-02) live in `scripts/data/candidates-PA-{01,02}.json` — this is the **canonical source of truth**, edited by hand and committed to git. Do NOT re-add hardcoded candidates to `src/services/firebase/firestore.ts` (the old `seedCandidates()` was removed after the PLAN-20 live seed).

Flow for any candidate change:
1. Edit `scripts/data/candidates-PA-XX.json` directly (name, age, quiz answers, neighborhood, etc.).
2. Optional: `npm run build:bios` / `npm run map:zones` to preview bio + zone derivation.
3. `npm run seed:candidates` to dry-run the Firestore + Storage diff.
4. `npm run seed:candidates:apply` to write.

See PLAN-20 for the full workflow matrix, including avatar/video uploads (hash-diffed), batch text/asset updates, and the destructive-operation safety gates (typed confirmation, backup recipe, emulator dry-run).

**Stable IDs:** `seed-PA-XX-NNN` for candidates, `seed-user-PA-XX-NNN` for users, `seed-psa-PA-XX-NNN` for PSAs. Do not reuse these prefixes for non-seed data.

**Avatar thumbnails:** `CandidateAvatar` prefers `thumbnailUrl` (256 px JPEG, ~20 KB) over `photoUrl` (full-size PNG). Thumbnails live at `profileThumbnails/{userId}/thumbnail.jpg` in Storage AND at `assets/candidates/PA-{01,02}-Profile-Thumbs/` in git. The For You full-screen background still loads the full photo; everything else uses the thumbnail. Tapping the avatar on the candidate profile opens a bottom-sheet viewer with the full photo + About + Why I'm Running (matches the `QuizBottomSheet` / `VerifyIdentitySheet` pattern). Thumbnail generation shells out to macOS `sips` — non-macOS contributors will need to swap in `sharp` or similar.

## Round-Aware Limits

`src/utils/contestRounds.ts` is the source of truth for per-round caps:

- `getRoundCandidateLimit(roundId)` — how many candidates are visible in this round. Round 1: `undefined` (unlimited); Round 2: 20; Round 3: 10; VTH: 4; Debate: 2; Final/Post: 1.
- `getRoundAdvancementCount(roundId)` — how many advance to the next round. R1→20, R2→10, R3→4, VTH→2, Debate→1; terminal rounds return `undefined`.

Every fetch of candidates in UI code (For You feed, leaderboard, filter sheet, character search) threads `getRoundCandidateLimit(currentRoundId)` through to `getApprovedCandidates` / `getCandidatesForFeed` / `getCandidatesWithUsers`. Leaderboard cutoff line uses `getRoundAdvancementCount` — label reads "Top N advance," terminal rounds render no line. **Do not reintroduce hardcoded `.slice(0, 50)` or threshold-based (e.g. `< 1000 endorsements`) cutoffs anywhere.**

## Backup Bucket (Firestore exports)

Firestore exports must target `gs://party-nomination-app-backups` (us-central1). The live app storage bucket `gs://party-nomination-app.firebasestorage.app` is us-east1, which Firestore exports reject. The backups bucket was created 2026-04-19.

## Firestore Collections
```
partyConfig/{doc}           → currentRoundId, contestMode, endorsementCutoffs
contestRounds/{roundId}     → 7 round definitions (orders 1-7)
candidates/{id}             → status, endorsementCount, contestStatus
endorsements/{id}           → odid, candidateId, roundId, isActive
bookmarks/{odid}_{cid}      → carry-forward with convertedFromRoundId
contestTransitions/{opId}   → audit trail of round transitions
users/{id}                  → profile, verification, districts
```

## Bundle ID & Firebase
- **App bundle ID:** `com.politicalnomination.app`
- **Firebase project:** `party-nomination-app`
- **Hosted URL:** `https://party-nomination-app.web.app`
