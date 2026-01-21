import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

const db = admin.firestore();

/**
 * Trigger when a new user is created in Firebase Auth
 * Creates the corresponding user document in Firestore
 */
export const onUserCreate = functions.auth.user().onCreate(async (user) => {
  const { uid, email, displayName, photoURL } = user;

  try {
    // Create user document
    await db.collection('users').doc(uid).set({
      id: uid,
      email: email || '',
      displayName: displayName || '',
      photoUrl: photoURL || null,
      role: 'unregistered',
      state: 'unverified',
      verificationStatus: 'pending',
      selectedIssues: [],
      questionnaireResponses: [],
      dealbreakers: [],
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Log the event
    await db.collection('auditLog').add({
      action: 'user_created',
      userId: uid,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      metadata: { email },
    });

    functions.logger.info(`User created: ${uid}`);
  } catch (error) {
    functions.logger.error(`Error creating user document: ${error}`);
    throw error;
  }
});

/**
 * Trigger when a user is deleted from Firebase Auth
 * Cleans up related data
 */
export const onUserDelete = functions.auth.user().onDelete(async (user) => {
  const { uid } = user;

  try {
    const batch = db.batch();

    // Delete user document
    batch.delete(db.collection('users').doc(uid));

    // Delete user's endorsements
    const endorsements = await db
      .collection('endorsements')
      .where('odid', '==', uid)
      .get();

    endorsements.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    // Delete user's notifications
    const notifications = await db
      .collection('notifications')
      .where('userId', '==', uid)
      .get();

    notifications.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    await batch.commit();

    // Log the event
    await db.collection('auditLog').add({
      action: 'user_deleted',
      userId: uid,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    functions.logger.info(`User deleted: ${uid}`);
  } catch (error) {
    functions.logger.error(`Error cleaning up user data: ${error}`);
    throw error;
  }
});
