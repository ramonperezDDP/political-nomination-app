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
- `docs/plans/PLAN-*.md` — implementation plans (00-19)
- `docs/feedback/` — stakeholder feedback and screenshots

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
