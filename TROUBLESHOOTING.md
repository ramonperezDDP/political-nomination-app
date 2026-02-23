# Troubleshooting Guide

This document covers common issues encountered when developing the America's Main Street Party app, along with solutions.

> **Important:** Many build and Metro issues previously documented here were traced back to developing on iCloud Drive. If you are experiencing mysterious hangs, corrupted caches, or flaky builds, the first thing to check is whether your project is on iCloud Drive. See [macOS Environment Setup](#macos-environment-setup).

## Table of Contents
- [macOS Environment Setup](#macos-environment-setup)
- [Node.js Version Requirements](#nodejs-version-requirements)
- [iOS Build Issues](#ios-build-issues)
- [Dev Server Connection Issues](#dev-server-connection-issues)
- [TypeScript Issues](#typescript-issues)
- [Quick Recovery Steps](#quick-recovery-steps)
- [Web Build & Deployment Issues](#web-build--deployment-issues)
- [Known Runtime Warnings](#known-runtime-warnings-non-blocking)
- [Verified Clean Build Procedure](#verified-clean-build-procedure)

---

## macOS Environment Setup

### Do NOT Develop on iCloud Drive

**This is the single most important thing in this guide.** If your project is in an iCloud Drive path (e.g. `~/Library/Mobile Documents/com~apple~CloudDocs/...`), clone it to a local directory first:

```bash
git clone <repo-url> ~/Developer/political-nomination-app
cd ~/Developer/political-nomination-app
```

iCloud Drive was the root cause of nearly all Metro and build instability we encountered, including:
- **Metro hanging or returning 0 bytes** - iCloud syncing files while Metro's file watcher is reading them
- **Build hanging at "Planning build"** - slow iCloud I/O causing Xcode to stall
- **Corrupted node_modules** - iCloud creating duplicate folders (e.g. `@babel 2`)
- **`npm install` taking forever** - iCloud syncing thousands of small files
- **`rm -rf node_modules` taking 10+ minutes** - iCloud holding file locks
- **Needing system reboots** to recover from hung processes

Once we moved to a local directory, the build succeeded on the first attempt with zero Metro issues.

### CocoaPods: Use Homebrew (Not Ruby Gems)

System Ruby 2.6 on macOS is incompatible with modern CocoaPods. Always install via Homebrew:

```bash
# Fix Homebrew permissions if needed (requires admin)
sudo chown -R $(whoami) /opt/homebrew
sudo chmod -R u+w /opt/homebrew

# Install CocoaPods (bundles its own Ruby)
brew install cocoapods

# Verify
pod --version  # Should show 1.16.x+
```

Do NOT use `sudo gem install cocoapods` - it will fail with `activesupport` Logger errors on system Ruby 2.6.

### Recommended Homebrew Packages

```bash
brew install cocoapods watchman node@20
```

### Full PATH for Development

```bash
export PATH="/opt/homebrew/opt/node@20/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"
```

Add this to your `~/.bash_profile` or `~/.zshrc` for persistence.

### GoogleService-Info.plist Placement

The Firebase config file must exist in **two** locations:
1. Project root: `./GoogleService-Info.plist`
2. iOS target: `./ios/PoliticalNomination/GoogleService-Info.plist`

If the iOS build fails with `Build input file cannot be found: .../GoogleService-Info.plist`, copy it:

```bash
cp GoogleService-Info.plist ios/PoliticalNomination/
```

---

## Node.js Version Requirements

### Recommended Version
**Node.js 20 LTS** is the recommended version for this project.

### Known Issues with Node.js 25+
- Node.js 25.x has compatibility issues with some Expo/Metro packages
- May cause `ERR_INVALID_PACKAGE_CONFIG` errors with the `--clear` flag
- Some packages show as "extraneous" in node_modules

### How to Switch Node Versions

Using Homebrew:
```bash
# Install Node 20
brew install node@20

# Use Node 20 temporarily
export PATH="/opt/homebrew/opt/node@20/bin:$PATH"
node --version  # Should show v20.x.x

# Run commands with Node 20
npm run ios
```

Using nvm:
```bash
nvm install 20
nvm use 20
```

---

## iOS Build Issues

### Error: "gRPC-Core.modulemap not found"

**Symptom:**
```
error: module map file '.../ios/Pods/Headers/Private/grpc/gRPC-Core.modulemap' not found
```

**Cause:** Conflict between global `use_modular_headers!` and gRPC dependencies used by Firebase Firestore.

**Solution:** Update `ios/Podfile` to use static frameworks instead:

```ruby
# In ios/Podfile, inside the target block:
target 'PoliticalNomination' do
  use_frameworks! :linkage => :static  # ADD THIS LINE
  use_expo_modules!
  # ... rest of config
end
```

Then rebuild:
```bash
cd ios
rm -rf Pods Podfile.lock
pod install
cd ..
npm run ios
```

### Error: "Swift pod cannot be integrated as static library"

**Symptom:**
```
The Swift pod `FirebaseAuth` depends upon `FirebaseAuthInterop`... which do not define modules
```

**Solution:** Use the `use_frameworks! :linkage => :static` approach described above.

### `expo prebuild --clean` Overwrites Podfile

**Symptom:** After running `npx expo prebuild --clean --platform ios`, `pod install` fails with:
```
The Swift pod `FirebaseAuth` depends upon `FirebaseAuthInterop`... which do not define modules
```

**Cause:** `expo prebuild --clean` regenerates the Podfile from the Expo template, which does NOT include our required `use_frameworks! :linkage => :static` line. It also re-enables conditional `use_frameworks!` lines that conflict with our unconditional one.

**Solution:** After every `expo prebuild --clean`, edit `ios/Podfile`:

1. Add `use_frameworks! :linkage => :static` as the first line inside the target block:
```ruby
target 'PoliticalNomination' do
  use_frameworks! :linkage => :static  # ADD THIS LINE
  use_expo_modules!
```

2. Comment out the conditional `use_frameworks!` lines that prebuild generates:
```ruby
  # use_frameworks! :linkage => podfile_properties['ios.useFrameworks'].to_sym if podfile_properties['ios.useFrameworks']
  # use_frameworks! :linkage => ENV['USE_FRAMEWORKS'].to_sym if ENV['USE_FRAMEWORKS']
```

3. Then run `cd ios && pod install && cd ..`

### typedRoutes Causing Metro Hang

The `experiments.typedRoutes` setting in app.json can cause Metro to hang with the message "Waiting for TypeScript files to be added to the project...". As of Feb 2026, this is disabled in app.json:

```json
"experiments": {
  "typedRoutes": false
}
```

---

## Dev Server Connection Issues

### "Could not connect to development server"

**Symptom:** App shows error connecting to development server with URL like `http://192.168.x.x:8081`

**Cause:** App is trying to connect to network IP instead of localhost

**Solutions:**

1. **Use localhost URL directly:**
   ```bash
   # Open app with localhost
   xcrun simctl openurl booted "exp+political-nomination-app://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8081"
   ```

2. **Start Expo with localhost flag:**
   ```bash
   npx expo start --localhost
   ```

3. **In Expo Dev Client:** Go to "Recently opened" and select the localhost entry

### URI Scheme Warning

**Message:**
```
Could not find a shared URI scheme for the dev client between the local /ios and /android directories
```

**Cause:** No Android directory exists (iOS-only project)

**Impact:** This is just a warning and doesn't affect iOS development. QR code scanning won't work but direct launch does.

---

## TypeScript Issues

### Status: Clean (All Errors Fixed)

As of Feb 10, 2026, `npx tsc --noEmit` passes with **zero errors**. The following issues were fixed:

| Error | File | Fix |
|-------|------|-----|
| ViewStyle array type mismatch | `app/candidate/[id].tsx:431` | Cast conditional style array with `as any` |
| ViewStyle array type mismatch | `src/components/feed/PSACard.tsx:244` | Cast conditional style array with `as any` |
| `searchQuery` not defined | `src/components/home/CandidateHome.tsx:42` | Added missing `const [searchQuery] = React.useState('')` |
| `averageSpectrum` missing from leaderboard | `src/services/firebase/firestore.ts:1873,1896` | Computed from `candidate.topIssues` spectrum positions |

**Note:** These errors do not prevent the app from building or running. Metro/Babel strips types at build time and never runs `tsc`. The fixes ensure correctness for CI type-checking.

To verify:
```bash
npx tsc --noEmit
```

---

## Quick Recovery Steps

If something is broken, try these steps in order:

### Step 0: Check Your Working Directory
Make sure you are NOT on iCloud Drive. If you are, clone to a local path first (see [above](#do-not-develop-on-icloud-drive)). This alone fixes most issues.

### Level 1: Clear Caches
```bash
rm -rf .expo/
rm -rf node_modules/.cache/
watchman watch-del-all
npx expo start --clear
```

### Level 2: Reset iOS Build
```bash
cd ios
rm -rf Pods Podfile.lock build
pod install
cd ..
npm run ios
```

### Level 3: Full Reset
```bash
# Kill all processes
pkill -f "expo"
pkill -f "metro"
pkill -f "node"

# Reset watchman
watchman watch-del-all
watchman shutdown-server

# Clear everything
rm -rf .expo/
rm -rf node_modules/
rm -rf ios/Pods ios/Podfile.lock ios/build
rm -rf package-lock.json

# Reinstall
npm install

# Rebuild iOS
cd ios && pod install && cd ..

# Start fresh
npx expo start --clear
```

---

## Web Build & Deployment Issues

### "react-native-web not found" Error

**Symptom:**
```
CommandError: It looks like you're trying to use web support but don't have the required dependencies installed.
```

**Solution:**
```bash
npx expo install react-native-web
```

### Web Build Fails with Firebase Import Errors

**Symptom:** Errors referencing `@react-native-firebase/*` packages during web build.

**Cause:** The native Firebase packages (`@react-native-firebase/*`) don't support web. Metro should be resolving `.web.ts` files instead.

**Solution:** Ensure all `.web.ts` platform files exist:
- `src/services/firebase/config.web.ts`
- `src/services/firebase/auth.web.ts`
- `src/services/firebase/firestore.web.ts`
- `src/services/firebase/storage.web.ts`
- `src/types/index.web.ts`
- `src/stores/authStore.web.ts`

These files use the `firebase` JS SDK instead of `@react-native-firebase/*`.

### Firebase Hosting Deploy Fails

**Symptom:** `firebase deploy --only hosting` fails.

**Solutions:**
1. Ensure `firebase-tools` is installed: `npm install -g firebase-tools`
2. Ensure you're logged in: `firebase login`
3. Ensure `.firebaserc` points to the correct project
4. Ensure `dist/` directory exists (run `npm run build:web` first)
5. Check `firebase.json` has a `hosting` section with `"public": "dist"`

### Web App Shows Blank Screen After Deploy

**Cause:** Missing `EXPO_PUBLIC_FIREBASE_APP_ID_WEB` environment variable.

**Solution:**
1. Go to Firebase Console > Project Settings > Your apps > Add web app
2. Copy the `appId` value
3. Set `EXPO_PUBLIC_FIREBASE_APP_ID_WEB` in your `.env` file
4. Rebuild: `npm run build:web`

### Web Auth Not Working

**Symptom:** Login/signup fails on web but works on native.

**Solutions:**
1. Ensure `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN` is set in `.env`
2. In Firebase Console > Authentication > Settings > Authorized domains, add your hosting domain
3. Check browser console for specific error messages

---

## Known Runtime Warnings (Non-Blocking)

These warnings appear in the Metro logs but do not affect app functionality:

### Firebase Namespaced API Deprecation
```
WARN  This method is deprecated (as well as all React Native Firebase namespaced API)...
```
The codebase uses the legacy Firebase namespaced API. These warnings are informational and will need to be addressed before upgrading to RN Firebase v22. See [migration guide](https://rnfirebase.io/migrating-to-v22).

### Firestore Permission Denied
```
WARN  Error checking questions: [Error: [firestore/permission-denied]...]
```
This occurs when the user is not authenticated. It is expected behavior from Firestore security rules, not a code bug.

### CoreHaptics (iOS Simulator Only)
```
CHHapticPattern: Failed to read pattern library data... hapticpatternlibrary.plist
```
This is an iOS 26 simulator issue. Haptic feedback is not available in the simulator; the app falls back gracefully. Does not appear on physical devices.

### CoreUI Theme Warning
```
CoreUI: CUIThemeStore: No theme registered with id=0
```
Standard iOS simulator noise. No impact on the app.

---

## Verified Clean Build Procedure

The following steps produced a successful build from a completely clean state on Feb 10, 2026. Use this as a reference if starting fresh.

### Prerequisites
- macOS with Xcode 26.2+
- Homebrew with `node@20`, `cocoapods`, `watchman` installed
- `GoogleService-Info.plist` downloaded from Firebase Console

### Steps

```bash
# 1. Clone to a LOCAL directory (NOT iCloud Drive)
git clone https://github.com/ramonperezDDP/political-nomination-app.git ~/Developer/political-nomination-app
cd ~/Developer/political-nomination-app

# 2. Copy Firebase config into project root
cp /path/to/GoogleService-Info.plist .

# 3. Use Node 20 for this session
export PATH="/opt/homebrew/opt/node@20/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"
node --version  # Should show v20.x.x

# 4. Install dependencies (takes ~10 seconds on local disk)
npm install

# 5. Verify TypeScript (should pass clean)
npx tsc --noEmit

# 6. Generate iOS native project
npx expo prebuild --clean --platform ios

# 7. CRITICAL: Patch the Podfile (prebuild overwrites it)
#    - Add `use_frameworks! :linkage => :static` after `target ... do`
#    - Comment out the two conditional use_frameworks! lines
#    (See "expo prebuild --clean Overwrites Podfile" section above)

# 8. Install CocoaPods
cd ios && pod install && cd ..

# 9. Build the native app
xcodebuild -workspace ios/PoliticalNomination.xcworkspace \
  -scheme PoliticalNomination \
  -configuration Debug \
  -sdk iphonesimulator \
  -destination 'platform=iOS Simulator,name=iPhone 16e' \
  build

# 10. Start Metro bundler
npx expo start --clear &
sleep 15

# 11. Boot simulator and install app
xcrun simctl boot "iPhone 16e"
open -a Simulator
xcrun simctl install booted $(find ~/Library/Developer/Xcode/DerivedData -name "PoliticalNomination.app" -path "*/Debug-iphonesimulator/*" -type d | head -1)
xcrun simctl launch booted com.politicalnomination.app
```

### Expected Result
- Home screen renders with AMSP branding (logo, light theme), welcome video placeholder, Browse/Leaderboard buttons, and bottom tab bar
- For You tab shows candidate PSA feed with alignment scores
- Metro bundler shows "iOS Bundled" in terminal

### Timing (on Apple Silicon, local disk)
| Step | Duration |
|------|----------|
| `npm install` | ~10s |
| `npx tsc --noEmit` | ~5s |
| `expo prebuild` | ~15s |
| `pod install` | ~25s |
| `xcodebuild` | ~5-8 min (first build) |
| Metro first bundle | ~15-20s |

---

## Environment Information

This troubleshooting guide was tested with:
- macOS 26 (Darwin 25.2.0)
- Xcode 26.2
- Node.js 20.20.0 (via Homebrew node@20)
- npm 10.8.2
- CocoaPods 1.16.2 (via Homebrew)
- watchman 2026.01.12.00
- Expo SDK 52
- React Native 0.76.5
- Firebase 11.11.0

Last updated: February 2026
