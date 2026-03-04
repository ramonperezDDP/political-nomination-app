import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

const db = admin.firestore();

/**
 * Scheduled Cloud Function that deletes abandoned anonymous accounts.
 *
 * Abandonment criteria:
 * - isAnonymous === true (never upgraded to email/password)
 * - lastActiveAt < 90 days ago (no app session in 3 months)
 *
 * Runs daily. Processes up to 500 accounts per invocation to stay
 * within Cloud Function timeout limits.
 */
export const cleanupAbandonedAnonymous = functions.pubsub
  .schedule('every 24 hours')
  .onRun(async () => {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 90);

    const abandoned = await db
      .collection('users')
      .where('isAnonymous', '==', true)
      .where('lastActiveAt', '<', cutoffDate)
      .limit(500)
      .get();

    if (abandoned.empty) {
      functions.logger.info('No abandoned anonymous accounts to clean up');
      return;
    }

    const batch = db.batch();
    const authDeletions: Promise<void>[] = [];

    for (const doc of abandoned.docs) {
      batch.delete(doc.ref);
      authDeletions.push(
        admin
          .auth()
          .deleteUser(doc.id)
          .catch((err) => {
            // User may already be deleted from Auth — log and continue
            functions.logger.warn(
              `Failed to delete Auth user ${doc.id}: ${err.message}`
            );
          })
      );
    }

    await Promise.all([batch.commit(), ...authDeletions]);

    functions.logger.info(
      `Cleaned up ${abandoned.size} abandoned anonymous accounts`
    );
  });
