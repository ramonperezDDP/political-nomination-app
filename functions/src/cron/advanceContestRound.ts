import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

const BATCH_LIMIT = 500;

/**
 * Beta cron: advances the contest round daily at midnight ET.
 * Only runs in beta_demo mode.
 *
 * On each advancement:
 * 1. Evaluates elimination threshold for the outgoing round
 * 2. Marks candidates below threshold as eliminated
 * 3. Converts all active endorsements to bookmarks for each user
 * 4. Advances currentRoundId to the next round
 * 5. Creates audit trail in contestTransitions
 *
 * In beta_demo mode, when cycling back to pre_nomination, all candidates
 * are reset to 'active' status.
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
    const rounds = roundsSnap.docs.map((d) => ({ ...d.data(), id: d.id }));
    const currentIndex = rounds.findIndex((r) => r.id === currentRoundId);

    if (currentIndex < 0) {
      console.log('Current round not found.');
      return;
    }

    // If at the last round, cycle back to pre_nomination in beta_demo
    const isLastRound = currentIndex >= rounds.length - 1;
    const nextRound = isLastRound ? rounds[0] : rounds[currentIndex + 1];
    const currentRound = rounds[currentIndex];
    const operationId = `beta_cron_${currentRoundId}_to_${nextRound.id}_${Date.now()}`;

    // Set transition flag to prevent new endorsements during conversion
    await configRef.update({ roundTransitionInProgress: true });

    try {
      // --- Step 1: Eliminate candidates below threshold ---
      const eliminationThreshold = (currentRound as any).eliminationThreshold;
      const eliminatedCandidateIds: string[] = [];
      const tallySnapshot: Record<string, number> = {};

      if (eliminationThreshold != null && eliminationThreshold > 0) {
        const candidatesSnap = await db
          .collection('candidates')
          .where('status', '==', 'approved')
          .get();

        const eliminateBatch = db.batch();
        let eliminateCount = 0;

        for (const doc of candidatesSnap.docs) {
          const data = doc.data();
          tallySnapshot[doc.id] = data.endorsementCount || 0;

          if ((data.endorsementCount || 0) < eliminationThreshold && data.contestStatus !== 'eliminated') {
            eliminateBatch.update(doc.ref, { contestStatus: 'eliminated' });
            eliminatedCandidateIds.push(doc.id);
            eliminateCount++;

            // Flush batch at limit
            if (eliminateCount % BATCH_LIMIT === 0) {
              await eliminateBatch.commit();
            }
          }
        }

        if (eliminateCount % BATCH_LIMIT !== 0) {
          await eliminateBatch.commit();
        }

        console.log(`Eliminated ${eliminatedCandidateIds.length} candidates below threshold ${eliminationThreshold}`);
      }

      // --- Step 2: Convert endorsements to bookmarks ---
      let totalConverted = 0;
      const endorsementsSnap = await db
        .collection('endorsements')
        .where('isActive', '==', true)
        .get();

      // Group by user (odid)
      const endorsementsByUser = new Map<string, Array<{ id: string; candidateId: string }>>();
      for (const doc of endorsementsSnap.docs) {
        const data = doc.data();
        const odid = data.odid;
        if (!endorsementsByUser.has(odid)) {
          endorsementsByUser.set(odid, []);
        }
        endorsementsByUser.get(odid)!.push({
          id: doc.id,
          candidateId: data.candidateId,
        });
      }

      // Process each user's endorsements in batches
      for (const [odid, userEndorsements] of endorsementsByUser) {
        let batch = db.batch();
        let batchCount = 0;

        for (const endorsement of userEndorsements) {
          const bookmarkId = `${odid}_${endorsement.candidateId}`;
          const bookmarkRef = db.collection('bookmarks').doc(bookmarkId);

          // Idempotent: only create bookmark if it doesn't exist
          const bookmarkSnap = await bookmarkRef.get();
          if (!bookmarkSnap.exists) {
            batch.set(bookmarkRef, {
              id: bookmarkId,
              candidateId: endorsement.candidateId,
              convertedFromRoundId: currentRoundId,
              bookmarkedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            batchCount++;
          }

          // Soft-delete the endorsement
          batch.update(db.collection('endorsements').doc(endorsement.id), {
            isActive: false,
          });
          batchCount++;

          // Flush batch at limit
          if (batchCount >= BATCH_LIMIT) {
            await batch.commit();
            batch = db.batch();
            batchCount = 0;
          }
        }

        if (batchCount > 0) {
          await batch.commit();
        }

        totalConverted += userEndorsements.length;
      }

      console.log(`Converted ${totalConverted} endorsements to bookmarks for ${endorsementsByUser.size} users`);

      // --- Step 3: Reset candidates if cycling back to pre_nomination ---
      if (isLastRound && nextRound.id === 'pre_nomination') {
        const allCandidatesSnap = await db
          .collection('candidates')
          .where('contestStatus', '==', 'eliminated')
          .get();

        const resetBatch = db.batch();
        let resetCount = 0;
        for (const doc of allCandidatesSnap.docs) {
          resetBatch.update(doc.ref, { contestStatus: 'active' });
          resetCount++;
          if (resetCount % BATCH_LIMIT === 0) {
            await resetBatch.commit();
          }
        }
        if (resetCount % BATCH_LIMIT !== 0) {
          await resetBatch.commit();
        }
        console.log(`Reset ${resetCount} eliminated candidates to active (beta cycle reset)`);
      }

      // --- Step 4: Advance round with audit trail ---
      const advancedCandidateIds = Object.keys(tallySnapshot).filter(
        (id) => !eliminatedCandidateIds.includes(id)
      );

      await db.runTransaction(async (txn) => {
        const transitionRef = db.collection('contestTransitions').doc(operationId);

        txn.update(configRef, {
          currentRoundId: nextRound.id,
          contestStage: nextRound.id,
          roundTransitionInProgress: false,
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
          eliminationApplied: eliminatedCandidateIds.length > 0,
          tallySnapshot: Object.keys(tallySnapshot).length > 0 ? tallySnapshot : null,
          advancedCandidateIds,
          eliminatedCandidateIds,
          tieOccurred: false,
          tieBreakMethod: null,
          tieBreakDetails: null,
          notes: `Beta daily advancement. ${totalConverted} endorsements converted to bookmarks. ${eliminatedCandidateIds.length} candidates eliminated.`,
        });
      });

      console.log(`[beta_demo] Advanced from ${currentRoundId} to ${nextRound.id}`);
    } catch (error) {
      // Clear transition flag on error so the system isn't stuck
      await configRef.update({ roundTransitionInProgress: false });
      console.error('Error during round advancement:', error);
      throw error;
    }
  });
