import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

const db = admin.firestore();

/**
 * Scheduled function to calculate and update leaderboard rankings
 * Runs every hour
 */
export const calculateRankings = functions.pubsub
  .schedule('every 1 hours')
  .onRun(async (context) => {
    try {
      // Get all approved candidates
      const candidatesSnapshot = await db
        .collection('candidates')
        .where('status', '==', 'approved')
        .get();

      const candidates = candidatesSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Sort by endorsement count
      candidates.sort((a: any, b: any) => b.endorsementCount - a.endorsementCount);

      // Update rankings
      const batch = db.batch();
      candidates.forEach((candidate: any, index) => {
        const ref = db.collection('candidates').doc(candidate.id);
        batch.update(ref, {
          endorsementRank: index + 1,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      });

      await batch.commit();

      functions.logger.info(`Rankings updated for ${candidates.length} candidates`);
    } catch (error) {
      functions.logger.error(`Error calculating rankings: ${error}`);
      throw error;
    }
  });

/**
 * Scheduled function to update trending scores
 * Runs daily at midnight
 */
export const updateTrendingScores = functions.pubsub
  .schedule('every day 00:00')
  .timeZone('America/New_York')
  .onRun(async (context) => {
    try {
      // Get date range for trending calculation (last 7 days)
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 7);

      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];

      // Get all approved candidates
      const candidatesSnapshot = await db
        .collection('candidates')
        .where('status', '==', 'approved')
        .get();

      const batch = db.batch();

      for (const candidateDoc of candidatesSnapshot.docs) {
        const candidateId = candidateDoc.id;

        // Get metrics for the last 7 days
        const metricsSnapshot = await db
          .collection('profileMetrics')
          .where('candidateId', '==', candidateId)
          .where('date', '>=', startDateStr)
          .where('date', '<=', endDateStr)
          .get();

        let totalViews = 0;
        let totalEndorsements = 0;

        metricsSnapshot.docs.forEach((doc) => {
          const data = doc.data();
          totalViews += data.profileViews || 0;
          totalEndorsements += data.endorsementsReceived || 0;
        });

        // Calculate trending score
        // Weight: views (1x) + endorsements (5x)
        const trendingScore = totalViews + totalEndorsements * 5;

        batch.update(candidateDoc.ref, {
          trendingScore,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      await batch.commit();

      // Now update trending ranks
      const updatedCandidates = await db
        .collection('candidates')
        .where('status', '==', 'approved')
        .orderBy('trendingScore', 'desc')
        .get();

      const rankBatch = db.batch();
      updatedCandidates.docs.forEach((doc, index) => {
        rankBatch.update(doc.ref, {
          trendingRank: index + 1,
        });
      });

      await rankBatch.commit();

      functions.logger.info(
        `Trending scores updated for ${candidatesSnapshot.size} candidates`
      );
    } catch (error) {
      functions.logger.error(`Error updating trending scores: ${error}`);
      throw error;
    }
  });
