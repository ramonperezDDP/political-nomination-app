import { create } from 'zustand';
import { Platform } from 'react-native';
import { FirebaseAuthTypes } from '@react-native-firebase/auth';
import {
  signInWithEmail,
  signInAnonymously as firebaseSignInAnonymously,
  linkWithCredential,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  sendEmailVerification,
  updateUserProfile,
} from '@/services/firebase/auth';
import { createUser, getUser, updateUser, subscribeToUser } from '@/services/firebase/firestore';
import type { User } from '@/types';

// App version — update on each release
const APP_VERSION = '1.0.0';

interface AuthState {
  // State
  firebaseUser: FirebaseAuthTypes.User | null;
  user: User | null;
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;

  // Actions
  initialize: () => () => void;
  signIn: (email: string, password: string) => Promise<boolean>;
  upgradeAnonymousAccount: (
    email: string,
    password: string,
    firstName: string,
    lastName: string
  ) => Promise<boolean>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<boolean>;
  resendVerification: () => Promise<boolean>;
  setUser: (user: User | null) => void;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  // Initial state
  firebaseUser: null,
  user: null,
  isLoading: true,
  isInitialized: false,
  error: null,

  // Initialize auth state listener with anonymous auth
  initialize: () => {
    let userUnsubscribe: (() => void) | null = null;

    const unsubscribe = onAuthStateChanged(async (firebaseUser) => {
      // Clean up previous user subscription
      if (userUnsubscribe) {
        userUnsubscribe();
        userUnsubscribe = null;
      }

      if (firebaseUser) {
        set({ firebaseUser, isLoading: true });

        // Check if Firestore user doc exists
        const existingUser = await getUser(firebaseUser.uid);

        if (!existingUser) {
          // New anonymous user — create Firestore document
          try {
            await createUser(firebaseUser.uid, {
              email: firebaseUser.email || '',
              firstName: '',
              lastName: '',
              displayName: firebaseUser.isAnonymous ? 'Anonymous' : (firebaseUser.displayName || ''),
              isAnonymous: firebaseUser.isAnonymous,
              role: 'constituent',
              verification: {
                email: 'unverified',
                voterRegistration: 'unverified',
                photoId: 'unverified',
              },
              onboarding: {
                questionnaire: 'incomplete',
              },
              districts: [],
              selectedIssues: [],
              questionnaireResponses: [],
              lastActiveAt: new Date() as any,
              sessionCount: 1,
              firstSeenAt: new Date() as any,
              appVersion: APP_VERSION,
              platform: Platform.OS,
            });
          } catch (error: any) {
            console.error('Error creating user doc:', error.message);
          }
        } else {
          // Existing user — update session metadata
          try {
            await updateUser(firebaseUser.uid, {
              lastActiveAt: new Date() as any,
              appVersion: APP_VERSION,
              platform: Platform.OS,
            });
          } catch (error: any) {
            console.error('Error updating session metadata:', error.message);
          }

          // Sync email verification status from Firebase Auth
          if (!firebaseUser.isAnonymous && firebaseUser.emailVerified) {
            if (existingUser.verification?.email !== 'verified') {
              try {
                await updateUser(firebaseUser.uid, {
                  'verification.email': 'verified' as any,
                });
              } catch (error: any) {
                console.error('Error syncing email verification:', error.message);
              }
            }
          }
        }

        // Subscribe to user data changes for real-time updates
        userUnsubscribe = subscribeToUser(firebaseUser.uid, (userData) => {
          set({ user: userData, isLoading: false, isInitialized: true });
        });
      } else {
        // No user at all — sign in anonymously
        set({ user: null });
        const result = await firebaseSignInAnonymously();
        if (!result.success) {
          console.error('Anonymous sign-in failed:', result.error);
          set({ isLoading: false, isInitialized: true });
        }
        // onAuthStateChanged will fire again with the new anonymous user
      }
    });

    return () => {
      unsubscribe();
      if (userUnsubscribe) {
        userUnsubscribe();
      }
    };
  },

  // Sign in with email/password
  signIn: async (email: string, password: string) => {
    set({ isLoading: true, error: null });

    const result = await signInWithEmail(email, password);

    if (!result.success) {
      set({ isLoading: false, error: result.error });
      return false;
    }

    // User data will be loaded by the auth state listener
    return true;
  },

  // Upgrade anonymous account to email/password
  upgradeAnonymousAccount: async (
    email: string,
    password: string,
    firstName: string,
    lastName: string
  ) => {
    set({ isLoading: true, error: null });

    const { firebaseUser } = get();
    if (!firebaseUser || !firebaseUser.isAnonymous) {
      set({ isLoading: false, error: 'No anonymous account to upgrade' });
      return false;
    }

    // Link anonymous account with email/password credentials
    const result = await linkWithCredential(email, password);
    if (!result.success || !result.user) {
      set({ isLoading: false, error: result.error });
      return false;
    }

    try {
      // Update the existing Firestore document (same UID, data preserved)
      const displayName = `${firstName} ${lastName}`;
      await updateUser(result.user.uid, {
        email,
        firstName,
        lastName,
        displayName,
        isAnonymous: false,
        'verification.email': 'pending' as any,
      });

      // Update Firebase Auth profile
      await updateUserProfile({ displayName });

      // Send email verification
      await sendEmailVerification();

      set({ isLoading: false });
      return true;
    } catch (error: any) {
      set({ isLoading: false, error: error.message });
      return false;
    }
  },

  // Sign out — signs out completely, then anonymous auth kicks in via onAuthStateChanged
  signOut: async () => {
    set({ isLoading: true, error: null });
    await firebaseSignOut();
    set({ firebaseUser: null, user: null, isLoading: false });
  },

  // Reset password
  resetPassword: async (email: string) => {
    set({ isLoading: true, error: null });

    const result = await sendPasswordResetEmail(email);

    if (!result.success) {
      set({ isLoading: false, error: result.error });
      return false;
    }

    set({ isLoading: false });
    return true;
  },

  // Resend verification email
  resendVerification: async () => {
    set({ isLoading: true, error: null });

    const result = await sendEmailVerification();

    if (!result.success) {
      set({ isLoading: false, error: result.error });
      return false;
    }

    set({ isLoading: false });
    return true;
  },

  // Set user (for external updates)
  setUser: (user: User | null) => {
    set({ user });
  },

  // Clear error
  clearError: () => {
    set({ error: null });
  },
}));

// Selectors
export const selectIsAuthenticated = (state: AuthState) =>
  state.firebaseUser !== null;
export const selectUserRole = (state: AuthState) => state.user?.role;
export const selectIsCandidate = (state: AuthState) =>
  state.user?.role === 'candidate';
export const selectIsAdmin = (state: AuthState) => state.user?.role === 'admin';
