import { create } from 'zustand';
import { getPartyConfig, subscribeToPartyConfig, getIssues, ensureQuestionsExist, seedIssues, getContestRounds, seedContestRounds } from '@/services/firebase/firestore';
import { useUserStore } from './userStore';
import type { PartyConfig, Issue, ContestStage, ContestRound, ContestRoundId, VotingMethod, ContestMode } from '@/types';

interface ConfigState {
  // State
  partyConfig: PartyConfig | null;
  issues: Issue[];
  contestRounds: ContestRound[];
  currentRound: ContestRound | null;
  isLoading: boolean;
  error: string | null;
  debugRoundOverride: string | null;

  // Actions
  initialize: () => () => void;
  fetchConfig: () => Promise<void>;
  fetchIssues: () => Promise<void>;
  fetchContestRounds: () => Promise<void>;
  setError: (error: string | null) => void;
  setDebugRound: (roundId: string | null) => void;
}

// Helper: derive currentRound from partyConfig and contestRounds
function deriveCurrentRound(config: PartyConfig | null, rounds: ContestRound[]): ContestRound | null {
  if (!config || rounds.length === 0) return null;
  const roundId = config.currentRoundId || config.contestStage || 'round_1_endorsement';
  return rounds.find((r) => r.id === roundId) || rounds[0];
}

export const useConfigStore = create<ConfigState>((set, get) => ({
  // Initial state
  partyConfig: null,
  issues: [],
  contestRounds: [],
  currentRound: null,
  isLoading: true,
  error: null,
  debugRoundOverride: null,

  // Initialize config with real-time subscription
  initialize: () => {
    set({ isLoading: true });

    // Fetch issues once
    get().fetchIssues().catch((err) => console.warn('Error fetching issues:', err));

    // Fetch contest rounds once
    get().fetchContestRounds().catch((err) => console.warn('Error fetching contest rounds:', err));

    // Ensure questions are seeded (runs in background)
    ensureQuestionsExist().catch((err) => console.warn('Error ensuring questions:', err));

    // Subscribe to party config changes
    const unsubscribe = subscribeToPartyConfig((config) => {
      const { debugRoundOverride, contestRounds } = get();
      if (debugRoundOverride) {
        // Keep the override active — only update partyConfig but not currentRound
        set({ partyConfig: config, isLoading: false });
      } else {
        set({
          partyConfig: config,
          currentRound: deriveCurrentRound(config, contestRounds),
          isLoading: false,
        });
      }
    });

    return unsubscribe;
  },

  // Fetch config once
  fetchConfig: async () => {
    set({ isLoading: true, error: null });

    try {
      const config = await getPartyConfig();
      const rounds = get().contestRounds;
      set({
        partyConfig: config,
        currentRound: deriveCurrentRound(config, rounds),
        isLoading: false,
      });
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

  // Fetch contest rounds - auto-seeds if none exist
  fetchContestRounds: async () => {
    try {
      let rounds = await getContestRounds();

      if (rounds.length === 0) {
        console.log('No contest rounds found - auto-seeding...');
        try {
          await seedContestRounds();
          rounds = await getContestRounds();
          console.log('After seeding, fetched contest rounds:', rounds.length);
        } catch (seedError) {
          console.warn('Error auto-seeding contest rounds:', seedError);
        }
      }

      // Reseed if round labels are outdated (e.g., "First Round: Endorsement" → "Endorsement One")
      const outdated = rounds.find((r) => r.id === 'round_1_endorsement');
      if (outdated && outdated.label !== 'Endorsement One') {
        console.log('Round labels outdated — reseeding...');
        await seedContestRounds();
        rounds = await getContestRounds();
      }

      // Filter out legacy pre_nomination round (Firestore doc retained for audit trail)
      rounds = rounds.filter((r) => r.id !== 'pre_nomination');

      // Sort by order at store time so selectors return stable references
      rounds.sort((a, b) => a.order - b.order);

      const config = get().partyConfig;
      set({
        contestRounds: rounds,
        currentRound: deriveCurrentRound(config, rounds),
      });
    } catch (error: any) {
      console.warn('Error fetching contest rounds:', error);
    }
  },

  // Set error
  setError: (error: string | null) => {
    set({ error });
  },

  // Debug: override the current round locally (bypasses Firestore listener)
  // Also converts endorsements → bookmarks when advancing rounds
  setDebugRound: (roundId: string | null) => {
    const { contestRounds, partyConfig, debugRoundOverride } = get();
    const prevRoundId = debugRoundOverride || partyConfig?.currentRoundId || 'round_1_endorsement';

    if (!roundId) {
      // Clear override — revert to Firestore value
      set({
        debugRoundOverride: null,
        currentRound: deriveCurrentRound(partyConfig, contestRounds),
      });
    } else {
      const round = contestRounds.find((r) => r.id === roundId) || null;
      set({
        debugRoundOverride: roundId,
        currentRound: round,
      });

      // Convert endorsements → bookmarks when round changes
      if (roundId !== prevRoundId) {
        const userState = useUserStore.getState();
        const userId = userState.userProfile?.id;
        if (userId) {
          userState.convertEndorsementsToBookmarks(userId, prevRoundId).then((count: number) => {
            userState.fetchEndorsements(userId);
            userState.fetchBookmarks(userId);
          });
        }
      }
    }
  },
}));

// Selectors

/** @deprecated Use selectCurrentRoundId instead */
export const selectContestStage = (state: ConfigState): ContestStage =>
  (state.partyConfig?.currentRoundId || state.partyConfig?.contestStage || 'round_1_endorsement') as ContestStage;

export const selectCurrentRoundId = (state: ConfigState): ContestRoundId =>
  (state.debugRoundOverride || state.partyConfig?.currentRoundId || state.partyConfig?.contestStage || 'round_1_endorsement') as ContestRoundId;

export const selectVotingMethod = (state: ConfigState): VotingMethod =>
  state.currentRound?.votingMethod || 'none';

export const selectCanVote = (state: ConfigState): boolean => {
  const round = state.currentRound;
  if (!round) return false;
  if (round.votingMethod === 'none') return false;
  const now = new Date();
  if (round.startDate && now < round.startDate.toDate()) return false;
  if (round.endDate && now > round.endDate.toDate()) return false;
  return true;
};

export const selectIsEndorsementRound = (state: ConfigState): boolean =>
  state.currentRound?.isEndorsementRound || false;

export const selectCurrentRoundLabel = (state: ConfigState): string =>
  state.currentRound?.label || 'Endorsement One';

export const selectContestTimeline = (state: ConfigState): ContestRound[] =>
  state.contestRounds;

export const selectRoundStatus = (roundId: ContestRoundId) =>
  (state: ConfigState): 'past' | 'current' | 'future' => {
    const currentRound = state.contestRounds.find(
      (r) => r.id === (state.partyConfig?.currentRoundId || state.partyConfig?.contestStage)
    );
    const targetRound = state.contestRounds.find((r) => r.id === roundId);
    if (!currentRound || !targetRound) return 'future';
    if (targetRound.order < currentRound.order) return 'past';
    if (targetRound.order === currentRound.order) return 'current';
    return 'future';
  };

export const selectContestMode = (state: ConfigState): ContestMode =>
  state.partyConfig?.contestMode || 'beta_demo';

export const selectPrimaryColor = (state: ConfigState): string =>
  state.partyConfig?.primaryColor || '#5a3977';

export const selectSecondaryColor = (state: ConfigState): string =>
  state.partyConfig?.secondaryColor || '#067eba';

export const selectPartyName = (state: ConfigState): string =>
  state.partyConfig?.partyName || "America's Main Street Party";

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

export const selectEliminationThreshold = (state: ConfigState): number | undefined =>
  state.currentRound?.eliminationThreshold;

// Default config for fallback
export const defaultPartyConfig: PartyConfig = {
  id: 'default',
  partyName: "America's Main Street Party",
  primaryColor: '#5a3977',
  secondaryColor: '#067eba',
  logoUrl: '',
  tagline: 'Your voice matters',
  contestStage: 'round_1_endorsement',
  currentRoundId: 'round_1_endorsement',
  contestMode: 'beta_demo',
  endorsementCutoffs: [],
};
