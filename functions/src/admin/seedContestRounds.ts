import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

interface ContestRoundSeed {
  id: string;
  label: string;
  shortLabel: string;
  order: number;
  votingMethod: string;
  isEndorsementRound: boolean;
  candidatesEntering: number | null;
  candidatesAdvancing: number | null;
  startDate: null;
  endDate: null;
  tieBreakPolicy: string;
}

const CONTEST_ROUNDS: ContestRoundSeed[] = [
  { id: 'round_1_endorsement', label: 'Endorsement One', shortLabel: 'Round 1', order: 1, votingMethod: 'approval', isEndorsementRound: true, candidatesEntering: 100, candidatesAdvancing: 20, startDate: null, endDate: null, tieBreakPolicy: 'advance_all_tied' },
  { id: 'round_2_endorsement', label: 'Endorsement Two', shortLabel: 'Round 2', order: 2, votingMethod: 'approval', isEndorsementRound: true, candidatesEntering: 20, candidatesAdvancing: 10, startDate: null, endDate: null, tieBreakPolicy: 'trending_score' },
  { id: 'round_3_endorsement', label: 'Endorsement Three', shortLabel: 'Round 3', order: 3, votingMethod: 'approval', isEndorsementRound: true, candidatesEntering: 10, candidatesAdvancing: 4, startDate: null, endDate: null, tieBreakPolicy: 'trending_score' },
  { id: 'virtual_town_hall', label: 'Virtual Town Hall', shortLabel: 'Town Hall', order: 4, votingMethod: 'ranked_choice', isEndorsementRound: false, candidatesEntering: 4, candidatesAdvancing: 2, startDate: null, endDate: null, tieBreakPolicy: 'admin_decision' },
  { id: 'debate', label: 'Debate', shortLabel: 'Debate', order: 5, votingMethod: 'pick_one', isEndorsementRound: false, candidatesEntering: 2, candidatesAdvancing: 1, startDate: null, endDate: null, tieBreakPolicy: 'admin_decision' },
  { id: 'final_results', label: 'Final Results', shortLabel: 'Results', order: 6, votingMethod: 'none', isEndorsementRound: false, candidatesEntering: 1, candidatesAdvancing: null, startDate: null, endDate: null, tieBreakPolicy: 'advance_all_tied' },
  { id: 'post_election', label: 'Post-Election', shortLabel: 'Archive', order: 7, votingMethod: 'none', isEndorsementRound: false, candidatesEntering: null, candidatesAdvancing: null, startDate: null, endDate: null, tieBreakPolicy: 'advance_all_tied' },
];

/**
 * Admin-only callable function to seed contest round configuration documents.
 * Writes 8 round documents to the contestRounds collection.
 */
export const seedContestRounds = functions.https.onCall(
  async (_data, context) => {
    // Verify admin
    if (!context.auth?.token.admin) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'Only admins can seed contest rounds.'
      );
    }

    const db = admin.firestore();
    const batch = db.batch();

    for (const round of CONTEST_ROUNDS) {
      const ref = db.collection('contestRounds').doc(round.id);
      batch.set(ref, round);
    }

    await batch.commit();

    // Ensure partyConfig has currentRoundId
    const configRef = db.doc('config/partyConfig');
    const configSnap = await configRef.get();
    if (configSnap.exists && !configSnap.data()?.currentRoundId) {
      await configRef.update({
        currentRoundId: configSnap.data()?.contestStage || 'round_1_endorsement',
        contestMode: 'beta_demo',
      });
    }

    return { success: true, roundsSeeded: CONTEST_ROUNDS.length };
  }
);
