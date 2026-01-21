import { create } from 'zustand';
import { FirebaseAuthTypes } from '@react-native-firebase/auth';
import {
  signInWithEmail,
  createAccount,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  sendEmailVerification,
} from '@/services/firebase/auth';
import { createUser, getUser, subscribeToUser } from '@/services/firebase/firestore';
import type { User, UserRole, UserState } from '@/types';

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
  signUp: (
    email: string,
    password: string,
    displayName: string
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

  // Initialize auth state listener
  initialize: () => {
    let userUnsubscribe: (() => void) | null = null;

    const unsubscribe = onAuthStateChanged(async (firebaseUser) => {
      set({ firebaseUser, isLoading: true });

      // Clean up previous user subscription
      if (userUnsubscribe) {
        userUnsubscribe();
        userUnsubscribe = null;
      }

      if (firebaseUser) {
        // Subscribe to user data changes for real-time updates
        userUnsubscribe = subscribeToUser(firebaseUser.uid, (userData) => {
          set({ user: userData, isLoading: false, isInitialized: true });
        });
      } else {
        set({ user: null, isLoading: false, isInitialized: true });
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

  // Sign up with email/password
  signUp: async (email: string, password: string, displayName: string) => {
    set({ isLoading: true, error: null });

    console.log('Starting signup for:', email);
    const result = await createAccount(email, password, displayName);

    if (!result.success || !result.user) {
      console.log('Auth creation failed:', result.error);
      set({ isLoading: false, error: result.error });
      return false;
    }

    console.log('Auth user created, creating Firestore document...');
    // Create user document in Firestore
    try {
      await createUser(result.user.uid, {
        email: result.user.email || email,
        displayName,
        role: 'unregistered' as UserRole,
        state: 'unverified' as UserState,
        verificationStatus: 'pending',
        selectedIssues: [],
        questionnaireResponses: [],
        dealbreakers: [],
      });

      console.log('Firestore document created, sending verification email...');
      // Send email verification
      await sendEmailVerification();

      console.log('Signup complete!');
      return true;
    } catch (error: any) {
      console.log('Firestore error:', error.message);
      set({ isLoading: false, error: error.message });
      return false;
    }
  },

  // Sign out
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
export const selectIsVerified = (state: AuthState) =>
  state.user?.verificationStatus === 'verified';
export const selectUserRole = (state: AuthState) => state.user?.role;
export const selectIsCandidate = (state: AuthState) =>
  state.user?.role === 'candidate';
export const selectIsAdmin = (state: AuthState) => state.user?.role === 'admin';
