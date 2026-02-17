import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

const db = admin.firestore();

interface PartyConfigUpdate {
  partyName?: string;
  primaryColor?: string;
  secondaryColor?: string;
  logoUrl?: string;
  tagline?: string;
  contestStage?: 'pre_nomination' | 'nomination' | 'voting' | 'post_election';
  endorsementCutoffs?: Array<{
    stage: number;
    threshold: number;
    eliminationDate: admin.firestore.Timestamp;
  }>;
}

interface ContestStageUpdate {
  stage: 'pre_nomination' | 'nomination' | 'voting' | 'post_election';
  notifyUsers?: boolean;
}

/**
 * Update party configuration
 * Admin only
 */
export const updatePartyConfig = functions.https.onCall(
  async (data: PartyConfigUpdate, context) => {
    // Verify caller is admin
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
    }

    const callerDoc = await db.collection('users').doc(context.auth.uid).get();
    if (callerDoc.data()?.role !== 'admin') {
      throw new functions.https.HttpsError('permission-denied', 'Must be admin');
    }

    try {
      // Get existing config or create new
      const configSnapshot = await db.collection('partyConfig').limit(1).get();

      if (configSnapshot.empty) {
        // Create new config
        const configRef = db.collection('partyConfig').doc();
        await configRef.set({
          id: configRef.id,
          partyName: data.partyName || "America's Main Street Party",
          primaryColor: data.primaryColor || '#5a3977',
          secondaryColor: data.secondaryColor || '#067eba',
          logoUrl: data.logoUrl || '',
          tagline: data.tagline || 'Your voice matters',
          contestStage: data.contestStage || 'pre_nomination',
          endorsementCutoffs: data.endorsementCutoffs || [],
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        functions.logger.info('Party config created');
        return { success: true, configId: configRef.id };
      }

      // Update existing config
      const configRef = configSnapshot.docs[0].ref;
      await configRef.update({
        ...data,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Log the change
      await db.collection('auditLog').add({
        action: 'party_config_updated',
        adminId: context.auth.uid,
        changes: data,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });

      functions.logger.info('Party config updated');
      return { success: true };
    } catch (error) {
      functions.logger.error(`Error updating party config: ${error}`);
      throw new functions.https.HttpsError('internal', 'Failed to update config');
    }
  }
);

/**
 * Manage contest stage transitions
 * Admin only
 */
export const manageContestStage = functions.https.onCall(
  async (data: ContestStageUpdate, context) => {
    // Verify caller is admin
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
    }

    const callerDoc = await db.collection('users').doc(context.auth.uid).get();
    if (callerDoc.data()?.role !== 'admin') {
      throw new functions.https.HttpsError('permission-denied', 'Must be admin');
    }

    const { stage, notifyUsers = true } = data;

    try {
      // Update config
      const configSnapshot = await db.collection('partyConfig').limit(1).get();

      if (configSnapshot.empty) {
        throw new functions.https.HttpsError('not-found', 'Party config not found');
      }

      const configRef = configSnapshot.docs[0].ref;
      const previousConfig = configSnapshot.docs[0].data();

      await configRef.update({
        contestStage: stage,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Handle stage-specific logic
      if (stage === 'nomination') {
        // Apply endorsement cutoffs
        await applyEndorsementCutoffs(previousConfig.endorsementCutoffs || []);
      }

      // Notify users if requested
      if (notifyUsers) {
        await notifyUsersOfStageChange(stage);
      }

      // Log the change
      await db.collection('auditLog').add({
        action: 'contest_stage_changed',
        adminId: context.auth.uid,
        previousStage: previousConfig.contestStage,
        newStage: stage,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });

      functions.logger.info(`Contest stage changed to: ${stage}`);
      return { success: true };
    } catch (error) {
      functions.logger.error(`Error managing contest stage: ${error}`);
      throw new functions.https.HttpsError('internal', 'Failed to update stage');
    }
  }
);

/**
 * Apply endorsement cutoffs to eliminate candidates
 */
async function applyEndorsementCutoffs(cutoffs: any[]) {
  if (!cutoffs || cutoffs.length === 0) return;

  const currentCutoff = cutoffs[0]; // First cutoff
  const threshold = currentCutoff.threshold;

  // Find candidates below threshold
  const belowThreshold = await db
    .collection('candidates')
    .where('status', '==', 'approved')
    .where('endorsementCount', '<', threshold)
    .get();

  // Mark as eliminated (don't delete, just update status)
  const batch = db.batch();
  belowThreshold.docs.forEach((doc) => {
    batch.update(doc.ref, {
      eliminatedAt: admin.firestore.FieldValue.serverTimestamp(),
      eliminationReason: `Below endorsement threshold of ${threshold}`,
    });
  });

  await batch.commit();

  functions.logger.info(
    `${belowThreshold.size} candidates marked below cutoff threshold`
  );
}

/**
 * Notify all users of stage change
 */
async function notifyUsersOfStageChange(stage: string) {
  const stageMessages: Record<string, { title: string; body: string }> = {
    pre_nomination: {
      title: 'Pre-Nomination Phase',
      body: 'The nomination process is in the pre-nomination phase. Explore candidates and learn about their positions.',
    },
    nomination: {
      title: 'Nomination Phase Started!',
      body: 'The nomination phase has begun. Endorse your preferred candidates before the deadline.',
    },
    voting: {
      title: 'Voting is Now Open!',
      body: 'The voting phase has started. Cast your vote for your preferred candidate.',
    },
    post_election: {
      title: 'Election Complete',
      body: 'The election has concluded. Thank you for participating in the democratic process.',
    },
  };

  const message = stageMessages[stage];
  if (!message) return;

  // Get all verified users
  const usersSnapshot = await db
    .collection('users')
    .where('verificationStatus', '==', 'verified')
    .get();

  // Create notifications
  const batch = db.batch();
  usersSnapshot.docs.forEach((doc) => {
    const notificationRef = db.collection('notifications').doc();
    batch.set(notificationRef, {
      userId: doc.id,
      type: 'leaderboard_update',
      title: message.title,
      body: message.body,
      isRead: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });

  await batch.commit();

  functions.logger.info(`Stage change notifications sent to ${usersSnapshot.size} users`);
}
