import { create } from 'zustand';
import {
  updateUser,
  subscribeToUser,
  getUser,
  getUserEndorsements,
} from '@/services/firebase/firestore';
import type { User, Endorsement, QuestionnaireResponse } from '@/types';

interface UserState {
  // State
  userProfile: User | null;
  endorsements: Endorsement[];
  isLoading: boolean;
  error: string | null;

  // Actions
  subscribeToProfile: (userId: string) => () => void;
  fetchUserProfile: (userId: string) => Promise<void>;
  updateProfile: (
    userId: string,
    updates: Partial<User>
  ) => Promise<boolean>;
  updateSelectedIssues: (userId: string, issues: string[]) => Promise<boolean>;
  updateQuestionnaireResponses: (
    userId: string,
    responses: QuestionnaireResponse[]
  ) => Promise<boolean>;
  updateDealbreakers: (
    userId: string,
    dealbreakers: string[]
  ) => Promise<boolean>;
  fetchEndorsements: (odid: string) => Promise<void>;
  setError: (error: string | null) => void;
  reset: () => void;
}

export const useUserStore = create<UserState>((set, get) => ({
  // Initial state
  userProfile: null,
  endorsements: [],
  isLoading: false,
  error: null,

  // Subscribe to real-time profile updates
  subscribeToProfile: (userId: string) => {
    set({ isLoading: true });

    const unsubscribe = subscribeToUser(userId, (user) => {
      set({ userProfile: user, isLoading: false });
    });

    return unsubscribe;
  },

  // Fetch user profile once
  fetchUserProfile: async (userId: string) => {
    set({ isLoading: true, error: null });

    try {
      const user = await getUser(userId);
      set({ userProfile: user, isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },

  // Update profile fields
  updateProfile: async (userId: string, updates: Partial<User>) => {
    set({ isLoading: true, error: null });

    try {
      await updateUser(userId, updates);
      set({ isLoading: false });
      return true;
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      return false;
    }
  },

  // Update selected issues
  updateSelectedIssues: async (userId: string, issues: string[]) => {
    if (issues.length < 4 || issues.length > 7) {
      set({ error: 'Please select between 4 and 7 issues' });
      return false;
    }

    return get().updateProfile(userId, { selectedIssues: issues });
  },

  // Update questionnaire responses
  updateQuestionnaireResponses: async (
    userId: string,
    responses: QuestionnaireResponse[]
  ) => {
    return get().updateProfile(userId, { questionnaireResponses: responses });
  },

  // Update dealbreakers
  updateDealbreakers: async (userId: string, dealbreakers: string[]) => {
    if (dealbreakers.length > 3) {
      set({ error: 'You can select a maximum of 3 dealbreakers' });
      return false;
    }

    return get().updateProfile(userId, { dealbreakers });
  },

  // Fetch user endorsements
  fetchEndorsements: async (odid: string) => {
    set({ isLoading: true, error: null });

    try {
      const endorsements = await getUserEndorsements(odid);
      set({ endorsements, isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },

  // Set error
  setError: (error: string | null) => {
    set({ error });
  },

  // Reset store
  reset: () => {
    set({
      userProfile: null,
      endorsements: [],
      isLoading: false,
      error: null,
    });
  },
}));

// Selectors
export const selectUserIssues = (state: UserState) =>
  state.userProfile?.selectedIssues || [];
export const selectUserDealbreakers = (state: UserState) =>
  state.userProfile?.dealbreakers || [];
export const selectHasCompletedOnboarding = (state: UserState) =>
  (state.userProfile?.selectedIssues?.length || 0) >= 4 &&
  (state.userProfile?.questionnaireResponses?.length || 0) > 0;
