import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

const db = admin.firestore();

interface ApplicationApprovalData {
  applicationId: string;
  reviewerId: string;
}

interface ApplicationDenialData extends ApplicationApprovalData {
  denialReason: string;
}

/**
 * Process a new candidate application
 * Validates documents and moves to review queue
 */
export const processApplication = functions.firestore
  .document('candidateApplications/{applicationId}')
  .onCreate(async (snap, context) => {
    const application = snap.data();
    const applicationId = context.params.applicationId;

    try {
      // Validate required fields
      const requiredFields = ['userId', 'signatureDocUrl', 'idDocUrl'];
      const missingFields = requiredFields.filter((field) => !application[field]);

      if (missingFields.length > 0) {
        await snap.ref.update({
          status: 'denied',
          denialReason: `Missing required fields: ${missingFields.join(', ')}`,
          reviewedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        functions.logger.warn(`Application ${applicationId} denied: missing fields`);
        return;
      }

      // Move to under_review status
      await snap.ref.update({
        status: 'under_review',
      });

      // Notify admins
      const admins = await db
        .collection('users')
        .where('role', '==', 'admin')
        .get();

      const notifications = admins.docs.map((adminDoc) =>
        db.collection('notifications').add({
          userId: adminDoc.id,
          type: 'new_application',
          title: 'New Candidate Application',
          body: `A new candidate application requires review.`,
          data: { applicationId },
          isRead: false,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        })
      );

      await Promise.all(notifications);

      functions.logger.info(`Application ${applicationId} submitted for review`);
    } catch (error) {
      functions.logger.error(`Error processing application: ${error}`);
      throw error;
    }
  });

/**
 * Approve a candidate application
 * Creates candidate record and updates user role
 */
export const approveCandidate = functions.https.onCall(
  async (data: ApplicationApprovalData, context) => {
    // Verify caller is admin
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
    }

    const callerDoc = await db.collection('users').doc(context.auth.uid).get();
    if (callerDoc.data()?.role !== 'admin') {
      throw new functions.https.HttpsError('permission-denied', 'Must be admin');
    }

    const { applicationId, reviewerId } = data;

    try {
      const applicationRef = db.collection('candidateApplications').doc(applicationId);
      const application = await applicationRef.get();

      if (!application.exists) {
        throw new functions.https.HttpsError('not-found', 'Application not found');
      }

      const applicationData = application.data()!;

      // Update application status
      await applicationRef.update({
        status: 'approved',
        reviewedAt: admin.firestore.FieldValue.serverTimestamp(),
        reviewedBy: reviewerId,
      });

      // Create candidate record
      const candidateRef = db.collection('candidates').doc();
      await candidateRef.set({
        id: candidateRef.id,
        odid: applicationData.userId,
        status: 'approved',
        signatureDocUrl: applicationData.signatureDocUrl,
        declarationData: applicationData.declarationOfIntent,
        reasonForRunning: '',
        topIssues: [],
        bio: {
          summary: '',
          background: '',
          education: [],
          experience: [],
          achievements: [],
        },
        profileViews: 0,
        endorsementCount: 0,
        trendingScore: 0,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Update user role
      await db.collection('users').doc(applicationData.userId).update({
        role: 'candidate',
        state: 'approved_pn',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Notify the applicant
      await db.collection('notifications').add({
        userId: applicationData.userId,
        type: 'application_approved',
        title: 'Application Approved!',
        body: 'Congratulations! Your candidate application has been approved.',
        data: { candidateId: candidateRef.id },
        isRead: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Log the event
      await db.collection('auditLog').add({
        action: 'candidate_approved',
        applicationId,
        candidateId: candidateRef.id,
        userId: applicationData.userId,
        reviewerId,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });

      functions.logger.info(`Candidate approved: ${candidateRef.id}`);

      return { success: true, candidateId: candidateRef.id };
    } catch (error) {
      functions.logger.error(`Error approving candidate: ${error}`);
      throw new functions.https.HttpsError('internal', 'Failed to approve candidate');
    }
  }
);

/**
 * Deny a candidate application
 */
export const denyCandidate = functions.https.onCall(
  async (data: ApplicationDenialData, context) => {
    // Verify caller is admin
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
    }

    const callerDoc = await db.collection('users').doc(context.auth.uid).get();
    if (callerDoc.data()?.role !== 'admin') {
      throw new functions.https.HttpsError('permission-denied', 'Must be admin');
    }

    const { applicationId, reviewerId, denialReason } = data;

    try {
      const applicationRef = db.collection('candidateApplications').doc(applicationId);
      const application = await applicationRef.get();

      if (!application.exists) {
        throw new functions.https.HttpsError('not-found', 'Application not found');
      }

      const applicationData = application.data()!;

      // Update application status
      await applicationRef.update({
        status: 'denied',
        denialReason,
        reviewedAt: admin.firestore.FieldValue.serverTimestamp(),
        reviewedBy: reviewerId,
      });

      // Notify the applicant
      await db.collection('notifications').add({
        userId: applicationData.userId,
        type: 'application_denied',
        title: 'Application Update',
        body: 'Your candidate application was not approved at this time.',
        data: { applicationId, reason: denialReason },
        isRead: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Log the event
      await db.collection('auditLog').add({
        action: 'candidate_denied',
        applicationId,
        userId: applicationData.userId,
        reviewerId,
        denialReason,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });

      functions.logger.info(`Candidate denied: ${applicationId}`);

      return { success: true };
    } catch (error) {
      functions.logger.error(`Error denying candidate: ${error}`);
      throw new functions.https.HttpsError('internal', 'Failed to deny candidate');
    }
  }
);
