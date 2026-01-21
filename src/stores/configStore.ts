import { create } from 'zustand';
import { getPartyConfig, subscribeToPartyConfig, getIssues, ensureQuestionsExist, seedIssues } from '@/services/firebase/firestore';
import type { PartyConfig, Issue, ContestStage } from '@/types';

interface ConfigState {
  // State
  partyConfig: PartyConfig | null;
  issues: Issue[];
  isLoading: boolean;
  error: string | null;

  // Actions
  initialize: () => () => void;
  fetchConfig: () => Promise<void>;
  fetchIssues: () => Promise<void>;
  setError: (error: string | null) => void;
}

export const useConfigStore = create<ConfigState>((set, get) => ({
  // Initial state
  partyConfig: null,
  issues: [],
  isLoading: true,
  error: null,

  // Initialize config with real-time subscription
  initialize: () => {
    set({ isLoading: true });

    // Fetch issues once
    get().fetchIssues();

    // Ensure questions are seeded (runs in background)
    ensureQuestionsExist().catch((err) => console.warn('Error ensuring questions:', err));

    // Subscribe to party config changes
    const unsubscribe = subscribeToPartyConfig((config) => {
      set({ partyConfig: config, isLoading: false });
    });

    return unsubscribe;
  },

  // Fetch config once
  fetchConfig: async () => {
    set({ isLoading: true, error: null });

    try {
      const config = await getPartyConfig();
      set({ partyConfig: config, isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },

  // Fetch all issues - auto-seeds if none exist
  fetchIssues: async () => {
    try {
      let issues = await getIssues();

      // Auto-seed issues if none exist
      if (issues.length === 0) {
        console.log('No issues found - auto-seeding issues...');
        try {
          await seedIssues();
          issues = await getIssues();
          console.log('After seeding, fetched issues:', issues.length);
        } catch (seedError) {
          console.warn('Error auto-seeding issues:', seedError);
        }
      }

      set({ issues });
    } catch (error: any) {
      set({ error: error.message });
    }
  },

  // Set error
  setError: (error: string | null) => {
    set({ error });
  },
}));

// Selectors
export const selectContestStage = (state: ConfigState): ContestStage =>
  state.partyConfig?.contestStage || 'pre_nomination';

export const selectPrimaryColor = (state: ConfigState): string =>
  state.partyConfig?.primaryColor || '#1a1a2e';

export const selectSecondaryColor = (state: ConfigState): string =>
  state.partyConfig?.secondaryColor || '#4a4a6e';

export const selectPartyName = (state: ConfigState): string =>
  state.partyConfig?.partyName || 'Political Party';

export const selectIssuesByCategory = (state: ConfigState) => {
  const categories = new Map<string, Issue[]>();

  state.issues.forEach((issue) => {
    const existing = categories.get(issue.category) || [];
    categories.set(issue.category, [...existing, issue]);
  });

  return categories;
};

export const selectIssueById = (state: ConfigState, issueId: string) =>
  state.issues.find((issue) => issue.id === issueId);

export const selectEndorsementCutoffs = (state: ConfigState) =>
  state.partyConfig?.endorsementCutoffs || [];

// Default config for fallback
export const defaultPartyConfig: PartyConfig = {
  id: 'default',
  partyName: 'Political Party',
  primaryColor: '#1a1a2e',
  secondaryColor: '#4a4a6e',
  logoUrl: '',
  tagline: 'Your voice matters',
  contestStage: 'pre_nomination',
  endorsementCutoffs: [],
};
