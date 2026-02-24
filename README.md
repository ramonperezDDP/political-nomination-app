# America's Main Street Party App

A cross-platform mobile application for democratic nominations, built with React Native, Expo, and Firebase. Branded for **America's Main Street Party (AMSP)** with a custom light theme, Nunito Sans typeface, and the AMSP color palette (Purple, Blue, Red).

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Local Development Setup](#local-development-setup)
- [AWS EC2 Deployment](#aws-ec2-deployment)
- [Firebase Configuration](#firebase-configuration)
- [Environment Variables](#environment-variables)
- [Running the Application](#running-the-application)
- [iOS Simulator Quick Start](#ios-simulator-quick-start)
- [Deployment Options](#deployment-options)
- [Troubleshooting](#troubleshooting)
- [Additional Documentation](#additional-documentation)

---

## Overview

The America's Main Street Party App is a participatory democracy platform that enables:

- **Voters** to discover candidates aligned with their policy preferences, complete questionnaires, and provide endorsements
- **Candidates** to apply for nomination, build profiles, and track campaign metrics
- **Administrators** to manage party configuration and contest stages

### Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React Native 0.76.9, Expo 52, React Native Web |
| State Management | Zustand, TanStack Query |
| UI Framework | React Native Paper (Material Design 3, AMSP light theme) |
| Typeface | Nunito Sans (Regular, Bold, Black) |
| Brand Colors | Purple `#5a3977`, Blue `#067eba`, Red `#de482e` |
| Backend | Firebase (Auth, Firestore, Storage, Hosting, Functions) |
| Language | TypeScript 5.6 |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Client Applications                       │
├─────────────────┬─────────────────┬─────────────────────────┤
│   iOS App       │   Android App   │      Web App            │
│  (App Store)    │  (Play Store)   │ (Firebase/EC2/CF)       │
└────────┬────────┴────────┬────────┴───────────┬─────────────┘
         │                 │                    │
         └─────────────────┼────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                     Firebase Services                        │
├─────────────────┬─────────────────┬─────────────────────────┤
│ Authentication  │   Firestore     │     Cloud Storage       │
│ (Email/Pass)    │   (Database)    │     (File Uploads)      │
├─────────────────┴─────────────────┴─────────────────────────┤
│                   Cloud Functions                            │
│  (Triggers, Notifications, Rankings, Feed Generation)        │
└─────────────────────────────────────────────────────────────┘
```

---

## Prerequisites

### System Requirements

- **Node.js**: 20.x LTS (recommended) - Node 25+ has known compatibility issues
- **npm**: 9.x or higher
- **Git**: 2.40 or higher
- **Watchman**: Recommended for better Metro performance (`brew install watchman`)

### Accounts Required

- [Firebase Account](https://firebase.google.com/) with a project created
- [Expo Account](https://expo.dev/) (for builds and updates)
- [AWS Account](https://aws.amazon.com/) (for EC2 deployment)
- [Onfido Account](https://onfido.com/) (for identity verification)

### Development Tools (Optional)

- **iOS Development**: macOS with Xcode 15+
- **Android Development**: Android Studio with SDK 34

---

## Local Development Setup

### 1. Clone the Repository

```bash
git clone <repository-url>
cd political-nomination-app
```

### 2. Install Dependencies

```bash
# Install main application dependencies
npm install

# Install Firebase Functions dependencies
cd functions
npm install
cd ..
```

### 3. Configure Firebase (Required for Native Builds)

For **native iOS and Android builds**, Firebase configuration is read directly from platform-specific files:

1. Download `GoogleService-Info.plist` from Firebase Console > Project Settings > iOS app
2. Download `google-services.json` from Firebase Console > Project Settings > Android app
3. Place `GoogleService-Info.plist` in the project root (it will be copied to the iOS bundle)
4. Place `google-services.json` in `android/app/` directory

**Important:** No `.env` file is required for native builds. The React Native Firebase SDK reads configuration directly from these platform-specific files.

### 4. Configure Environment Variables (Web Only)

Environment variables are only needed for **web builds**:

```bash
# Copy the example environment file (only for web deployment)
cp .env.example .env

# Edit .env with your configuration values
nano .env  # or use your preferred editor
```

See [Environment Variables](#environment-variables) section for details on web configuration.

### 5. Run the Application

```bash
# Start the Expo development server
npm start

# Or run on specific platform
npm run ios      # iOS Simulator
npm run android  # Android Emulator
npm run web      # Web browser
```

---

## AWS EC2 Deployment

This section provides step-by-step instructions for deploying the application on AWS EC2.

### Step 1: Launch EC2 Instance

#### Via AWS Console

1. Navigate to **EC2 Dashboard** > **Launch Instance**

2. Configure the instance:
   - **Name**: `political-nomination-app`
   - **AMI**: Amazon Linux 2023 or Ubuntu 22.04 LTS
   - **Instance Type**: t3.medium (minimum) or t3.large (recommended)
   - **Key Pair**: Create new or select existing
   - **Network Settings**:
     - Allow SSH (port 22) from your IP
     - Allow HTTP (port 80) from anywhere
     - Allow HTTPS (port 443) from anywhere
   - **Storage**: 30 GB gp3 (minimum)

3. Launch the instance

#### Via AWS CLI

```bash
# Create security group
aws ec2 create-security-group \
  --group-name political-nomination-sg \
  --description "Security group for AMSP App"

# Add inbound rules
aws ec2 authorize-security-group-ingress \
  --group-name political-nomination-sg \
  --protocol tcp --port 22 --cidr 0.0.0.0/0

aws ec2 authorize-security-group-ingress \
  --group-name political-nomination-sg \
  --protocol tcp --port 80 --cidr 0.0.0.0/0

aws ec2 authorize-security-group-ingress \
  --group-name political-nomination-sg \
  --protocol tcp --port 443 --cidr 0.0.0.0/0

# Launch instance (Amazon Linux 2023)
aws ec2 run-instances \
  --image-id ami-0c7217cdde317cfec \
  --instance-type t3.medium \
  --key-name your-key-pair \
  --security-groups political-nomination-sg \
  --block-device-mappings '[{"DeviceName":"/dev/xvda","Ebs":{"VolumeSize":30,"VolumeType":"gp3"}}]' \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=political-nomination-app}]'
```

### Step 2: Connect to Instance

```bash
# Connect via SSH
ssh -i /path/to/your-key.pem ec2-user@<instance-public-ip>

# For Ubuntu AMI, use:
ssh -i /path/to/your-key.pem ubuntu@<instance-public-ip>
```

### Step 3: Install System Dependencies

#### Amazon Linux 2023

```bash
# Update system packages
sudo dnf update -y

# Install Git
sudo dnf install -y git

# Install Node.js 18 via NodeSource
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo dnf install -y nodejs

# Verify installations
node --version  # Should show v18.x.x
npm --version   # Should show 9.x.x or higher
git --version
```

#### Ubuntu 22.04

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install Git
sudo apt install -y git

# Install Node.js 18 via NodeSource
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installations
node --version  # Should show v18.x.x
npm --version   # Should show 9.x.x or higher
git --version
```

### Step 4: Install Additional Tools

```bash
# Install PM2 for process management
sudo npm install -g pm2

# Install Expo CLI
sudo npm install -g expo-cli

# Install Firebase CLI
sudo npm install -g firebase-tools

# Install Nginx (for reverse proxy)
# Amazon Linux:
sudo dnf install -y nginx

# Ubuntu:
sudo apt install -y nginx
```

### Step 5: Clone and Configure Application

```bash
# Create application directory
sudo mkdir -p /var/www
sudo chown $USER:$USER /var/www
cd /var/www

# Clone repository
git clone <repository-url> political-nomination-app
cd political-nomination-app

# Install dependencies
npm install

# Install functions dependencies
cd functions && npm install && cd ..
```

### Step 6: Configure Environment Variables

```bash
# Create environment file
nano .env
```

Add your environment variables:

```bash
# Firebase Configuration
EXPO_PUBLIC_FIREBASE_API_KEY=your-api-key
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
EXPO_PUBLIC_FIREBASE_APP_ID_IOS=your-ios-app-id
EXPO_PUBLIC_FIREBASE_APP_ID_ANDROID=your-android-app-id
EXPO_PUBLIC_FIREBASE_APP_ID_WEB=your-web-app-id
EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID=your-measurement-id

# Onfido Configuration
EXPO_PUBLIC_ONFIDO_API_TOKEN=your-onfido-token
EXPO_PUBLIC_ONFIDO_WORKFLOW_RUN_ID=your-workflow-id
```

### Step 7: Build for Web

```bash
# Run type checking
npm run type-check

# Build the web application
npx expo export --platform web

# The build output will be in the 'dist' directory
```

### Step 8: Configure Nginx

```bash
# Create Nginx configuration
sudo nano /etc/nginx/conf.d/political-nomination.conf
```

Add the following configuration:

```nginx
server {
    listen 80;
    server_name your-domain.com;  # Or use _ for IP-based access

    root /var/www/political-nomination-app/dist;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    # Handle client-side routing
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
}
```

```bash
# Test Nginx configuration
sudo nginx -t

# Start and enable Nginx
sudo systemctl start nginx
sudo systemctl enable nginx

# Allow HTTP through firewall (if using firewalld)
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload
```

### Step 9: Configure SSL/TLS (Recommended)

```bash
# Install Certbot
# Amazon Linux:
sudo dnf install -y certbot python3-certbot-nginx

# Ubuntu:
sudo apt install -y certbot python3-certbot-nginx

# Obtain SSL certificate
sudo certbot --nginx -d your-domain.com

# Auto-renewal is configured automatically
# Test auto-renewal
sudo certbot renew --dry-run
```

### Step 10: Deploy Firebase Rules and Functions

```bash
# Login to Firebase
firebase login --no-localhost

# Select your project
firebase use your-project-id

# Deploy security rules (Firestore and Storage)
firebase deploy --only firestore:rules,storage:rules

# Deploy functions
cd functions
npm run build
firebase deploy --only functions
```

### Step 11: Set Up Automated Deployment (Optional)

Create a deployment script:

```bash
nano /var/www/political-nomination-app/deploy.sh
```

```bash
#!/bin/bash
set -e

echo "Starting deployment..."

cd /var/www/political-nomination-app

# Pull latest changes
echo "Pulling latest changes..."
git pull origin main

# Install dependencies
echo "Installing dependencies..."
npm install

# Run type checking
echo "Running type check..."
npm run type-check

# Build web application
echo "Building web application..."
npx expo export --platform web

# Restart Nginx to clear any caches
echo "Restarting Nginx..."
sudo systemctl reload nginx

echo "Deployment complete!"
```

```bash
# Make script executable
chmod +x /var/www/political-nomination-app/deploy.sh
```

---

## Firebase Configuration

### 1. Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Create a project"
3. Enter project name and follow the setup wizard

### 2. Enable Services

Enable the following services in Firebase Console:

| Service | Location | Configuration |
|---------|----------|---------------|
| Authentication | Build > Authentication | Enable Email/Password provider |
| Firestore | Build > Firestore Database | Create database in production mode |
| Storage | Build > Storage | Set up Cloud Storage |
| Hosting | Build > Hosting | Set up for SPA deployment |
| Functions | Build > Functions | Enable Cloud Functions |

### 3. Configure Firebase Apps

1. **Web App**: Project Settings > General > Your apps > Add web app
2. **iOS App**: Project Settings > General > Your apps > Add iOS app
3. **Android App**: Project Settings > General > Your apps > Add Android app

### 4. Download Configuration Files

- `GoogleService-Info.plist` - iOS configuration
- `google-services.json` - Android configuration

### 5. Set Up Firestore Security Rules

Firestore rules are defined in `firebase/firestore.rules` and can be deployed via CLI:

```bash
firebase deploy --only firestore:rules --project party-nomination-app
```

Or paste the contents of `firebase/firestore.rules` into Firebase Console > Firestore > Rules.

### 6. Set Up Storage Security Rules

Storage rules are defined in `firebase/storage.rules` and can be deployed via CLI:

```bash
firebase deploy --only storage:rules --project party-nomination-app
```

Or paste the contents of `firebase/storage.rules` into Firebase Console > Storage > Rules.

The rules enforce per-path access control:

| Path | Read | Write | Size Limit |
|------|------|-------|------------|
| `profilePhotos/{userId}/` | Authenticated users | Owner only, images | 5 MB |
| `psaVideos/{candidateId}/` | Authenticated users | Authenticated, video | 500 MB |
| `psaThumbnails/{candidateId}/` | Authenticated users | Authenticated, images | 2 MB |
| `signatureDocs/{userId}/` | Owner or admin | Owner, PDF/image | 50 MB |
| `idDocs/{userId}/` | Owner or admin | Owner, PDF/image | 10 MB |
| `resumes/{userId}/` | Owner or admin | Owner, PDF/image | 10 MB |
| `taxReturns/{userId}/` | Admin only | Owner, PDF/image | 50 MB |
| `messageAttachments/` | Authenticated users | Authenticated, image/PDF | 10 MB |

All other paths are denied by default. Unauthenticated users have no access.

---

## Environment Variables

### Native Builds (iOS/Android)

**No `.env` file is required for native builds.** Firebase configuration is automatically read from:
- **iOS**: `GoogleService-Info.plist`
- **Android**: `google-services.json`

### Web Builds

For web deployment, create a `.env` file with the following variables:

#### Required Variables (Web)

| Variable | Description | Example |
|----------|-------------|---------|
| `EXPO_PUBLIC_FIREBASE_API_KEY` | Firebase API key | `AIzaSy...` |
| `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN` | Firebase auth domain | `project.firebaseapp.com` |
| `EXPO_PUBLIC_FIREBASE_PROJECT_ID` | Firebase project ID | `my-project-id` |
| `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET` | Storage bucket | `project.appspot.com` |
| `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | FCM sender ID | `123456789` |
| `EXPO_PUBLIC_FIREBASE_APP_ID_WEB` | Web app ID | `1:123:web:abc` |

#### Optional Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID` | Analytics ID | `G-XXXXXXX` |
| `EXPO_PUBLIC_ONFIDO_API_TOKEN` | Onfido API token | `api_live_...` |
| `EXPO_PUBLIC_ONFIDO_WORKFLOW_RUN_ID` | Onfido workflow ID | `workflow-id` |

### Getting Firebase Configuration

1. Go to Firebase Console > Project Settings > General
2. Scroll to "Your apps" section
3. Select your web app
4. Copy the configuration values

---

## Running the Application

### Development Mode

```bash
# Start Expo development server
npm start

# Platform-specific commands
npm run ios      # iOS Simulator (requires macOS + Xcode)
npm run android  # Android Emulator (requires Android Studio)
npm run web      # Web browser
```

### Production Mode (Web)

```bash
# Build for web
npm run build:web

# Deploy to Firebase Hosting
npm run deploy

# Or serve locally for testing:
npx serve dist
```

### Firebase Functions

```bash
cd functions

# Local development
npm run serve

# Deploy to Firebase
npm run deploy
```

---

## iOS Simulator Quick Start

This section provides step-by-step instructions for running the app on iOS Simulator from a clean state.

### Prerequisites

- macOS with Xcode 15+ installed
- Xcode Command Line Tools: `xcode-select --install`
- Node.js 18.x and npm 9.x+
- `GoogleService-Info.plist` in project root (download from Firebase Console)

### Clean Start (From Scratch)

Use these steps when you want to start fresh or after pulling new changes:

#### Step 1: Stop All Running Processes

```bash
# Kill any running Expo/Metro processes
pkill -9 -f "expo" 2>/dev/null
pkill -9 -f "metro" 2>/dev/null
pkill -9 -f "node.*political" 2>/dev/null

# Shutdown all iOS simulators
xcrun simctl shutdown all 2>/dev/null

# Close Simulator app
pkill -9 Simulator 2>/dev/null
```

#### Step 2: Verify Port is Clear

```bash
# Check that port 8081 is free
lsof -i :8081

# If something is using it, kill it
lsof -ti:8081 | xargs kill -9 2>/dev/null
```

#### Step 3: Install Dependencies (if needed)

```bash
# Only needed after fresh clone or package.json changes
npm install
```

#### Step 4: Start Metro Bundler

```bash
# Start Expo/Metro dev server
npx expo start
```

Wait until you see:
```
Starting Metro Bundler
Waiting on http://localhost:8081
```

#### Step 5: Boot iOS Simulator

In a **new terminal window**:

```bash
# Open Simulator app
open -a Simulator

# Boot a specific device (e.g., iPhone 16e)
xcrun simctl boot "iPhone 16e"
```

#### Step 6: Launch the App

```bash
# Launch the app in the booted simulator
xcrun simctl launch booted com.politicalnomination.app
```

### One-Liner Quick Start

If the app is already built and installed on the simulator, use this single command sequence:

```bash
# Stop everything, start fresh, and launch
pkill -9 -f "expo" 2>/dev/null; \
pkill -9 -f "node.*political" 2>/dev/null; \
xcrun simctl shutdown all 2>/dev/null; \
sleep 2 && \
npx expo start &
sleep 20 && \
open -a Simulator && \
sleep 3 && \
xcrun simctl boot "iPhone 16e" 2>/dev/null; \
sleep 3 && \
xcrun simctl launch booted com.politicalnomination.app
```

### Verifying Everything is Running

```bash
# Check Metro bundler is running
curl -s http://localhost:8081/status
# Should output: packager-status:running

# Check simulator is booted
xcrun simctl list devices booted

# Check app is installed
xcrun simctl listapps booted | grep politicalnomination
```

### Common Commands Reference

| Task | Command |
|------|---------|
| Start Metro | `npx expo start` |
| Start with clean cache | `npx expo start --clear` |
| List available simulators | `xcrun simctl list devices available` |
| Boot simulator | `xcrun simctl boot "iPhone 16e"` |
| Shutdown all simulators | `xcrun simctl shutdown all` |
| Launch app | `xcrun simctl launch booted com.politicalnomination.app` |
| Terminate app | `xcrun simctl terminate booted com.politicalnomination.app` |
| Reload app in simulator | Press `Cmd+R` or shake device (`Ctrl+Cmd+Z`) |
| Check Metro status | `curl -s http://localhost:8081/status` |
| Check port 8081 | `lsof -i :8081` |

### Troubleshooting Quick Start

#### Metro won't start / hangs at "Starting project"

```bash
# Reinstall node_modules
rm -rf node_modules
npm install
npx expo start
```

#### App shows blank screen

1. Wait for Metro to show "iOS Bundled" message
2. Reload the app: `Cmd+R` in simulator
3. Or terminate and relaunch:
   ```bash
   xcrun simctl terminate booted com.politicalnomination.app
   xcrun simctl launch booted com.politicalnomination.app
   ```

#### "App not installed" error

The app needs to be built first:
```bash
npx expo run:ios
```
This will build and install the app (takes 5-15 minutes on first run).

#### Port 8081 already in use

```bash
lsof -ti:8081 | xargs kill -9
npx expo start
```

---

## Web Platform Architecture

The app supports iOS, Android, and Web from a single codebase using Expo/Metro platform-specific file extensions (`.web.ts`). When building for web, Metro automatically resolves `.web.ts` files instead of the default `.ts` files.

### How It Works

- **Native (iOS/Android)**: Uses `@react-native-firebase/*` packages (native SDKs)
- **Web**: Uses `firebase` JS SDK via `.web.ts` platform files

| Native File | Web File | Difference |
|-------------|----------|------------|
| `config.ts` | `config.web.ts` | Web initializes `firebase/app`, native uses `@react-native-firebase/app` |
| `auth.ts` | `auth.web.ts` | Web uses `firebase/auth` modular SDK |
| `firestore.ts` | `firestore.web.ts` | Web uses `firebase/firestore`, `exists()` method instead of property |
| `storage.ts` | `storage.web.ts` | Web uses `fetch(uri).blob()` + `uploadBytesResumable()` |
| `types/index.ts` | `types/index.web.ts` | Web imports `Timestamp` from `firebase/firestore` |
| `stores/authStore.ts` | `stores/authStore.web.ts` | Web uses `User` type from `firebase/auth` |

Consumer code (components, other stores) imports from `@/services/firebase/auth` and Metro picks the right file automatically. No `Platform.OS` conditionals needed.

---

## Deployment Options

### Option 1: Firebase Hosting (Recommended for Web)

Deploy the web build to Firebase Hosting. Configured in `firebase.json` with SPA rewrites and caching headers.

```bash
# Install Firebase CLI (one-time)
npm install -g firebase-tools
firebase login

# Build and deploy
npm run deploy
# This runs: npx expo export --platform web && firebase deploy --only hosting
```

The hosted URL will be: `https://party-nomination-app.web.app`

#### Web Demo Phone Frame

On desktop browsers, the web app renders inside a realistic iPhone mockup with the AMSP brand purple gradient background, notch, side buttons, and home indicator. This is a CSS-only wrapper defined in `app/+html.tsx` — no extra dependencies or React components.

| Viewport | Behavior |
|----------|----------|
| Desktop (>500px wide, >950px tall) | Full phone frame at 375x812 |
| Medium height (800-950px tall) | Phone frame scaled to 85% |
| Short screens (700-800px tall) | Phone frame scaled to 75% |
| Mobile (≤500px wide or ≤700px tall) | Frame hidden, app fills viewport normally |

#### Web-Specific Notes

- **Icon fonts**: MaterialCommunityIcons are preloaded via `@font-face` in `app/+html.tsx` and via `useFonts()` in `app/_layout.tsx`. The `firebase.json` ignore pattern must use `node_modules/**` (not `**/node_modules/**`) to avoid excluding bundled font assets from deployment.
- **Navigation**: The candidate profile page (`app/candidate/[id].tsx`) includes a web-only back button since the web layout uses `<Slot />` instead of `<Stack>` (see TROUBLESHOOTING.md for context).

### Option 2: Web Only (EC2)

Deploy the web version to EC2 with Nginx. Suitable for:
- Web-only access
- Cost-effective hosting
- Full control over infrastructure

### Option 3: Expo Hosting

Use Expo's hosting services for web deployment:

```bash
# Install EAS CLI
npm install -g eas-cli

# Login to Expo
eas login

# Deploy web
eas update --platform web
```

### Option 4: Mobile App Stores

Build and deploy to app stores:

```bash
# Build for iOS
eas build --platform ios

# Build for Android
eas build --platform android

# Submit to stores
eas submit --platform ios
eas submit --platform android
```

### Option 5: Hybrid Approach

- Web version on EC2/CloudFront
- Mobile apps on App Store/Play Store
- Shared Firebase backend

---

## Troubleshooting

> **For comprehensive troubleshooting, see [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)** which covers:
> - Node.js version requirements (use Node 20 LTS)
> - iOS build issues (gRPC/Firebase conflicts)
> - Metro bundler hanging issues
> - Dev server connection problems
> - Quick recovery steps

### Common Issues

#### Node.js Version Mismatch

```bash
# Check Node version
node --version

# If wrong version, install correct version
# Using nvm:
nvm install 18
nvm use 18
```

#### Permission Denied Errors

```bash
# Fix npm permissions
sudo chown -R $USER:$USER /var/www/political-nomination-app
sudo chown -R $USER:$USER ~/.npm
```

#### Expo Build Failures

```bash
# Clear Expo cache
npx expo start --clear

# Clear npm cache
npm cache clean --force

# Reinstall dependencies
rm -rf node_modules
npm install
```

#### Nginx 502 Bad Gateway

```bash
# Check Nginx error logs
sudo tail -f /var/log/nginx/error.log

# Verify dist directory exists
ls -la /var/www/political-nomination-app/dist

# Rebuild if necessary
npx expo export --platform web
```

#### Firebase Connection Issues

1. Verify environment variables are set correctly (web only)
2. Verify `GoogleService-Info.plist` exists in project root (iOS)
3. Verify `google-services.json` exists in `android/app/` (Android)
4. Check Firebase project settings
5. Ensure Firestore/Auth services are enabled
6. Check security rules allow the operations

#### Black Screen on iOS Simulator

If the app shows a black screen when loading:

1. **Metro bundler not ready**: On first run, Metro needs to build the cache which can take 30+ seconds. Wait for the "Bundled" message in the terminal.

2. **Clear caches and restart**:
   ```bash
   # Kill any existing Metro processes
   pkill -f "expo"

   # Clear Metro and Watchman caches
   watchman watch-del-all

   # Start with clean cache
   npx expo start --clear
   ```

3. **Reload the app**: Once Metro shows "Bundled", reload the app:
   - Press `Cmd+R` in the simulator, or
   - Shake device (`Ctrl+Cmd+Z`) to open dev menu and select "Reload"

4. **Restart the app in simulator**:
   ```bash
   xcrun simctl terminate booted com.politicalnomination.app
   xcrun simctl launch booted com.politicalnomination.app
   ```

#### Metro Bundler Issues

If Metro isn't bundling or seems stuck:

```bash
# Check if something is using port 8081
lsof -i :8081

# Kill process on port 8081
lsof -ti:8081 | xargs kill -9

# Start Metro fresh with verbose output
EXPO_DEBUG=true npx expo start --clear
```

### Logs and Monitoring

```bash
# Application logs (if using PM2)
pm2 logs

# Nginx access logs
sudo tail -f /var/log/nginx/access.log

# Nginx error logs
sudo tail -f /var/log/nginx/error.log

# System logs
sudo journalctl -u nginx -f
```

---

## Additional Documentation

- [REQUIREMENTS.md](./REQUIREMENTS.md) - System requirements and AWS specifications
- [DEPENDENCIES.md](./DEPENDENCIES.md) - Complete dependency documentation
- [IOS_SIMULATOR_GUIDE.md](./IOS_SIMULATOR_GUIDE.md) - iOS development setup

### External Resources

- [Expo Documentation](https://docs.expo.dev/)
- [React Native Documentation](https://reactnative.dev/docs/getting-started)
- [Firebase Documentation](https://firebase.google.com/docs)
- [AWS EC2 Documentation](https://docs.aws.amazon.com/ec2/)

---

## Scripts Reference

| Script | Command | Description |
|--------|---------|-------------|
| Start | `npm start` | Start Expo development server |
| iOS | `npm run ios` | Run on iOS Simulator |
| Android | `npm run android` | Run on Android Emulator |
| Web | `npm run web` | Run in web browser |
| Build Web | `npm run build:web` | Export static web build to `dist/` |
| Deploy | `npm run deploy` | Build web + deploy to Firebase Hosting |
| Lint | `npm run lint` | Run ESLint |
| Type Check | `npm run type-check` | Run TypeScript type checking |

---

## Support

For issues and questions:
- Create an issue in the repository
- Check existing documentation
- Review Firebase and Expo documentation for service-specific issues
