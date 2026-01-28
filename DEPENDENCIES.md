# Dependencies Documentation

This document provides a comprehensive overview of all dependencies used in the Political Nomination App.

## Table of Contents

- [Main Application Dependencies](#main-application-dependencies)
- [Development Dependencies](#development-dependencies)
- [Firebase Cloud Functions Dependencies](#firebase-cloud-functions-dependencies)
- [Dependency Tree](#dependency-tree)
- [Version Compatibility Matrix](#version-compatibility-matrix)
- [Security Considerations](#security-considerations)

---

## Main Application Dependencies

### Core Framework

| Package | Version | Purpose | License |
|---------|---------|---------|---------|
| react | 18.3.1 | UI library | MIT |
| react-dom | 18.3.1 | React DOM renderer | MIT |
| react-native | 0.76.5 | Mobile framework | MIT |
| expo | ~52.0.23 | React Native tooling | MIT |

### Navigation & Routing

| Package | Version | Purpose | License |
|---------|---------|---------|---------|
| expo-router | ~4.0.15 | File-based routing | MIT |
| expo-linking | ~7.0.3 | Deep linking support | MIT |
| react-native-screens | ~4.4.0 | Native navigation primitives | MIT |
| react-native-safe-area-context | 4.12.0 | Safe area handling | MIT |

### State Management & Data Fetching

| Package | Version | Purpose | License |
|---------|---------|---------|---------|
| zustand | ^5.0.2 | Lightweight state management | MIT |
| @tanstack/react-query | ^5.62.0 | Server state management | MIT |
| @react-native-async-storage/async-storage | 1.23.1 | Persistent storage | MIT |
| expo-secure-store | ~14.0.0 | Secure credential storage | MIT |

### Firebase Integration

| Package | Version | Purpose | License |
|---------|---------|---------|---------|
| @react-native-firebase/app | ^21.6.1 | Firebase core | Apache-2.0 |
| @react-native-firebase/auth | ^21.6.1 | Authentication | Apache-2.0 |
| @react-native-firebase/firestore | ^21.6.1 | NoSQL database | Apache-2.0 |
| @react-native-firebase/storage | ^21.6.1 | File storage | Apache-2.0 |

### UI Components & Styling

| Package | Version | Purpose | License |
|---------|---------|---------|---------|
| react-native-paper | ^5.12.5 | Material Design 3 UI | MIT |
| @expo/vector-icons | ^14.0.4 | Icon library | MIT |
| react-native-svg | 15.8.0 | SVG rendering | MIT |
| react-native-gesture-handler | ~2.20.2 | Gesture handling | MIT |
| react-native-reanimated | ~3.16.5 | Animations | MIT |

### Forms & Validation

| Package | Version | Purpose | License |
|---------|---------|---------|---------|
| react-hook-form | ^7.54.0 | Form state management | MIT |
| @hookform/resolvers | ^3.9.1 | Validation resolvers | MIT |
| zod | ^3.24.1 | Schema validation | MIT |

### Media & Device Features

| Package | Version | Purpose | License |
|---------|---------|---------|---------|
| expo-av | ~15.0.1 | Audio/video playback | MIT |
| expo-image-picker | ~16.0.3 | Image selection | MIT |
| expo-document-picker | ~13.0.1 | Document selection | MIT |
| expo-notifications | ~0.29.11 | Push notifications | MIT |

### Utilities

| Package | Version | Purpose | License |
|---------|---------|---------|---------|
| expo-constants | ~17.0.3 | App constants | MIT |
| expo-splash-screen | ~0.29.18 | Splash screen control | MIT |
| expo-status-bar | ~2.0.0 | Status bar styling | MIT |
| @react-native-community/slider | ^4.5.5 | Slider component | MIT |

---

## Development Dependencies

| Package | Version | Purpose | License |
|---------|---------|---------|---------|
| typescript | ~5.6.3 | Type checking | Apache-2.0 |
| @types/react | ~18.3.12 | React type definitions | MIT |
| @babel/core | ^7.26.0 | JavaScript compiler | MIT |
| babel-plugin-module-resolver | ^5.0.2 | Path alias support | MIT |
| eslint | ^8.57.0 | Code linting | MIT |
| eslint-config-expo | ~8.0.1 | Expo ESLint config | MIT |
| @typescript-eslint/eslint-plugin | ^8.18.0 | TypeScript ESLint rules | MIT |
| @typescript-eslint/parser | ^8.18.0 | TypeScript ESLint parser | BSD-2-Clause |
| firebase-admin | ^13.6.0 | Firebase Admin SDK (dev) | Apache-2.0 |
| expo-dev-client | ~5.0.8 | Development builds | MIT |

---

## Firebase Cloud Functions Dependencies

Located in `functions/package.json`:

### Production Dependencies

| Package | Version | Purpose | License |
|---------|---------|---------|---------|
| firebase-admin | ^11.11.0 | Firebase Admin SDK | Apache-2.0 |
| firebase-functions | ^4.5.0 | Cloud Functions SDK | Apache-2.0 |

### Development Dependencies

| Package | Version | Purpose | License |
|---------|---------|---------|---------|
| typescript | ^5.2.0 | Type checking | Apache-2.0 |
| eslint | ^8.50.0 | Code linting | MIT |
| @typescript-eslint/eslint-plugin | ^6.0.0 | TypeScript ESLint rules | MIT |
| @typescript-eslint/parser | ^6.0.0 | TypeScript ESLint parser | BSD-2-Clause |

### Runtime Requirements

- Node.js 18 (specified in `engines` field)

---

## Dependency Tree

```
political-nomination-app
├── Core
│   ├── react (18.3.1)
│   ├── react-native (0.76.5)
│   └── expo (~52.0.23)
│
├── Navigation
│   ├── expo-router (~4.0.15)
│   │   └── react-native-screens (~4.4.0)
│   └── react-native-safe-area-context (4.12.0)
│
├── State Management
│   ├── zustand (^5.0.2)
│   └── @tanstack/react-query (^5.62.0)
│
├── Firebase
│   ├── @react-native-firebase/app (^21.6.1)
│   ├── @react-native-firebase/auth (^21.6.1)
│   ├── @react-native-firebase/firestore (^21.6.1)
│   └── @react-native-firebase/storage (^21.6.1)
│
├── UI Layer
│   ├── react-native-paper (^5.12.5)
│   ├── react-native-gesture-handler (~2.20.2)
│   ├── react-native-reanimated (~3.16.5)
│   └── react-native-svg (15.8.0)
│
├── Forms
│   ├── react-hook-form (^7.54.0)
│   ├── @hookform/resolvers (^3.9.1)
│   └── zod (^3.24.1)
│
└── Media/Device
    ├── expo-av (~15.0.1)
    ├── expo-image-picker (~16.0.3)
    ├── expo-document-picker (~13.0.1)
    └── expo-notifications (~0.29.11)
```

---

## Version Compatibility Matrix

### React Native & Expo Compatibility

| Expo SDK | React Native | React | Node.js |
|----------|--------------|-------|---------|
| 52.x | 0.76.x | 18.3.x | 18.x, 20.x |

### Firebase SDK Compatibility

| @react-native-firebase | firebase-admin | firebase-functions |
|------------------------|----------------|-------------------|
| 21.x | 11.x - 13.x | 4.x |

### TypeScript Compatibility

| TypeScript | React Types | ESLint |
|------------|-------------|--------|
| 5.6.x | 18.3.x | 8.x |

---

## Peer Dependencies

Some packages have peer dependency requirements:

### react-native-paper
- react: >=16.8.0
- react-native: >=0.70.0
- react-native-safe-area-context: >= 3.0.0
- react-native-vector-icons: *

### @tanstack/react-query
- react: ^18.0.0

### react-hook-form
- react: ^16.8.0 || ^17 || ^18

---

## Installation Commands

### Main Application

```bash
# Install all dependencies
npm install

# Install specific dependency
npm install <package-name>

# Update dependencies
npm update
```

### Firebase Functions

```bash
cd functions

# Install dependencies
npm install

# Build TypeScript
npm run build
```

---

## Security Considerations

### Vulnerability Scanning

```bash
# Check for vulnerabilities
npm audit

# Auto-fix vulnerabilities (when safe)
npm audit fix

# Check functions dependencies
cd functions && npm audit
```

### Known Security Notes

1. **Firebase Admin SDK**: Contains privileged access - never expose in client code
2. **expo-secure-store**: Use for sensitive data (tokens, credentials)
3. **@react-native-async-storage**: Not encrypted - avoid storing sensitive data

### Update Policy

- **Security patches**: Apply immediately
- **Minor updates**: Test in staging before production
- **Major updates**: Full regression testing required

---

## Updating Dependencies

### Safe Update Process

```bash
# 1. Check outdated packages
npm outdated

# 2. Update package.json (interactive)
npx npm-check-updates -i

# 3. Install updated packages
npm install

# 4. Run type checking
npm run type-check

# 5. Run linting
npm run lint

# 6. Test the application thoroughly
```

### Expo-Specific Updates

```bash
# Update Expo SDK and related packages
npx expo install --fix
```

---

## License Summary

| License | Count | Packages |
|---------|-------|----------|
| MIT | 35+ | Most packages |
| Apache-2.0 | 6 | Firebase, TypeScript |
| BSD-2-Clause | 2 | @typescript-eslint/parser |

All dependencies are compatible with commercial use.
