import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

const db = admin.firestore();
const messaging = admin.messaging();

interface NotificationPayload {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}

interface BatchNotificationPayload {
  userIds: string[];
  title: string;
  body: string;
  data?: Record<string, string>;
}

/**
 * Send a push notification to a specific user
 */
export const sendPushNotification = functions.https.onCall(
  async (data: NotificationPayload, context) => {
    const { userId, title, body, data: notificationData } = data;

    try {
      // Get user's FCM token
      const userDoc = await db.collection('users').doc(userId).get();
      const userData = userDoc.data();
      const fcmToken = userData?.fcmToken;

      if (!fcmToken) {
        functions.logger.warn(`No FCM token for user: ${userId}`);
        return { success: false, reason: 'No FCM token' };
      }

      // Send push notification
      const message: admin.messaging.Message = {
        token: fcmToken,
        notification: {
          title,
          body,
        },
        data: notificationData,
        android: {
          priority: 'high',
          notification: {
            channelId: 'default',
          },
        },
        apns: {
          payload: {
            aps: {
              badge: 1,
              sound: 'default',
            },
          },
        },
      };

      await messaging.send(message);

      // Store notification in database
      await db.collection('notifications').add({
        userId,
        type: 'push',
        title,
        body,
        data: notificationData,
        isRead: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      functions.logger.info(`Push notification sent to: ${userId}`);
      return { success: true };
    } catch (error) {
      functions.logger.error(`Error sending push notification: ${error}`);
      throw new functions.https.HttpsError('internal', 'Failed to send notification');
    }
  }
);

/**
 * Send push notifications to multiple users
 */
export const sendBatchNotifications = functions.https.onCall(
  async (data: BatchNotificationPayload, context) => {
    // Verify caller is admin
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
    }

    const callerDoc = await db.collection('users').doc(context.auth.uid).get();
    if (callerDoc.data()?.role !== 'admin') {
      throw new functions.https.HttpsError('permission-denied', 'Must be admin');
    }

    const { userIds, title, body, data: notificationData } = data;

    try {
      // Get all FCM tokens
      const userDocs = await Promise.all(
        userIds.map((id) => db.collection('users').doc(id).get())
      );

      const tokens = userDocs
        .map((doc) => doc.data()?.fcmToken)
        .filter((token): token is string => !!token);

      if (tokens.length === 0) {
        functions.logger.warn('No FCM tokens found for batch');
        return { success: false, reason: 'No FCM tokens' };
      }

      // Send batch notification
      const message: admin.messaging.MulticastMessage = {
        tokens,
        notification: {
          title,
          body,
        },
        data: notificationData,
      };

      const response = await messaging.sendEachForMulticast(message);

      // Store notifications in database
      const batch = db.batch();
      userIds.forEach((userId) => {
        const notificationRef = db.collection('notifications').doc();
        batch.set(notificationRef, {
          userId,
          type: 'push',
          title,
          body,
          data: notificationData,
          isRead: false,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      });
      await batch.commit();

      functions.logger.info(
        `Batch notification sent: ${response.successCount} success, ${response.failureCount} failures`
      );

      return {
        success: true,
        successCount: response.successCount,
        failureCount: response.failureCount,
      };
    } catch (error) {
      functions.logger.error(`Error sending batch notifications: ${error}`);
      throw new functions.https.HttpsError('internal', 'Failed to send notifications');
    }
  }
);
