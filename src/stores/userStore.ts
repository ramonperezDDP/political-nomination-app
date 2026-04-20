import { create } from 'zustand';
import {
  updateUser,
  subscribeToUser,
  getUser,
  getUserEndorsements,
  createEndorsement as createEndorsementInFirestore,
  revokeEndorsement as revokeEndorsementInFirestore,
  getUserBookmarks,
  addBookmark as addBookmarkInFirestore,
  removeBookmark as removeBookmarkInFirestore,
  convertEndorsementsToBookmarks as convertEndorsementsToBookmarksInFirestore,
  updateCandidate as updateCandidateInFirestore,
} from '@/services/firebase/firestore';
// Platform-specific FieldValue.increment — the native SDK exposes it via
// `firestore.FieldValue.increment`, the web SDK via a standalone `increment`.
// Both return a sentinel that updateCandidate forwards to the doc update.
import { Platform } from 'react-native';
const getIncrement = (n: number): any => {
  if (Platform.OS === 'web') {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { increment } = require('firebase/firestore');
    return increment(n);
  }
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const firestore = require('@react-native-firebase/firestore').default;
  return firestore.FieldValue.increment(n);
};
import type { User, Endorsement, Bookmark, QuestionnaireResponse } from '@/types';

interface UserState {
  // State
  userProfile: User | null;
  endorsements: Endorsement[];
  bookmarks: Bookmark[];
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
  fetchEndorsements: (odid: string, roundId?: string) => Promise<void>;
  endorseCandidate: (odid: string, candidateId: string, roundId?: string) => Promise<boolean>;
  revokeEndorsement: (odid: string, candidateId: string, roundId?: string) => Promise<boolean>;
  hasEndorsedCandidate: (candidateId: string) => boolean;
  fetchBookmarks: (odid: string) => Promise<void>;
  bookmarkCandidate: (odid: string, candidateId: string, convertedFromRoundId?: string) => Promise<boolean>;
  removeBookmark: (odid: string, candidateId: string) => Promise<boolean>;
  hasBookmarkedCandidate: (candidateId: string) => boolean;
  convertEndorsementsToBookmarks: (odid: string, roundId: string) => Promise<number>;
  reEndorseFromBookmark: (odid: string, candidateId: string, roundId?: string) => Promise<boolean>;
  setSelectedBrowsingDistrict: (district: string) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

export const useUserStore = create<UserState>((set, get) => ({
  // Initial state
  userProfile: null,
  endorsements: [],
  bookmarks: [],
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

  // Fetch user endorsements (optionally scoped to a round)
  fetchEndorsements: async (odid: string, roundId?: string) => {
    set({ isLoading: true, error: null });

    try {
      const endorsements = await getUserEndorsements(odid, roundId);
      set({ endorsements, isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },

  // Endorse a candidate and update local state
  endorseCandidate: async (odid: string, candidateId: string, roundId?: string) => {
    // Check if already endorsed locally
    if (get().hasEndorsedCandidate(candidateId)) {
      return true; // Already endorsed
    }

    // Store-level verification gate (defense-in-depth, see PLAN-18)
    // Beta: anonymous users can endorse if fully verified (via "I understand" flow)
    const profile = get().userProfile;
    if (!profile) {
      set({ error: 'Create an account to endorse' });
      return false;
    }
    if (profile.verification?.email !== 'verified' ||
        profile.verification?.voterRegistration !== 'verified' ||
        profile.verification?.photoId !== 'verified') {
      set({ error: 'Complete verification to endorse' });
      return false;
    }

    try {
      const endorsementId = await createEndorsementInFirestore(odid, candidateId, roundId);

      // Add to local endorsements list
      const newEndorsement: Endorsement = {
        id: endorsementId,
        odid,
        candidateId,
        roundId,
        isActive: true,
        createdAt: new Date() as any,
      };

      set((state) => ({
        endorsements: [...state.endorsements, newEndorsement],
      }));

      // Increment the candidate's count. Guarded by the hasEndorsedCandidate
      // check above — we only reach here when local state agrees the user
      // was NOT endorsed, so exactly one +1 per user-initiated endorse.
      try {
        await updateCandidateInFirestore(candidateId, {
          endorsementCount: getIncrement(1) as unknown as number,
        });
      } catch (countErr) {
        console.warn('Failed to increment endorsementCount (endorsement doc was still created):', countErr);
      }

      return true;
    } catch (error: any) {
      console.error('Error endorsing candidate:', error);
      set({ error: error.message });
      return false;
    }
  },

  // Revoke an endorsement and update local state
  revokeEndorsement: async (odid: string, candidateId: string, roundId?: string) => {
    // Check if endorsed locally
    if (!get().hasEndorsedCandidate(candidateId)) {
      return true; // Already not endorsed
    }

    try {
      await revokeEndorsementInFirestore(odid, candidateId, roundId);

      // Remove from local endorsements list (mark as inactive)
      set((state) => ({
        endorsements: state.endorsements.map((e) =>
          e.candidateId === candidateId ? { ...e, isActive: false } : e
        ),
      }));

      // Decrement the candidate's count. Guarded by the hasEndorsedCandidate
      // check above — we only reach here when local state agrees the user
      // WAS endorsed, so exactly one -1 per user-initiated revoke.
      try {
        await updateCandidateInFirestore(candidateId, {
          endorsementCount: getIncrement(-1) as unknown as number,
        });
      } catch (countErr) {
        console.warn('Failed to decrement endorsementCount (endorsement doc was still deactivated):', countErr);
      }

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

  // Fetch user bookmarks
  fetchBookmarks: async (odid: string) => {
    try {
      const bookmarks = await getUserBookmarks(odid);
      set({ bookmarks });
    } catch (error: any) {
      console.warn('Error fetching bookmarks:', error);
    }
  },

  // Bookmark a candidate
  bookmarkCandidate: async (odid: string, candidateId: string, convertedFromRoundId?: string) => {
    if (get().hasBookmarkedCandidate(candidateId)) {
      return true; // Already bookmarked
    }

    try {
      const bookmarkId = await addBookmarkInFirestore(odid, candidateId, convertedFromRoundId);

      const newBookmark: Bookmark = {
        id: bookmarkId,
        candidateId,
        convertedFromRoundId,
        bookmarkedAt: new Date() as any,
      };

      set((state) => ({
        bookmarks: [...state.bookmarks, newBookmark],
      }));

      return true;
    } catch (error: any) {
      console.error('Error bookmarking candidate:', error);
      set({ error: error.message });
      return false;
    }
  },

  // Remove a bookmark
  removeBookmark: async (odid: string, candidateId: string) => {
    if (!get().hasBookmarkedCandidate(candidateId)) {
      return true; // Already not bookmarked
    }

    try {
      await removeBookmarkInFirestore(odid, candidateId);

      set((state) => ({
        bookmarks: state.bookmarks.filter((b) => b.candidateId !== candidateId),
      }));

      return true;
    } catch (error: any) {
      console.error('Error removing bookmark:', error);
      set({ error: error.message });
      return false;
    }
  },

  // Check if user has bookmarked a specific candidate
  hasBookmarkedCandidate: (candidateId: string) => {
    return get().bookmarks.some((b) => b.candidateId === candidateId);
  },

  // Convert all endorsements from a round to bookmarks
  convertEndorsementsToBookmarks: async (odid: string, roundId: string) => {
    try {
      const count = await convertEndorsementsToBookmarksInFirestore(odid, roundId);
      // Refresh both lists
      await get().fetchEndorsements(odid);
      await get().fetchBookmarks(odid);
      return count;
    } catch (error: any) {
      console.error('Error converting endorsements to bookmarks:', error);
      return 0;
    }
  },

  // Re-endorse from bookmark: endorse for current round + remove bookmark
  reEndorseFromBookmark: async (odid: string, candidateId: string, roundId?: string) => {
    try {
      const endorsed = await get().endorseCandidate(odid, candidateId, roundId);
      if (endorsed) {
        await get().removeBookmark(odid, candidateId);
      }
      return endorsed;
    } catch (error: any) {
      console.error('Error re-endorsing from bookmark:', error);
      return false;
    }
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
      bookmarks: [],
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
    // Beta: skip anonymous check if user is fully verified (via "I understand" flow)
    if (!selectFullyVerified(state)) {
      if (selectIsAnonymous(state)) return 'Verify your identity to endorse';
      if (!selectEmailVerified(state)) return 'Verify your email to endorse';
      if (!selectVoterRegVerified(state)) return 'Complete voter registration to endorse';
      if (!selectPhotoIdVerified(state)) return 'Upload photo ID to endorse';
    }
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

// ─── Capability Selectors ───

/** User can see alignment scores and use Issues filter */
export const selectCanSeeAlignment = (state: UserState) =>
  selectQuestionnaireComplete(state);

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
  return missing;
};

/** Overall completion percentage for progress indicators */
export const selectCompletionPercent = (state: UserState): number => {
  let completed = 0;
  const total = 4;
  const v = state.userProfile?.verification;
  const o = state.userProfile?.onboarding;
  if (v?.email === 'verified') completed++;
  if (v?.voterRegistration === 'verified') completed++;
  if (v?.photoId === 'verified') completed++;
  if (o?.questionnaire === 'complete') completed++;
  return Math.round((completed / total) * 100);
};

// ─── Browsing District Selector ───

export const selectBrowsingDistrict = (state: UserState) =>
  state.selectedBrowsingDistrict;

// ─── Legacy Selectors (kept for backward compatibility) ───

export const selectUserIssues = (state: UserState) =>
  state.userProfile?.selectedIssues || [];
export const selectHasCompletedOnboarding = (state: UserState) =>
  selectQuestionnaireComplete(state);
export const selectEndorsedCandidateIds = (state: UserState) =>
  state.endorsements.filter((e) => e.isActive).map((e) => e.candidateId);

// ─── Bookmark Selectors ───

export const selectBookmarks = (state: UserState) => state.bookmarks;

export const selectBookmarkedCandidateIds = (state: UserState) =>
  state.bookmarks.map((b) => b.candidateId);

export const selectHasBookmarkedCandidate = (candidateId: string) =>
  (state: UserState): boolean =>
    state.bookmarks.some((b) => b.candidateId === candidateId);
