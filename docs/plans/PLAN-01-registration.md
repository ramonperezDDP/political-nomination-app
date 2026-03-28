# Plan 01: Registration Simplification & Progressive Access Model — ~90% COMPLETE

> **Updated 2026-03-28.** Core implementation complete: anonymous Firebase auth, account upgrade via `linkWithCredential`, progressive capability selectors, quiz access without account, session metadata tracking, email verification sync. Remaining items are Phase 2 polish:
> - **Missing:** Verification UI flows (voter registration, photo ID upload screens)
> - **Missing:** Abandonment cleanup Cloud Function (90-day inactive anonymous accounts)
>
> **Note (2026-03-28):** Dealbreakers removed entirely per PLAN-10A. User model is now 4-dimensional (dealbreakers axis removed). Onboarding flow: Register → Verify Identity → Questionnaire → Home (no dealbreakers step). References to dealbreakers in this plan are stale.
> - **Missing:** Upgrade prompt UX (gating selectors exist but no UI prompts when anonymous users hit gated features)

**Feedback:** Only require First Name, Last Name, and Email for new users, then go directly to the home page. Build a progressive verification/onboarding system where users unlock capabilities as they complete verification steps. Introduce an anonymous mode so users can enter the app and take the quiz without creating an account.

---

## Current Flow

```
Register Screen → Verify Identity → Onboarding: Issues → Onboarding: Questionnaire → Onboarding: Dealbreakers → Home
```

**Current registration fields:**

- Full Name (2-50 chars)
- Email
- Password (8+ chars, uppercase, lowercase, number)
- Confirm Password
- Accept Terms checkbox

**Current user state model (single dimension):**

```ts
role: 'unregistered' | 'constituent' | 'candidate' | 'admin';
state: 'unverified' | 'verified' | 'pn_applicant' | 'approved_pn';
verificationStatus: 'pending' | 'verified' | 'failed';
```

**Current gate in `app/(auth)/_layout.tsx`:**

```ts
const hasCompletedOnboarding =
  (user?.selectedIssues?.length || 0) >= 4 &&
  (user?.questionnaireResponses?.length || 0) > 0;

if (isAuthenticated && hasCompletedOnboarding) {
  return <Redirect href="/(tabs)" />;
}
```

This is a binary gate — users CANNOT reach the home page until they select 4+ issues AND complete the questionnaire. There's no middle ground.

---

## Proposed Flow

```
App opens → Firebase Anonymous Auth (silent, automatic)
  → Home Page (anonymous Firestore user created)
  → User takes quiz (saved to Firestore under anonymous UID)
  → User upgrades to email/password account (anonymous UID preserved, all data stays)
  → User verifies email, voter registration, photo ID (progressive)
```

### Anonymous Mode via Firebase Anonymous Authentication

On first launch, the app silently calls `signInAnonymously()`. This gives the user a real Firebase UID and creates a Firestore `users` document — without requiring any email, password, or personal information. All user data (quiz responses, browsing district, dealbreakers) is stored in Firestore under this anonymous UID, using the exact same schema as a full account.

When the user later decides to create an account, we call `linkWithCredential(EmailAuthProvider.credential(email, password))` to **upgrade** the anonymous account in place. The UID stays the same, and all Firestore data remains attached — no sync or migration needed.

Anonymous users can:

- Browse the home page
- Take the quiz (saved to Firestore under their anonymous UID)
- View the For You feed (Random and Location filters)
- View candidate profiles
- Toggle between districts to browse candidates/PSAs
- Set dealbreakers (saved to Firestore)

### Anonymous User Lifecycle

```ts
// In authStore.ts initialize():
initialize: () => {
  const unsubscribe = onAuthStateChanged(async (firebaseUser) => {
    if (firebaseUser) {
      // User exists (anonymous or full account) — set up Firestore listener
      set({ firebaseUser, isInitialized: true });
      setupUserSubscription(firebaseUser.uid);
    } else {
      // No user at all — sign in anonymously
      const result = await signInAnonymously();
      // onAuthStateChanged will fire again with the new anonymous user
    }
  });
  return unsubscribe;
},
```

```ts
// When anonymous user is created, set up their Firestore document:
const createAnonymousUserDoc = async (uid: string) => {
  await createUser(uid, {
    email: '',
    firstName: '',
    lastName: '',
    displayName: 'Anonymous',
    role: 'constituent',
    isAnonymous: true,
    verification: {
      email: 'unverified',
      voterRegistration: 'unverified',
      photoId: 'unverified',
    },
    onboarding: {
      questionnaire: 'incomplete',
      dealbreakers: 'incomplete',
    },
    districts: [],
    selectedIssues: [],
    questionnaireResponses: [],
    dealbreakers: [],
    // Abandonment tracking metadata
    lastActiveAt: serverTimestamp(),
    sessionCount: 1,
    firstSeenAt: serverTimestamp(),
    appVersion: APP_VERSION,
    platform: Platform.OS,
  });
};
```

### Account Upgrade (Anonymous → Email/Password)

```ts
// In authStore.ts:
upgradeAnonymousAccount: async (email, password, firstName, lastName) => {
  const { firebaseUser } = get();
  if (!firebaseUser || !firebaseUser.isAnonymous) {
    throw new Error('No anonymous account to upgrade');
  }

  // Link the anonymous account with email/password credentials
  const credential = EmailAuthProvider.credential(email, password);
  const result = await linkWithCredential(firebaseUser, credential);

  // Update the existing Firestore document (same UID, data preserved)
  const displayName = `${firstName} ${lastName}`;
  await updateUser(result.user.uid, {
    email,
    firstName,
    lastName,
    displayName,
    isAnonymous: false,
    'verification.email': 'pending',  // Verification email about to be sent
  });

  // Update Firebase Auth profile
  await updateUserProfile({ displayName });

  // Send email verification
  await sendEmailVerification();

  return true;
},
```

The key advantage: the user's UID never changes. Quiz responses, dealbreakers, browsing history — everything stays in place. No data migration, no sync logic, no dual-storage branching.

### Abandonment Tracking Metadata

Every user document (anonymous or full account) includes metadata for identifying abandoned accounts:

```ts
export interface UserMetadata {
  lastActiveAt: Timestamp;     // Updated on each app session start
  sessionCount: number;        // Incremented on each app session start
  firstSeenAt: Timestamp;      // Set once on account creation
  appVersion: string;          // App version at last session
  platform: string;            // 'ios' | 'android' | 'web'
  lastQuizActivityAt?: Timestamp; // Last time user answered a quiz question
  upgradePromptCount?: number; // How many times we've shown the "create account" prompt
}
```

**Updated on each app session:**

```ts
// In authStore.ts initialize(), after auth state is confirmed:
const updateSessionMetadata = async (uid: string) => {
  await updateUser(uid, {
    lastActiveAt: serverTimestamp(),
    sessionCount: FieldValue.increment(1),
    appVersion: APP_VERSION,
    platform: Platform.OS,
  });
};
```

**Cleanup strategy for abandoned anonymous accounts:**

A scheduled Cloud Function (e.g., daily) queries for anonymous accounts that meet abandonment criteria and deletes them:

```ts
// In functions/src/admin/cleanupAnonymousUsers.ts:
export const cleanupAbandonedAnonymous = functions.pubsub
  .schedule('every 24 hours')
  .onRun(async () => {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 90); // 90 days inactive

    const abandoned = await db.collection('users')
      .where('isAnonymous', '==', true)
      .where('lastActiveAt', '<', cutoffDate)
      .limit(500)
      .get();

    const batch = db.batch();
    for (const doc of abandoned.docs) {
      // Delete Firestore document
      batch.delete(doc.ref);
      // Delete Firebase Auth user
      await admin.auth().deleteUser(doc.id);
    }
    await batch.commit();

    console.log(`Cleaned up ${abandoned.size} abandoned anonymous accounts`);
  });
```

**Abandonment criteria (configurable):**

| Criteria | Threshold | Rationale |
| :---- | :---- | :---- |
| No activity for 90+ days | `lastActiveAt < now - 90d` | User hasn't opened the app in 3 months |
| AND `isAnonymous === true` | — | Only clean up accounts that were never upgraded |
| AND `sessionCount <= 2` | Optional | Only clean up drive-by users, not engaged anonymous users |
| AND no quiz responses | Optional | Preserve anonymous users who invested effort |

### New User State Model (5 independent dimensions)

Each user occupies a state across 5 independent verification/onboarding axes:

| Dimension | States | How it's achieved |
| :---- | :---- | :---- |
| 1\. Email | `unverified` / `verified` | User clicks verification link in email |
| 2\. Voter Registration | `unverified` / `verified` | User confirms voter registration details |
| 3\. Photo ID | `unverified` / `verified` | User uploads photo ID + passes verification |
| 4\. Questionnaire | `incomplete` / `complete` | User answers minimum 1 policy question |
| 5\. Dealbreakers | `incomplete` / `complete` | User selects their dealbreaker issues (0-3) |

**Questionnaire completion:** A minimum of **1 question** marks the questionnaire as `complete` and unlocks alignment scores and the "Issues" filter. However, the UI prompts users that answering more questions produces better candidate matches. The quiz screen shows: *"You've completed X out of 7 quiz questions. Complete more to further refine your search."*

### Progressive Capability Unlocking

| Capability | Required State |
| :---- | :---- |
| Access app, browse home page | None (anonymous — auto-signed-in) |
| Take the policy quiz | None (saved to Firestore under anonymous UID) |
| View For You feed (Random filter) | None (anonymous) |
| View candidate profiles | None (anonymous) |
| Toggle between districts to browse candidates/PSAs | None (anonymous) |
| Set dealbreakers | None (anonymous — saved to Firestore) |
| View matching/alignment scores | Questionnaire = complete (1+ question) |
| Use "Issues" filter in For You | Questionnaire = complete (1+ question) |
| Use "Most Important" filter | Questionnaire = complete AND Dealbreakers = complete |
| Cast a **binding endorsement** for a candidate | Upgraded account + Email + Voter Reg + Photo ID verified, AND user shares a district with the candidate |
| Run for office (candidate application) | Upgraded account + all 3 verifications complete |

**Anonymous users** (auto-signed-in via Firebase Anonymous Auth) have a real Firestore document and can freely browse, take the quiz, and set dealbreakers. When they attempt a gated action (endorsing, applying as candidate), they are prompted to upgrade their account with email/password.

### District-Gated Endorsement

A voter can hold **multiple districts simultaneously** in a hierarchy. When voter registration is verified, their district assignments are populated. Example:

```
User districts: ['USA', 'PA', 'PA-01']
                  ↑       ↑      ↑
               Federal   State  Congressional Dist
```

Each candidate is also assigned to a district (the contest they're running in). The endorsement button for a given candidate checks:

- **User shares a district with this candidate?** → Endorse button active
- **User does NOT share a district?** → Lock icon: *"You are not verified in this candidate's district. Complete your voter registration to endorse."*

Users can still **browse** candidates from any district by toggling the district selector on the home page — but they can only **endorse** within their own verified districts.

### What Users See for Locked Features

Every locked feature shows what it does AND what the user needs to unlock it:

| Locked Feature | What User Sees |
| :---- | :---- |
| Alignment score on PSA (no quiz) | Circle shows "?" with tooltip: "Complete the policy quiz to see your match" |
| Issues/Most Important filters | Grayed out in dropdown: "Complete the quiz to unlock" |
| Most Important filter (no dealbreakers) | Grayed out: "Set your dealbreakers to unlock" |
| Endorse button (anonymous) | Lock icon: "Create an account to endorse" → signup prompt |
| Endorse button (not fully verified) | Lock icon: "Verify your identity to endorse" → tapping shows checklist |
| Endorse button (wrong district) | Lock icon: "You are not verified in this candidate's district" → tapping shows voter registration prompt |
| Candidate application | CTA disabled: "Complete identity verification to apply" |

---

## New User Type Definition

### File: `src/types/index.ts`

**Replace the old single-dimension state fields with the new model:**

```ts
// OLD — Remove these
export type UserState = 'unverified' | 'verified' | 'pn_applicant' | 'approved_pn';
export type VerificationStatus = 'pending' | 'verified' | 'failed';

// NEW — Independent verification/onboarding states
export type VerificationState = 'unverified' | 'pending' | 'verified' | 'failed';
export type OnboardingState = 'incomplete' | 'complete';

export interface UserVerification {
  email: VerificationState;             // Email link clicked
  voterRegistration: VerificationState; // Voter registration confirmed
  photoId: VerificationState;           // Photo ID uploaded + verified
}

export interface UserOnboarding {
  questionnaire: OnboardingState;       // Min 1 question answered
  dealbreakers: OnboardingState;        // Dealbreakers selection done (even if 0)
}

// Hierarchical district model
export interface UserDistrict {
  id: string;          // e.g., 'PA-01'
  type: DistrictType;  // 'federal' | 'state' | 'congressional' | 'local'
  name: string;        // e.g., 'Pennsylvania 1st Congressional District'
  state?: string;      // e.g., 'PA' (two-letter state code)
}

export type DistrictType = 'federal' | 'state' | 'congressional' | 'local';

export interface User {
  id: string;
  email: string;                        // '' for anonymous users
  firstName: string;                    // '' for anonymous users
  lastName: string;                     // '' for anonymous users
  displayName: string;                  // 'Anonymous' for anonymous users
  isAnonymous: boolean;                 // true until account upgrade
  photoUrl?: string;
  gender?: Gender;
  role: UserRole;                       // 'constituent' | 'candidate' | 'admin'
  verification: UserVerification;       // 3 independent verification axes
  onboarding: UserOnboarding;           // 2 independent onboarding axes
  districts: UserDistrict[];            // Populated on voter registration verification
  selectedIssues: string[];
  questionnaireResponses: QuestionnaireResponse[];
  dealbreakers: string[];
  zipCode?: string;
  // Abandonment tracking metadata
  lastActiveAt: Timestamp;              // Updated each app session
  sessionCount: number;                 // Incremented each app session
  firstSeenAt: Timestamp;               // Set once on creation
  appVersion: string;                   // App version at last session
  platform: string;                     // 'ios' | 'android' | 'web'
  lastQuizActivityAt?: Timestamp;       // Last quiz answer timestamp
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

**Keep `UserRole` but simplify it:**

```ts
// Remove 'unregistered' — everyone who signs up is a constituent
export type UserRole = 'constituent' | 'candidate' | 'admin';
```

**Add district to Candidate type:**

```ts
export interface Candidate {
  // ... existing fields
  district: string;    // The district this candidate is running in (e.g., 'PA-01')
  zone?: string;       // Virtual polling zone within district (e.g., 'pa01-north')
}
```

**Update `RegisterFormData`:**

```ts
export interface RegisterFormData {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
}
```

---

## Capability Selectors

### File: `src/stores/userStore.ts` — New selectors for progressive gating

Since all users (anonymous and upgraded) have a Firestore document, these selectors work uniformly — no branching between local and remote state:

```ts
// ─── Authentication Selectors ───

/** Whether the user has upgraded from anonymous to a full account */
export const selectHasAccount = (state: UserState) =>
  state.userProfile !== null && state.userProfile.isAnonymous === false;

/** Whether the user is anonymous (auto-signed-in, no email/password) */
export const selectIsAnonymous = (state: UserState) =>
  state.userProfile?.isAnonymous === true;

// ─── Verification Selectors ───

export const selectEmailVerified = (state: UserState) =>
  state.userProfile?.verification?.email === 'verified';

export const selectVoterRegVerified = (state: UserState) =>
  state.userProfile?.verification?.voterRegistration === 'verified';

export const selectPhotoIdVerified = (state: UserState) =>
  state.userProfile?.verification?.photoId === 'verified';

export const selectFullyVerified = (state: UserState) =>
  selectEmailVerified(state) &&
  selectVoterRegVerified(state) &&
  selectPhotoIdVerified(state);

// ─── District Selectors ───

/** All district IDs the user is verified for */
export const selectUserDistrictIds = (state: UserState): string[] =>
  state.userProfile?.districts?.map((d) => d.id) || [];

/** Check if user shares a district with a specific candidate */
export const selectCanEndorseCandidate = (candidateDistrict: string) =>
  (state: UserState): boolean => {
    if (!selectHasAccount(state)) return false;
    if (!selectFullyVerified(state)) return false;
    const userDistrictIds = selectUserDistrictIds(state);
    return userDistrictIds.includes(candidateDistrict);
  };

/** Get the reason endorsement is locked for a candidate */
export const selectEndorseLockReason = (candidateDistrict: string) =>
  (state: UserState): string | null => {
    if (selectIsAnonymous(state)) return 'Create an account to endorse';
    if (!selectEmailVerified(state)) return 'Verify your email to endorse';
    if (!selectVoterRegVerified(state)) return 'Complete voter registration to endorse';
    if (!selectPhotoIdVerified(state)) return 'Upload photo ID to endorse';
    const userDistrictIds = selectUserDistrictIds(state);
    if (!userDistrictIds.includes(candidateDistrict)) {
      return 'You are not verified in this candidate\'s district. Complete voter registration to endorse.';
    }
    return null; // Unlocked
  };

// ─── Onboarding Selectors ───

/** Questionnaire is complete (1+ question answered).
 *  Works uniformly for both anonymous and upgraded users (both have Firestore docs). */
export const selectQuestionnaireComplete = (state: UserState) =>
  state.userProfile?.onboarding?.questionnaire === 'complete';

export const selectDealbreakersComplete = (state: UserState) =>
  state.userProfile?.onboarding?.dealbreakers === 'complete';

// ─── Capability Selectors ───

/** User can see alignment scores and use Issues/Most Important filters */
export const selectCanSeeAlignment = (state: UserState) =>
  selectQuestionnaireComplete(state);

/** User can use the dealbreakers filter */
export const selectCanSeeDealbreakers = (state: UserState) =>
  selectDealbreakersComplete(state);

/** User can apply to be a candidate */
export const selectCanApply = (state: UserState) =>
  selectFullyVerified(state);

// ─── Progress Selectors ───

/** Returns list of verification steps not yet completed */
export const selectMissingVerifications = (state: UserState): string[] => {
  const missing: string[] = [];
  if (selectIsAnonymous(state)) {
    missing.push('account');
  }
  const v = state.userProfile?.verification;
  if (!v || v.email !== 'verified') missing.push('email');
  if (!v || v.voterRegistration !== 'verified') missing.push('voterRegistration');
  if (!v || v.photoId !== 'verified') missing.push('photoId');
  return missing;
};

/** Returns list of onboarding steps not yet completed */
export const selectMissingOnboarding = (state: UserState): string[] => {
  const missing: string[] = [];
  const o = state.userProfile?.onboarding;
  if (!o || o.questionnaire !== 'complete') missing.push('questionnaire');
  if (!o || o.dealbreakers !== 'complete') missing.push('dealbreakers');
  return missing;
};

/** Overall completion percentage for progress indicators */
export const selectCompletionPercent = (state: UserState): number => {
  let completed = 0;
  const total = 5;
  const v = state.userProfile?.verification;
  const o = state.userProfile?.onboarding;
  if (v?.email === 'verified') completed++;
  if (v?.voterRegistration === 'verified') completed++;
  if (v?.photoId === 'verified') completed++;
  if (o?.questionnaire === 'complete') completed++;
  if (o?.dealbreakers === 'complete') completed++;
  return Math.round((completed / total) * 100);
};
```

---

## Registration Flow Changes

### File: `app/(auth)/register.tsx` — Simplify form fields

**New Zod schema — split name into two fields:**

```ts
const registerSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(50),
  lastName: z.string().min(1, 'Last name is required').max(50),
  email: z.string().email('Please enter a valid email'),
  password: z.string().min(8)
    .regex(/[A-Z]/, 'Must contain uppercase')
    .regex(/[a-z]/, 'Must contain lowercase')
    .regex(/[0-9]/, 'Must contain number'),
  confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});
```

**Update `onSubmit` — upgrade anonymous account:**

```ts
const onSubmit = async (data: RegisterForm) => {
  const displayName = `${data.firstName} ${data.lastName}`;
  const success = await upgradeAnonymousAccount(
    data.email,
    data.password,
    data.firstName,
    data.lastName
  );
  if (success) {
    // Stay on tabs — UID unchanged, all data preserved
    router.replace('/(tabs)');
  }
};
```

### File: `src/stores/authStore.ts` — Account upgrade (not creation)

Since anonymous users already have a Firestore document, upgrading is an **update**, not a create. The `upgradeAnonymousAccount` action (defined above in the Anonymous Mode section) links email/password credentials to the existing anonymous UID and updates the Firestore document with the user's name and email. All quiz responses, dealbreakers, and browsing state are already in Firestore under this UID — nothing needs to sync.

### File: `app/(auth)/_layout.tsx` — Remove mandatory onboarding gate

```ts
// OLD: Block until onboarding complete
// if (isAuthenticated && hasCompletedOnboarding) { return <Redirect ... /> }

// NEW: Authenticated users go straight to tabs
if (isAuthenticated) {
  return <Redirect href="/(tabs)" />;
}
```

### File: `app/(tabs)/_layout.tsx` — Allow anonymous access

```ts
// OLD: Required authentication to access tabs
// if (!isAuthenticated) { return <Redirect href="/(auth)/login" /> }

// NEW: Allow anonymous access — tabs are open to everyone
// Authentication is only checked at the point of gated actions (endorsing, etc.)
return <Tabs ...>...</Tabs>;
```

---

## Questionnaire Completion Logic

### Minimum 1 question to mark `complete`

```ts
// In userStore.ts updateQuestionnaireResponses():
updateQuestionnaireResponses: async (userId, responses) => {
  const updates: Partial<User> = {
    questionnaireResponses: responses,
  };

  // Check if minimum threshold met: 1 question answered
  if (responses.length >= 1) {
    updates['onboarding.questionnaire'] = 'complete';
  }

  return get().updateProfile(userId, updates);
},
```

```ts
// Helper: Check quiz minimum (1 question answered)
function checkQuizMinimum(responses: QuestionnaireResponse[]): boolean {
  return responses.length >= 1;
}
```

### Quiz UI prompt for more answers

On the quiz screen, once the minimum (1 question) is met but not all 7 are answered, show a banner:

```
{meetsMinimum && answeredCount < 7 && (
  <View style={styles.morePrompt}>
    <MaterialCommunityIcons name="chart-line" size={20} color={theme.colors.primary} />
    <Text variant="bodySmall" style={styles.morePromptText}>
      You've completed {answeredCount} out of 7 quiz questions.
      Complete more to further refine your search.
    </Text>
  </View>
)}
```

---

## District Model & Voter Registration Flow

### How districts are assigned

When a user completes voter registration verification, their district assignments are populated based on their registration address. Districts are **hierarchical** — a user belongs to multiple levels simultaneously:

```ts
// Example: User registered in Bucks County, Pennsylvania
const userDistricts: UserDistrict[] = [
  { id: 'USA',   type: 'federal',        name: 'United States of America' },
  { id: 'PA',    type: 'state',          name: 'Pennsylvania',         state: 'PA' },
  { id: 'PA-01', type: 'congressional',  name: 'Pennsylvania 1st Congressional District', state: 'PA' },
];
```

### Candidate district assignment

Each candidate runs in a specific district contest. Candidates provide their address during the application process, which determines their district and zone assignment:

```ts
// Example: Candidate running in PA-01
candidate.district = 'PA-01';
candidate.zone = 'pa01-north';  // Virtual polling zone within the district
```

### Endorsement gating per-candidate

```
// In FullScreenPSA.tsx or candidate/[id].tsx:
const lockReason = useUserStore(selectEndorseLockReason(candidate.district));
const canEndorse = lockReason === null;

{canEndorse ? (
  <Pressable onPress={handleEndorse}>
    <MaterialCommunityIcons name="heart-outline" size={32} color="#fff" />
    <Text style={styles.actionLabel}>Endorse</Text>
  </Pressable>
) : (
  <Pressable onPress={() => setShowLockModal(true)}>
    <MaterialCommunityIcons name="lock" size={32} color="rgba(255,255,255,0.5)" />
    <Text style={styles.actionLabel}>Endorse</Text>
  </Pressable>
)}

// Lock modal shows the specific reason:
// - "Create an account to endorse" (anonymous users)
// - "Verify your email" / "Upload photo ID" / "Complete voter registration"
// - OR "You are not verified in this candidate's district"
```

### Browsing vs. Endorsing

Users can freely **browse** candidates from any district using the district toggle on the home page (see Plan 02). Browsing requires no account. But the **Endorse** button checks district membership per-candidate.

| Action | Requirement |
| :---- | :---- |
| Browse candidates in PA-01 | None (anonymous) |
| Browse candidates in PA-02 | None (anonymous) |
| Endorse candidate in PA-01 | Account + fully verified + `PA-01` in user's districts array |
| Endorse candidate in PA-02 | Account + fully verified + `PA-02` in user's districts array |

### Voter registration → district population

```ts
// When voter registration verification completes (admin or automated):
const populateUserDistricts = async (
  userId: string,
  registrationData: VoterRegistrationData
) => {
  // Look up districts based on registration address
  const districts = await lookupDistrictsByAddress(registrationData.address);

  await updateUser(userId, {
    'verification.voterRegistration': 'verified',
    districts, // Array of UserDistrict objects
  });
};
```

The `lookupDistrictsByAddress` function would query a district lookup service (e.g., Google Civic Information API, or a local database of district boundaries). For the beta with PA-01 and PA-02, this can be a simple zip code → district mapping.

---

## Progressive Gating UI Components

### New Component: `src/components/ui/GatedFeature.tsx`

A wrapper component that shows locked state + prompt for any gated feature:

```
import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

interface GatedFeatureProps {
  /** Is the feature unlocked? */
  isUnlocked: boolean;
  /** What the user sees when unlocked (the actual feature) */
  children: React.ReactNode;
  /** Short label for what's locked (e.g., "Alignment Score") */
  featureLabel: string;
  /** What the user needs to do (e.g., "Complete the policy quiz") */
  unlockPrompt: string;
  /** Where tapping the locked state navigates to */
  unlockRoute?: string;
  /** Inline mode: renders small lock badge instead of full overlay */
  inline?: boolean;
}

export default function GatedFeature({
  isUnlocked,
  children,
  featureLabel,
  unlockPrompt,
  unlockRoute,
  inline = false,
}: GatedFeatureProps) {
  const theme = useTheme();
  const router = useRouter();

  if (isUnlocked) return <>{children}</>;

  const handlePress = () => {
    if (unlockRoute) router.push(unlockRoute);
  };

  if (inline) {
    return (
      <Pressable onPress={handlePress} style={styles.inlineLock}>
        <MaterialCommunityIcons name="lock" size={16} color={theme.colors.outline} />
        <Text variant="labelSmall" style={{ color: theme.colors.outline }}>
          {unlockPrompt}
        </Text>
      </Pressable>
    );
  }

  return (
    <Pressable onPress={handlePress} style={styles.lockedOverlay}>
      <MaterialCommunityIcons name="lock-outline" size={24} color={theme.colors.outline} />
      <Text variant="bodySmall" style={styles.lockedLabel}>{featureLabel}</Text>
      <Text variant="labelSmall" style={styles.unlockText}>{unlockPrompt}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  inlineLock: { flexDirection: 'row', alignItems: 'center', gap: 4, opacity: 0.6 },
  lockedOverlay: {
    alignItems: 'center', padding: 12, borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.04)', gap: 4,
  },
  lockedLabel: { fontWeight: '600' },
  unlockText: { color: '#666', textAlign: 'center' },
});
```

### New Component: `src/components/ui/VerificationChecklist.tsx`

A modal/card showing the user's progress across all 5 dimensions with CTAs for incomplete steps:

```
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Button, Divider, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useUserStore, selectCompletionPercent } from '@/stores';

export default function VerificationChecklist() {
  const theme = useTheme();
  const router = useRouter();
  const user = useUserStore((s) => s.userProfile);
  const completionPercent = useUserStore(selectCompletionPercent);

  if (!user) return null;

  const steps = [
    {
      id: 'email', label: 'Verify Email', icon: 'email-check',
      status: user.verification?.email || 'unverified',
      route: '/(auth)/verify-identity',
      description: 'Check your inbox for a verification link',
    },
    {
      id: 'voterReg', label: 'Voter Registration', icon: 'card-account-details',
      status: user.verification?.voterRegistration || 'unverified',
      route: '/(auth)/verify-identity',
      description: 'Confirm your voter registration to unlock endorsements in your districts',
    },
    {
      id: 'photoId', label: 'Photo ID', icon: 'camera-account',
      status: user.verification?.photoId || 'unverified',
      route: '/(auth)/verify-identity',
      description: 'Upload a government-issued photo ID',
    },
    {
      id: 'questionnaire', label: 'Policy Quiz', icon: 'clipboard-check',
      status: user.onboarding?.questionnaire || 'incomplete',
      route: '/quiz',
      description: 'Answer at least 1 policy question to see your matches',
    },
    {
      id: 'dealbreakers', label: 'Dealbreakers', icon: 'alert-circle',
      status: user.onboarding?.dealbreakers || 'incomplete',
      route: '/settings/dealbreakers',
      description: 'Set your non-negotiable policy positions',
    },
  ];

  const isDone = (status: string) => status === 'verified' || status === 'complete';
  const isPending = (status: string) => status === 'pending';

  return (
    <View style={styles.container}>
      <Text variant="titleMedium" style={styles.title}>
        Your Progress — {completionPercent}%
      </Text>
      <View style={styles.progressBar}>
        <View style={[styles.progressFill, {
          width: `${completionPercent}%`,
          backgroundColor: theme.colors.primary,
        }]} />
      </View>

      {steps.map((step, index) => (
        <View key={step.id}>
          {index > 0 && <Divider />}
          <View style={styles.stepRow}>
            <MaterialCommunityIcons
              name={isDone(step.status) ? 'check-circle' : isPending(step.status) ? 'clock-outline' : 'circle-outline'}
              size={24}
              color={isDone(step.status) ? '#4caf50' : isPending(step.status) ? '#ff9800' : theme.colors.outline}
            />
            <View style={styles.stepInfo}>
              <Text variant="bodyMedium" style={[styles.stepLabel, isDone(step.status) && styles.stepDone]}>
                {step.label}
              </Text>
              <Text variant="bodySmall" style={styles.stepDesc}>
                {isDone(step.status) ? 'Completed' : isPending(step.status) ? 'Pending verification' : step.description}
              </Text>
            </View>
            {!isDone(step.status) && (
              <Button mode="text" compact onPress={() => router.push(step.route)}>
                {isPending(step.status) ? 'Check' : 'Start'}
              </Button>
            )}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  title: { marginBottom: 12, fontWeight: '600' },
  progressBar: { height: 6, backgroundColor: '#e0e0e0', borderRadius: 3, marginBottom: 16, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  stepRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 12 },
  stepInfo: { flex: 1 },
  stepLabel: { fontWeight: '500' },
  stepDone: { textDecorationLine: 'line-through', opacity: 0.6 },
  stepDesc: { color: '#666', marginTop: 2 },
});
```

---

## Updating Verification State

### When email is verified

Firebase Auth tracks this automatically. Sync it to our model:

```ts
// In authStore.ts initialize():
const unsubscribe = onAuthStateChanged(async (firebaseUser) => {
  if (firebaseUser) {
    if (firebaseUser.emailVerified) {
      const currentUser = await getUser(firebaseUser.uid);
      if (currentUser?.verification?.email !== 'verified') {
        await updateUser(firebaseUser.uid, {
          'verification.email': 'verified',
        });
      }
    }
  }
});
```

### When voter registration is verified (populates districts)

```ts
// Called by admin review or automated verification service:
const verifyVoterRegistration = async (
  userId: string,
  districts: UserDistrict[]
) => {
  await updateUser(userId, {
    'verification.voterRegistration': 'verified',
    districts, // Hierarchical district list
  });
};
```

### When questionnaire meets minimum (1 question answered)

```ts
updateQuestionnaireResponses: async (userId, responses) => {
  const updates: Partial<User> = { questionnaireResponses: responses };

  if (checkQuizMinimum(responses)) {
    updates['onboarding.questionnaire'] = 'complete';
  }

  return get().updateProfile(userId, updates);
},
```

### When dealbreakers are set

```ts
updateDealbreakers: async (userId, dealbreakers) => {
  if (dealbreakers.length > 3) {
    set({ error: 'Maximum 3 dealbreakers' });
    return false;
  }

  return get().updateProfile(userId, {
    dealbreakers,
    'onboarding.dealbreakers': 'complete',
  });
},
```

### When photo ID is uploaded

```ts
const handlePhotoIdUpload = async (idDocUrl: string) => {
  await updateUser(userId, {
    'verification.photoId': 'pending',
  });
  // Admin review sets it to 'verified' or 'failed'
};
```

---

## Migration: Existing Users

```ts
function migrateUserState(user: any): Partial<User> {
  const wasVerified = user.state === 'verified' || user.verificationStatus === 'verified';

  return {
    verification: {
      email: wasVerified ? 'verified' : 'unverified',
      voterRegistration: wasVerified ? 'verified' : 'unverified',
      photoId: wasVerified ? 'verified' : 'unverified',
    },
    onboarding: {
      questionnaire:
        (user.questionnaireResponses?.length || 0) >= 1 ? 'complete' : 'incomplete',
      dealbreakers:
        user.dealbreakers !== undefined ? 'complete' : 'incomplete',
    },
    districts: user.district
      ? [{ id: user.district, type: 'congressional', name: user.district }]
      : [],
    firstName: user.displayName?.split(' ')[0] || '',
    lastName: user.displayName?.split(' ').slice(1).join(' ') || '',
  };
}
```

---

## Files to Create

| File | Purpose |
| :---- | :---- |
| `src/components/ui/GatedFeature.tsx` | Reusable lock overlay / inline badge for gated features |
| `src/components/ui/VerificationChecklist.tsx` | Progress card showing all 5 steps with CTAs |
| `functions/src/admin/cleanupAnonymousUsers.ts` | Scheduled Cloud Function to delete abandoned anonymous accounts (90+ days inactive) |

## Files to Modify

| File | Change |
| :---- | :---- |
| `src/types/index.ts` | Replace `UserState`/`VerificationStatus` with `UserVerification`/`UserOnboarding`/`UserDistrict`; add `firstName`/`lastName`/`districts`; simplify `UserRole`; add `district`/`zone` to Candidate |
| `app/(auth)/register.tsx` | Split name → firstName + lastName; navigate to `/(tabs)` on success |
| `app/(auth)/_layout.tsx` | Remove mandatory onboarding gate; authenticated users go to tabs |
| `app/(tabs)/_layout.tsx` | Remove authentication requirement; allow anonymous access |
| `src/stores/authStore.ts` | Add `signInAnonymously()` on first launch; add `upgradeAnonymousAccount()` for account upgrade via `linkWithCredential`; update session metadata on each app open |
| `src/stores/userStore.ts` | Add capability selectors (`selectCanSeeAlignment`, `selectCanSeeDealbreakers`, `selectIsAnonymous`), district selectors, `selectEndorseLockReason`; update quiz/dealbreaker completion logic |
| `src/stores/index.ts` | Export new selectors |

## Files Using Gating (consumers, updated in later plans)

| File | Gated Feature |
| :---- | :---- |
| `src/components/feed/FullScreenPSA.tsx` | Alignment circle (quiz gate), endorse button (account + verification + district gate) |
| `src/components/feed/ExperienceMenu.tsx` | Issues/Most Important (quiz gate), Dealbreakers filter (dealbreakers gate) |
| `app/(tabs)/for-you.tsx` | Quiz prompt card for incomplete questionnaire, mass endorsement button |
| `src/components/home/VoterHome.tsx` | Verification progress card on home page |
| `app/(candidate)/apply.tsx` | Gate application behind full verification |
| `app/candidate/[id].tsx` | Gate endorsement behind account + verification + district match |

---

## Summary

```
App opens → Firebase Anonymous Auth (silent, automatic)
    → Firestore user doc created under anonymous UID
    → Browse freely, toggle districts to explore candidates
    → Take quiz (saved to Firestore under anonymous UID)
    → See "?" on alignment → complete 1+ question to unlock
    → Answer 1+ question → alignment unlocked, prompted for more
    → Set dealbreakers → Most Important filter unlocks (anonymous OK)
    → Try to endorse → see signup/verification checklist
    → Upgrade account (linkWithCredential) → UID preserved, all data stays
    → Verify email → ✓
    → Verify voter registration → districts assigned (USA, PA, PA-01)
    → Upload photo ID → ✓
    → Endorse button active for candidates in YOUR districts
    → Try to endorse candidate in another district → "Not in your district" lock
```
