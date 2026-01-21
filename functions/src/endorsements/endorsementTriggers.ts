import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

const db = admin.firestore();

/**
 * Trigger when a new endorsement is created
 * Updates candidate stats and notifies the candidate
 */
export const onEndorsementCreate = functions.firestore
  .document('endorsements/{endorsementId}')
  .onCreate(async (snap, context) => {
    const endorsement = snap.data();
    const { candidateId, odid } = endorsement;

    try {
      // Update candidate's endorsement count
      const candidateRef = db.collection('candidates').doc(candidateId);
      await candidateRef.update({
        endorsementCount: admin.firestore.FieldValue.increment(1),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Get candidate to find user ID
      const candidate = await candidateRef.get();
      const candidateData = candidate.data();

      if (candidateData?.odid) {
        // Create notification for candidate
        await db.collection('notifications').add({
          userId: candidateData.odid,
          type: 'endorsement_received',
          title: 'New Endorsement!',
          body: 'You received a new endorsement.',
          data: { candidateId, endorsementId: context.params.endorsementId },
          isRead: false,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      // Update daily metrics
      const today = new Date().toISOString().split('T')[0];
      const metricsRef = db
        .collection('profileMetrics')
        .doc(`${candidateId}_${today}`);

      await metricsRef.set(
        {
          candidateId,
          date: today,
          endorsementsReceived: admin.firestore.FieldValue.increment(1),
        },
        { merge: true }
      );

      // Log the event
      await db.collection('auditLog').add({
        action: 'endorsement_created',
        endorsementId: context.params.endorsementId,
        candidateId,
        odid,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });

      functions.logger.info(
        `Endorsement created: ${context.params.endorsementId}`
      );
    } catch (error) {
      functions.logger.error(`Error processing endorsement: ${error}`);
      throw error;
    }
  });

/**
 * Trigger when an endorsement is deleted/revoked
 * Updates candidate stats
 */
export const onEndorsementDelete = functions.firestore
  .document('endorsements/{endorsementId}')
  .onDelete(async (snap, context) => {
    const endorsement = snap.data();
    const { candidateId, odid } = endorsement;

    try {
      // Update candidate's endorsement count
      const candidateRef = db.collection('candidates').doc(candidateId);
      await candidateRef.update({
        endorsementCount: admin.firestore.FieldValue.increment(-1),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Log the event
      await db.collection('auditLog').add({
        action: 'endorsement_revoked',
        endorsementId: context.params.endorsementId,
        candidateId,
        odid,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });

      functions.logger.info(
        `Endorsement revoked: ${context.params.endorsementId}`
      );
    } catch (error) {
      functions.logger.error(`Error processing endorsement deletion: ${error}`);
      throw error;
    }
  });
