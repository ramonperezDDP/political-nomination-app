import { create } from 'zustand';
import {
  updateUser,
  subscribeToUser,
  getUser,
  getUserEndorsements,
  createEndorsement as createEndorsementInFirestore,
  revokeEndorsement as revokeEndorsementInFirestore,
} from '@/services/firebase/firestore';
import type { User, Endorsement, QuestionnaireResponse } from '@/types';

interface UserState {
  // State
  userProfile: User | null;
  endorsements: Endorsement[];
  isLoading: boolean;
  error: string | null;
  selectedBrowsingDistrict: string; // 'PA-01' | 'PA-02' — for browsing only

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
  endorseCandidate: (odid: string, candidateId: string) => Promise<boolean>;
  revokeEndorsement: (odid: string, candidateId: string) => Promise<boolean>;
  hasEndorsedCandidate: (candidateId: string) => boolean;
  setSelectedBrowsingDistrict: (district: string) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

export const useUserStore = create<UserState>((set, get) => ({
  // Initial state
  userProfile: null,
  endorsements: [],
  isLoading: false,
  error: null,
  selectedBrowsingDistrict: 'PA-01',

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
    return get().updateProfile(userId, { selectedIssues: issues });
  },

  // Update questionnaire responses with completion check
  updateQuestionnaireResponses: async (
    userId: string,
    responses: QuestionnaireResponse[]
  ) => {
    const updates: Partial<User> = { questionnaireResponses: responses };

    // Mark questionnaire as complete when minimum 1 question answered
    if (responses.length >= 1) {
      (updates as any)['onboarding.questionnaire'] = 'complete';
    }

    return get().updateProfile(userId, updates);
  },

  // Update dealbreakers with completion marking
  updateDealbreakers: async (userId: string, dealbreakers: string[]) => {
    if (dealbreakers.length > 3) {
      set({ error: 'You can select a maximum of 3 dealbreakers' });
      return false;
    }

    const updates: Partial<User> = { dealbreakers };
    (updates as any)['onboarding.dealbreakers'] = 'complete';

    return get().updateProfile(userId, updates);
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

  // Endorse a candidate and update local state
  endorseCandidate: async (odid: string, candidateId: string) => {
    // Check if already endorsed locally
    if (get().hasEndorsedCandidate(candidateId)) {
      return true; // Already endorsed
    }

    try {
      const endorsementId = await createEndorsementInFirestore(odid, candidateId);

      // Add to local endorsements list
      const newEndorsement: Endorsement = {
        id: endorsementId,
        odid,
        candidateId,
        isActive: true,
        createdAt: new Date() as any,
      };

      set((state) => ({
        endorsements: [...state.endorsements, newEndorsement],
      }));

      return true;
    } catch (error: any) {
      console.error('Error endorsing candidate:', error);
      set({ error: error.message });
      return false;
    }
  },

  // Revoke an endorsement and update local state
  revokeEndorsement: async (odid: string, candidateId: string) => {
    // Check if endorsed locally
    if (!get().hasEndorsedCandidate(candidateId)) {
      return true; // Already not endorsed
    }

    try {
      await revokeEndorsementInFirestore(odid, candidateId);

      // Remove from local endorsements list (mark as inactive)
      set((state) => ({
        endorsements: state.endorsements.map((e) =>
          e.candidateId === candidateId ? { ...e, isActive: false } : e
        ),
      }));

      return true;
    } catch (error: any) {
      console.error('Error revoking endorsement:', error);
      set({ error: error.message });
      return false;
    }
  },

  // Check if user has endorsed a specific candidate
  hasEndorsedCandidate: (candidateId: string) => {
    return get().endorsements.some(
      (e) => e.candidateId === candidateId && e.isActive
    );
  },

  // Set browsing district (available to all users including anonymous)
  setSelectedBrowsingDistrict: (district: string) => {
    set({ selectedBrowsingDistrict: district });
    // Persist for authenticated users only
    const userId = get().userProfile?.id;
    if (userId && !get().userProfile?.isAnonymous) {
      updateUser(userId, { lastBrowsingDistrict: district });
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
      selectedBrowsingDistrict: 'PA-01',
    });
  },
}));

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

/** Questionnaire is complete (1+ question answered) */
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

// ─── Browsing District Selector ───

export const selectBrowsingDistrict = (state: UserState) =>
  state.selectedBrowsingDistrict;

// ─── Legacy Selectors (kept for backward compatibility) ───

export const selectUserIssues = (state: UserState) =>
  state.userProfile?.selectedIssues || [];
export const selectUserDealbreakers = (state: UserState) =>
  state.userProfile?.dealbreakers || [];
export const selectHasCompletedOnboarding = (state: UserState) =>
  selectQuestionnaireComplete(state);
export const selectEndorsedCandidateIds = (state: UserState) =>
  state.endorsements.filter((e) => e.isActive).map((e) => e.candidateId);
