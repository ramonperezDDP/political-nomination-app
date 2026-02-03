# Troubleshooting Guide

This document covers common issues encountered when developing the Political Nomination app, along with solutions.

## Table of Contents
- [Node.js Version Requirements](#nodejs-version-requirements)
- [iOS Build Issues](#ios-build-issues)
- [Metro Bundler Issues](#metro-bundler-issues)
- [Dev Server Connection Issues](#dev-server-connection-issues)
- [TypeScript Issues](#typescript-issues)
- [Quick Recovery Steps](#quick-recovery-steps)

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

### Build Hangs at "Planning build"

**Possible Causes:**
1. Metro bundler not responding
2. Resource constraints (memory/disk)
3. Corrupted build cache

**Solutions:**
```bash
# Clear Xcode derived data
rm -rf ~/Library/Developer/Xcode/DerivedData

# Clean pods and rebuild
cd ios
rm -rf Pods Podfile.lock build
pod install
cd ..

# Clear all caches and rebuild
npx expo prebuild --clean --platform ios
```

---

## Metro Bundler Issues

### Metro Hangs / Never Serves Bundles

**Symptom:**
- `curl http://localhost:8081/status` returns 200
- `curl http://localhost:8081/index.bundle?platform=ios` times out
- Debug logs show: "Waiting for TypeScript files to be added to the project..."

**Possible Causes:**

1. **typedRoutes experiment issue**
   - The `experiments.typedRoutes` in app.json can cause Metro to hang
   - Try disabling: set `"typedRoutes": false` in app.json
   - **Note:** As of Feb 2026, typedRoutes is disabled due to Metro hanging issues

2. **Corrupted caches**
   ```bash
   # Clear all caches
   rm -rf .expo/
   rm -rf node_modules/.cache/
   watchman watch-del-all
   npx expo start --clear
   ```

3. **Corrupted node_modules**
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```

4. **Memory issues**
   ```bash
   # Increase Node memory
   export NODE_OPTIONS="--max-old-space-size=4096"
   npx expo start
   ```

### Metro Accepts Connections But Returns 0 Bytes

This is a critical issue where Metro's HTTP server accepts connections but the bundle transformation is stuck.

**Diagnostic steps:**
```bash
# Check if Metro is listening
lsof -i :8081

# Test status endpoint (should work)
curl http://localhost:8081/status

# Test bundle (will timeout if stuck)
curl http://localhost:8081/index.bundle?platform=ios --max-time 30
```

**Recovery:**
1. Kill all Metro/Expo processes:
   ```bash
   pkill -f "expo"
   pkill -f "metro"
   ```

2. Reset watchman:
   ```bash
   watchman watch-del-all
   watchman shutdown-server
   ```

3. Clear caches and restart:
   ```bash
   rm -rf .expo/ node_modules/.cache/
   npx expo start --clear
   ```

4. If still failing, try a full reinstall:
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   npx expo start --clear
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

### Known TypeScript Errors in Codebase

The following TypeScript errors exist but don't prevent the app from running:

1. **Route typing in login.tsx** - expo-router route type mismatch
2. **ViewStyle issues** - Array style syntax in some components
3. **Undefined `searchQuery`** in CandidateHome.tsx
4. **Missing `averageSpectrum`** property in firestore.ts leaderboard entries

To check TypeScript errors:
```bash
npx tsc --noEmit
```

---

## Quick Recovery Steps

If everything is broken, try these steps in order:

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

### Level 4: System Reboot
If Metro is completely stuck and nothing helps, a system reboot may be necessary to clear hung processes and release resources.

---

## Environment Information

This troubleshooting guide was created with:
- macOS Darwin 24.6.0
- Node.js 20.20.0 (recommended)
- Expo SDK 52
- React Native 0.76.5
- Firebase 11.11.0

Last updated: February 2026
