import { create } from 'zustand';
import {
  getCandidate,
  getCandidateByUserId,
  updateCandidate,
  createCandidate,
  getCandidatePSAs,
  createPSA,
  updatePSA,
  getProfileMetrics,
  createCandidateApplication,
  getUserCandidateApplication,
} from '@/services/firebase/firestore';
import type {
  Candidate,
  CandidateApplication,
  PSA,
  ProfileMetrics,
  TopIssue,
  CandidateBio,
} from '@/types';

interface CandidateState {
  // State
  candidate: Candidate | null;
  application: CandidateApplication | null;
  psas: PSA[];
  metrics: ProfileMetrics[];
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchCandidate: (candidateId: string) => Promise<void>;
  fetchCandidateByUser: (userId: string) => Promise<void>;
  fetchApplication: (userId: string) => Promise<void>;
  submitApplication: (
    userId: string,
    applicationData: Omit<CandidateApplication, 'id' | 'submittedAt'>
  ) => Promise<string | null>;
  updateCandidateProfile: (
    candidateId: string,
    updates: Partial<Candidate>
  ) => Promise<boolean>;
  updateTopIssues: (candidateId: string, topIssues: TopIssue[]) => Promise<boolean>;
  updateBio: (candidateId: string, bio: CandidateBio) => Promise<boolean>;
  fetchPSAs: (candidateId: string, status?: 'draft' | 'published') => Promise<void>;
  createNewPSA: (psaData: Omit<PSA, 'id' | 'createdAt' | 'updatedAt'>) => Promise<string | null>;
  updateExistingPSA: (psaId: string, updates: Partial<PSA>) => Promise<boolean>;
  publishPSA: (psaId: string) => Promise<boolean>;
  fetchMetrics: (candidateId: string, days?: number) => Promise<void>;
  setError: (error: string | null) => void;
  reset: () => void;
}

export const useCandidateStore = create<CandidateState>((set, get) => ({
  // Initial state
  candidate: null,
  application: null,
  psas: [],
  metrics: [],
  isLoading: false,
  error: null,

  // Fetch candidate by ID
  fetchCandidate: async (candidateId: string) => {
    set({ isLoading: true, error: null });

    try {
      const candidate = await getCandidate(candidateId);
      set({ candidate, isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },

  // Fetch candidate by user ID
  fetchCandidateByUser: async (userId: string) => {
    set({ isLoading: true, error: null });

    try {
      const candidate = await getCandidateByUserId(userId);
      set({ candidate, isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },

  // Fetch user's application
  fetchApplication: async (userId: string) => {
    set({ isLoading: true, error: null });

    try {
      const application = await getUserCandidateApplication(userId);
      set({ application, isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },

  // Submit candidate application
  submitApplication: async (
    userId: string,
    applicationData: Omit<CandidateApplication, 'id' | 'submittedAt'>
  ) => {
    set({ isLoading: true, error: null });

    try {
      const applicationId = await createCandidateApplication(applicationData);
      const application = await getUserCandidateApplication(userId);
      set({ application, isLoading: false });
      return applicationId;
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      return null;
    }
  },

  // Update candidate profile
  updateCandidateProfile: async (candidateId: string, updates: Partial<Candidate>) => {
    set({ isLoading: true, error: null });

    try {
      await updateCandidate(candidateId, updates);
      const candidate = await getCandidate(candidateId);
      set({ candidate, isLoading: false });
      return true;
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      return false;
    }
  },

  // Update top issues
  updateTopIssues: async (candidateId: string, topIssues: TopIssue[]) => {
    return get().updateCandidateProfile(candidateId, { topIssues });
  },

  // Update bio
  updateBio: async (candidateId: string, bio: CandidateBio) => {
    return get().updateCandidateProfile(candidateId, { bio });
  },

  // Fetch PSAs
  fetchPSAs: async (candidateId: string, status?: 'draft' | 'published') => {
    set({ isLoading: true, error: null });

    try {
      const psas = await getCandidatePSAs(candidateId, status);
      set({ psas, isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },

  // Create new PSA
  createNewPSA: async (psaData: Omit<PSA, 'id' | 'createdAt' | 'updatedAt'>) => {
    set({ isLoading: true, error: null });

    try {
      const psaId = await createPSA(psaData);
      // Refresh PSA list
      await get().fetchPSAs(psaData.candidateId);
      set({ isLoading: false });
      return psaId;
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      return null;
    }
  },

  // Update existing PSA
  updateExistingPSA: async (psaId: string, updates: Partial<PSA>) => {
    set({ isLoading: true, error: null });

    try {
      await updatePSA(psaId, updates);
      set({ isLoading: false });
      return true;
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      return false;
    }
  },

  // Publish PSA
  publishPSA: async (psaId: string) => {
    return get().updateExistingPSA(psaId, { status: 'published' });
  },

  // Fetch metrics
  fetchMetrics: async (candidateId: string, days = 30) => {
    set({ isLoading: true, error: null });

    try {
      const metrics = await getProfileMetrics(candidateId, days);
      set({ metrics, isLoading: false });
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
      candidate: null,
      application: null,
      psas: [],
      metrics: [],
      isLoading: false,
      error: null,
    });
  },
}));

// Selectors
export const selectIsApprovedCandidate = (state: CandidateState) =>
  state.candidate?.status === 'approved';

export const selectHasPendingApplication = (state: CandidateState) =>
  state.application?.status === 'pending' ||
  state.application?.status === 'under_review';

export const selectPublishedPSAs = (state: CandidateState) =>
  state.psas.filter((psa) => psa.status === 'published');

export const selectDraftPSAs = (state: CandidateState) =>
  state.psas.filter((psa) => psa.status === 'draft');
