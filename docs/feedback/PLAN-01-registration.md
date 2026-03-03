# Plan 01: Registration Simplification & Progressive Access Model

**Feedback:** Only require First Name, Last Name, and Email for new users, then go directly to the home page. Build a progressive verification/onboarding system where users unlock capabilities as they complete verification steps.

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
```typescript
role: 'unregistered' | 'constituent' | 'candidate' | 'admin';
state: 'unverified' | 'verified' | 'pn_applicant' | 'approved_pn';
verificationStatus: 'pending' | 'verified' | 'failed';
```

**Current gate in `app/(auth)/_layout.tsx`:**
```typescript
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
Register Screen (First Name, Last Name, Email, Password) → Home Page (with progressive prompts)
```

### New User State Model (5 independent dimensions)

Each user occupies a state across 5 independent verification/onboarding axes:

| Dimension | States | How it's achieved |
|-----------|--------|-------------------|
| 1. Email | `unverified` / `verified` | User clicks verification link in email |
| 2. Voter Registration | `unverified` / `verified` | User confirms voter registration details |
| 3. Photo ID | `unverified` / `verified` | User uploads photo ID + passes verification |
| 4. Questionnaire | `incomplete` / `complete` | User answers minimum 3 policy questions (1 global, 1 national, 1 local) |
| 5. Dealbreakers | `incomplete` / `complete` | User selects their dealbreaker issues (0-3) |

**Questionnaire completion:** A minimum of **3 questions** (at least 1 from each section: global, national, local) marks the questionnaire as `complete`. However, the UI should prompt users that answering more questions produces better candidate matches. The quiz screen shows: *"You've unlocked matching! Answer more questions to improve your results."*

### Progressive Capability Unlocking

| Capability | Required State |
|------------|---------------|
| Access app, browse home page | Email = verified |
| View For You feed (random PSAs) | Email = verified |
| View candidate profiles | Email = verified |
| Toggle between districts to browse candidates/PSAs | Email = verified |
| View matching/alignment scores | Questionnaire = complete |
| Use "Issues" filter in For You | Questionnaire = complete |
| Use "Most Important" filter | Questionnaire = complete |
| Use "Dealbreakers" filter | Dealbreakers = complete |
| Cast a **binding endorsement** for a candidate | Email + Voter Reg + Photo ID verified, AND user shares a district with the candidate |
| Run for office (candidate application) | All 3 verifications complete |

**Pre-email-verification:** Authenticated users who haven't verified email see a screen prompting them to check their inbox/resend the verification link. They cannot proceed to the main app until email is verified.

### District-Gated Endorsement

A voter can hold **multiple districts simultaneously** in a hierarchy. When voter registration is verified, their district assignments are populated. Example:

```
User districts: ['USA', 'MI', 'MI-HD-7', 'MI-SD-15']
                  ↑       ↑        ↑            ↑
               Federal   State   House Dist  Senate Dist
```

Each candidate is also assigned to a district (the contest they're running in). The endorsement button for a given candidate checks:

- **User shares a district with this candidate?** → Endorse button active
- **User does NOT share a district?** → Lock icon: *"You are not verified in this candidate's district. Complete your voter registration to endorse."*

Users can still **browse** candidates from any district by toggling the district selector on the home page — but they can only **endorse** within their own verified districts.

### What Users See for Locked Features

Every locked feature shows what it does AND what the user needs to unlock it:

| Locked Feature | What User Sees |
|----------------|----------------|
| Entire app (pre-email verification) | "Check your email to verify your account" screen with resend button |
| Alignment score on PSA | Circle shows "?" with tooltip: "Complete the policy quiz to see your match" |
| Issues/Most Important filters | Grayed out in dropdown: "Complete the quiz to unlock" |
| Dealbreakers filter | Grayed out: "Set your dealbreakers to unlock" |
| Endorse button (not fully verified) | Lock icon: "Verify your identity to endorse" → tapping shows checklist |
| Endorse button (wrong district) | Lock icon: "You are not verified in this candidate's district" → tapping shows voter registration prompt |
| Candidate application | CTA disabled: "Complete identity verification to apply" |

---

## New User Type Definition

### File: `src/types/index.ts`

**Replace the old single-dimension state fields with the new model:**

```typescript
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
  questionnaire: OnboardingState;       // Min 3 questions answered (1 per section)
  dealbreakers: OnboardingState;        // Dealbreakers selection done (even if 0)
}

// Hierarchical district model
export interface UserDistrict {
  id: string;          // e.g., 'MI-HD-7'
  type: DistrictType;  // 'federal' | 'state' | 'house' | 'senate' | 'local'
  name: string;        // e.g., 'Michigan House District 7'
  state?: string;      // e.g., 'MI' (two-letter state code)
}

export type DistrictType = 'federal' | 'state' | 'house' | 'senate' | 'local';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  displayName: string;                  // Computed: firstName + lastName (backward compat)
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
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

**Keep `UserRole` but simplify it:**
```typescript
// Remove 'unregistered' — everyone who signs up is a constituent
export type UserRole = 'constituent' | 'candidate' | 'admin';
```

**Add district to Candidate type:**
```typescript
export interface Candidate {
  // ... existing fields
  district: string;    // The district this candidate is running in (e.g., 'MI-HD-7')
}
```

**Update `RegisterFormData`:**
```typescript
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

```typescript
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
    if (!selectFullyVerified(state)) return false;
    const userDistrictIds = selectUserDistrictIds(state);
    return userDistrictIds.includes(candidateDistrict);
  };

/** Get the reason endorsement is locked for a candidate */
export const selectEndorseLockReason = (candidateDistrict: string) =>
  (state: UserState): string | null => {
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

export const selectQuestionnaireComplete = (state: UserState) =>
  state.userProfile?.onboarding?.questionnaire === 'complete';

export const selectDealbreakersComplete = (state: UserState) =>
  state.userProfile?.onboarding?.dealbreakers === 'complete';

// ─── Capability Selectors ───

/** User can browse app content (For You, candidate profiles) */
export const selectCanBrowse = (state: UserState) =>
  selectEmailVerified(state);

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
```typescript
const registerSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(50),
  lastName: z.string().min(1, 'Last name is required').max(50),
  email: z.string().email('Please enter a valid email'),
  password: z.string().min(8)
    .regex(/[A-Z]/, 'Must contain uppercase')
    .regex(/[a-z]/, 'Must contain lowercase')
    .regex(/[0-9]/, 'Must contain number'),
  confirmPassword: z.string(),
  acceptTerms: z.literal(true, {
    errorMap: () => ({ message: 'You must accept the terms' }),
  }),
}).refine(data => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});
```

**Update `onSubmit` — navigate to home after signup:**
```typescript
const onSubmit = async (data: RegisterForm) => {
  const displayName = `${data.firstName} ${data.lastName}`;
  const success = await signUp(
    data.email,
    data.password,
    displayName,
    data.firstName,
    data.lastName
  );
  if (success) {
    // Navigate to tabs — email verification gate in _layout.tsx
    // will show the "check your email" screen until verified
    router.replace('/(tabs)');
  }
};
```

### File: `src/stores/authStore.ts` — New initial state on signup

```typescript
signUp: async (email, password, displayName, firstName, lastName) => {
  // ... create Firebase Auth user (unchanged) ...

  // Create Firestore document with honest initial state
  await createUser(result.user.uid, {
    email: result.user.email || email,
    firstName,
    lastName,
    displayName,
    role: 'constituent',
    verification: {
      email: 'pending',                // Verification email sent, not yet clicked
      voterRegistration: 'unverified',
      photoId: 'unverified',
    },
    onboarding: {
      questionnaire: 'incomplete',
      dealbreakers: 'incomplete',
    },
    districts: [],                     // Empty until voter registration verified
    selectedIssues: [],
    questionnaireResponses: [],
    dealbreakers: [],
  });

  // Send email verification (non-blocking)
  await sendEmailVerification();

  return true;
},
```

### File: `app/(auth)/_layout.tsx` — Email verification gate (replaces onboarding gate)

```typescript
// OLD: Block until onboarding complete
// if (isAuthenticated && hasCompletedOnboarding) { return <Redirect ... /> }

// NEW: Authenticated users go to tabs, BUT...
if (isAuthenticated) {
  return <Redirect href="/(tabs)" />;
}
```

### File: `app/(tabs)/_layout.tsx` — Email verification screen before browse

```typescript
const isAuthenticated = useAuthStore(selectIsAuthenticated);
const emailVerified = useUserStore(selectEmailVerified);

// Must be authenticated
if (!isAuthenticated) {
  return <Redirect href="/(auth)/login" />;
}

// Must have verified email to browse
if (!emailVerified) {
  return <EmailVerificationScreen />;
}

// Render normal tab layout
return <Tabs ...>...</Tabs>;
```

### New Component: `EmailVerificationScreen`

Shown inside the tabs layout when email is not yet verified. Simple screen with:
- AMSP logo
- "Check your email" message
- The email address they registered with
- "Resend verification email" button
- "I've verified my email" button (refreshes auth state)
- "Sign out" link

```tsx
function EmailVerificationScreen() {
  const { firebaseUser, resendVerification } = useAuthStore();
  const theme = useTheme();

  const handleRefresh = async () => {
    // Reload Firebase user to check emailVerified flag
    await firebaseUser?.reload();
    // Auth state listener will pick up the change
  };

  return (
    <View style={styles.container}>
      <MaterialCommunityIcons name="email-outline" size={64} color={theme.colors.primary} />
      <Text variant="headlineSmall" style={styles.title}>Verify Your Email</Text>
      <Text variant="bodyMedium" style={styles.subtitle}>
        We sent a verification link to:
      </Text>
      <Text variant="bodyLarge" style={styles.email}>
        {firebaseUser?.email}
      </Text>
      <Button mode="contained" onPress={handleRefresh} style={styles.button}>
        I've Verified My Email
      </Button>
      <Button mode="text" onPress={resendVerification}>
        Resend Verification Email
      </Button>
    </View>
  );
}
```

---

## Questionnaire Completion Logic

### Minimum 3 questions (1 per section) to mark `complete`

```typescript
// In userStore.ts updateQuestionnaireResponses():
updateQuestionnaireResponses: async (userId, responses) => {
  const updates: Partial<User> = {
    questionnaireResponses: responses,
  };

  // Check if minimum threshold met: 1 global + 1 national + 1 local
  const hasMinimum = checkQuizMinimum(responses);
  if (hasMinimum) {
    updates['onboarding.questionnaire'] = 'complete';
  }

  return get().updateProfile(userId, updates);
},
```

```typescript
// Helper: Check 1 global + 1 national + 1 local answered
function checkQuizMinimum(responses: QuestionnaireResponse[]): boolean {
  const answeredIssueIds = new Set(responses.map((r) => r.issueId));

  // These come from the DISTRICT_ISSUES config (see Plan 03)
  // For now, use a general categorization
  const GLOBAL_ISSUES = ['climate-change', 'economy'];
  const NATIONAL_ISSUES = ['healthcare', 'education', 'gun-policy', 'immigration', 'criminal-justice'];
  const LOCAL_ISSUES = ['infrastructure', 'housing'];

  const hasGlobal = GLOBAL_ISSUES.some((id) => answeredIssueIds.has(id));
  const hasNational = NATIONAL_ISSUES.some((id) => answeredIssueIds.has(id));
  const hasLocal = LOCAL_ISSUES.some((id) => answeredIssueIds.has(id));

  return hasGlobal && hasNational && hasLocal;
}
```

### Quiz UI prompt for more answers

On the quiz screen, once 3 questions are answered (minimum met), show a banner:

```tsx
{meetsMinimum && answeredCount < 7 && (
  <View style={styles.morePrompt}>
    <MaterialCommunityIcons name="chart-line" size={20} color={theme.colors.primary} />
    <Text variant="bodySmall" style={styles.morePromptText}>
      Matching unlocked! Answer more questions to improve your results
      ({answeredCount}/7)
    </Text>
  </View>
)}
```

---

## District Model & Voter Registration Flow

### How districts are assigned

When a user completes voter registration verification, their district assignments are populated based on their registration address. Districts are **hierarchical** — a user belongs to multiple levels simultaneously:

```typescript
// Example: User registered in Ann Arbor, Michigan
const userDistricts: UserDistrict[] = [
  { id: 'USA',       type: 'federal', name: 'United States of America' },
  { id: 'MI',        type: 'state',   name: 'Michigan',              state: 'MI' },
  { id: 'MI-HD-7',   type: 'house',   name: 'Michigan House Dist 7', state: 'MI' },
  { id: 'MI-SD-15',  type: 'senate',  name: 'Michigan Senate Dist 15', state: 'MI' },
];
```

### Candidate district assignment

Each candidate runs in a specific district contest:

```typescript
// Example: Candidate running for MI House District 7
candidate.district = 'MI-HD-7';
```

### Endorsement gating per-candidate

```tsx
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
// - "Verify your email" / "Upload photo ID" / "Complete voter registration"
// - OR "You are not verified in this candidate's district"
```

### Browsing vs. Endorsing

Users can freely **browse** candidates from any district using the district toggle on the home page (see Plan 02). Browsing only requires email verification. But the **Endorse** button checks district membership per-candidate.

| Action | District Requirement |
|--------|---------------------|
| Browse candidates in PA-01 | None (email verified) |
| Browse candidates in MI-HD-7 | None (email verified) |
| Endorse candidate in PA-01 | User must have `PA-01` in their districts array |
| Endorse candidate in MI-HD-7 | User must have `MI-HD-7` in their districts array |

### Voter registration → district population

```typescript
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

```tsx
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

```tsx
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
      description: 'Answer at least 3 policy questions to see your matches',
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

```typescript
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

```typescript
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

### When questionnaire meets minimum (3 questions, 1 per section)

```typescript
updateQuestionnaireResponses: async (userId, responses) => {
  const updates: Partial<User> = { questionnaireResponses: responses };

  if (checkQuizMinimum(responses)) {
    updates['onboarding.questionnaire'] = 'complete';
  }

  return get().updateProfile(userId, updates);
},
```

### When dealbreakers are set

```typescript
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

```typescript
const handlePhotoIdUpload = async (idDocUrl: string) => {
  await updateUser(userId, {
    'verification.photoId': 'pending',
  });
  // Admin review sets it to 'verified' or 'failed'
};
```

---

## Migration: Existing Users

```typescript
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
        (user.questionnaireResponses?.length || 0) >= 3 ? 'complete' : 'incomplete',
      dealbreakers:
        user.dealbreakers !== undefined ? 'complete' : 'incomplete',
    },
    districts: user.district
      ? [{ id: user.district, type: 'house', name: user.district }]
      : [],
    firstName: user.displayName?.split(' ')[0] || '',
    lastName: user.displayName?.split(' ').slice(1).join(' ') || '',
  };
}
```

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/components/ui/GatedFeature.tsx` | Reusable lock overlay / inline badge for gated features |
| `src/components/ui/VerificationChecklist.tsx` | Progress card showing all 5 steps with CTAs |
| `src/components/ui/EmailVerificationScreen.tsx` | Pre-browse gate: "Check your email to verify" |

## Files to Modify

| File | Change |
|------|--------|
| `src/types/index.ts` | Replace `UserState`/`VerificationStatus` with `UserVerification`/`UserOnboarding`/`UserDistrict`; add `firstName`/`lastName`/`districts`; simplify `UserRole`; add `district` to Candidate |
| `app/(auth)/register.tsx` | Split name → firstName + lastName; navigate to `/(tabs)` on success |
| `app/(auth)/_layout.tsx` | Remove mandatory onboarding gate; authenticated users go to tabs |
| `app/(tabs)/_layout.tsx` | Add email verification gate before rendering tabs |
| `src/stores/authStore.ts` | Create user with new multi-dimensional state; sync email verification |
| `src/stores/userStore.ts` | Add capability selectors, district selectors, `selectEndorseLockReason`; update quiz/dealbreaker completion logic |
| `src/stores/index.ts` | Export new selectors |

## Files Using Gating (consumers, updated in later plans)

| File | Gated Feature |
|------|---------------|
| `src/components/feed/FullScreenPSA.tsx` | Alignment circle (quiz gate), endorse button (verification + district gate) |
| `src/components/feed/ExperienceMenu.tsx` | Issues/Most Important (quiz gate), Dealbreakers filter (dealbreakers gate) |
| `app/(tabs)/for-you.tsx` | Quiz prompt card for incomplete questionnaire |
| `src/components/home/VoterHome.tsx` | Verification progress card on home page |
| `app/(candidate)/apply.tsx` | Gate application behind full verification |
| `app/candidate/[id].tsx` | Gate endorsement behind verification + district match |

---

## Summary

```
Sign up (First + Last name + Email)
    → Verify email → App unlocks for browsing
    → Browse freely, toggle districts to explore candidates
    → See "?" on alignment → prompted to take quiz
    → Answer 3+ questions → alignment unlocked (prompted for more)
    → Set dealbreakers → Dealbreakers filter unlocks
    → Try to endorse → see verification checklist
    → Verify voter registration → districts assigned (USA, MI, MI-HD-7, MI-SD-15)
    → Upload photo ID → ✓
    → Endorse button active for candidates in YOUR districts
    → Try to endorse candidate in another district → "Not in your district" lock
```
