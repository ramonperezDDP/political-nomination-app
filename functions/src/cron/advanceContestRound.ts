import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

/**
 * Beta cron: advances the contest round daily at midnight ET.
 * Only runs in beta_demo mode. Skips elimination.
 * Every advancement is logged to contestTransitions for auditability.
 */
export const advanceContestRoundDaily = functions.pubsub
  .schedule('0 0 * * *')
  .timeZone('America/New_York')
  .onRun(async () => {
    const db = admin.firestore();
    const configRef = db.doc('config/partyConfig');
    const configSnap = await configRef.get();
    const currentRoundId = configSnap.data()?.currentRoundId || 'pre_nomination';
    const contestMode = configSnap.data()?.contestMode || 'beta_demo';

    // Only run in beta_demo mode
    if (contestMode !== 'beta_demo') {
      console.log('Not in beta_demo mode, skipping automatic advancement.');
      return;
    }

    // Get ordered rounds
    const roundsSnap = await db
      .collection('contestRounds')
      .orderBy('order')
      .get();
    const rounds = roundsSnap.docs.map((d) => d.data());
    const currentIndex = rounds.findIndex((r) => r.id === currentRoundId);

    if (currentIndex < 0 || currentIndex >= rounds.length - 1) {
      console.log('Contest complete or round not found.');
      return;
    }

    const nextRound = rounds[currentIndex + 1];
    const operationId = `beta_cron_${currentRoundId}_to_${nextRound.id}`;

    // Transactional advancement with audit record
    await db.runTransaction(async (txn) => {
      const transitionRef = db.collection('contestTransitions').doc(operationId);
      const existing = await txn.get(transitionRef);
      if (existing.exists) {
        console.log('Transition already processed (idempotent).');
        return;
      }

      txn.update(configRef, {
        currentRoundId: nextRound.id,
        contestStage: nextRound.id,
      });

      txn.create(transitionRef, {
        operationId,
        transitionType: 'forward',
        fromRoundId: currentRoundId,
        toRoundId: nextRound.id,
        transitionedAt: admin.firestore.FieldValue.serverTimestamp(),
        triggeredBy: 'beta_cron',
        actorId: null,
        contestMode: 'beta_demo',
        eliminationApplied: false,
        tallySnapshot: null,
        advancedCandidateIds: [],
        eliminatedCandidateIds: [],
        tieOccurred: false,
        tieBreakMethod: null,
        tieBreakDetails: null,
        notes: 'Automatic daily advancement for beta demo',
      });
    });

    console.log(`[beta_demo] Advanced from ${currentRoundId} to ${nextRound.id}`);
  });
