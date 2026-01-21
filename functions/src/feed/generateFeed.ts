import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

const db = admin.firestore();

interface FeedRequest {
  userId: string;
  limit?: number;
  offset?: number;
  filters?: {
    issueIds?: string[];
    minAlignment?: number;
    excludeDealbreakers?: boolean;
  };
}

interface FeedItem {
  id: string;
  psa: any;
  candidate: any;
  alignmentScore: number;
  matchedIssues: string[];
  hasDealbreaker: boolean;
}

/**
 * Generate a personalized feed for a user
 * Uses alignment scoring based on user preferences
 */
export const generatePersonalizedFeed = functions.https.onCall(
  async (data: FeedRequest, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
    }

    const { userId, limit = 20, offset = 0, filters } = data;

    try {
      // Get user preferences
      const userDoc = await db.collection('users').doc(userId).get();
      const userData = userDoc.data();

      if (!userData) {
        throw new functions.https.HttpsError('not-found', 'User not found');
      }

      const userIssues = userData.selectedIssues || [];
      const userDealbreakers = userData.dealbreakers || [];
      const userResponses = userData.questionnaireResponses || [];

      // Get published PSAs with their candidates
      let psasQuery = db
        .collection('psas')
        .where('status', '==', 'published')
        .orderBy('createdAt', 'desc')
        .limit(100); // Get more than needed for filtering

      const psasSnapshot = await psasQuery.get();

      // Process and score each PSA
      const feedItems: FeedItem[] = [];

      for (const psaDoc of psasSnapshot.docs) {
        const psa = psaDoc.data();

        // Get candidate data
        const candidateDoc = await db
          .collection('candidates')
          .doc(psa.candidateId)
          .get();
        const candidate = candidateDoc.data();

        if (!candidate || candidate.status !== 'approved') {
          continue;
        }

        // Get candidate user data
        const candidateUserDoc = await db
          .collection('users')
          .doc(candidate.odid)
          .get();
        const candidateUser = candidateUserDoc.data();

        // Calculate alignment score
        const alignmentScore = calculateAlignmentScore(
          userIssues,
          userResponses,
          candidate.topIssues || []
        );

        // Check for dealbreakers
        const matchedDealbreakers = candidate.topIssues?.filter(
          (issue: any) => userDealbreakers.includes(issue.issueId)
        );
        const hasDealbreaker = matchedDealbreakers && matchedDealbreakers.length > 0;

        // Find matched issues
        const psaIssues = psa.issueIds || [];
        const matchedIssues = psaIssues.filter((id: string) =>
          userIssues.includes(id)
        );

        // Apply filters
        if (filters?.issueIds && filters.issueIds.length > 0) {
          const hasFilteredIssue = psaIssues.some((id: string) =>
            filters.issueIds!.includes(id)
          );
          if (!hasFilteredIssue) continue;
        }

        if (filters?.minAlignment && alignmentScore < filters.minAlignment) {
          continue;
        }

        if (filters?.excludeDealbreakers && hasDealbreaker) {
          continue;
        }

        feedItems.push({
          id: `${psa.id}_${candidate.id}`,
          psa: {
            id: psa.id,
            candidateId: psa.candidateId,
            title: psa.title,
            description: psa.description,
            videoUrl: psa.videoUrl,
            thumbnailUrl: psa.thumbnailUrl,
            duration: psa.duration,
            status: psa.status,
            issueIds: psa.issueIds,
            views: psa.views,
            likes: psa.likes,
            createdAt: psa.createdAt,
          },
          candidate: {
            id: candidate.id,
            displayName: candidateUser?.displayName || 'Unknown',
            photoUrl: candidateUser?.photoUrl,
            topIssues: candidate.topIssues?.map((i: any) => i.issueId) || [],
            endorsementCount: candidate.endorsementCount,
          },
          alignmentScore,
          matchedIssues,
          hasDealbreaker,
        });
      }

      // Sort by alignment score (descending), then by recency
      feedItems.sort((a, b) => {
        // Prioritize non-dealbreaker items
        if (a.hasDealbreaker !== b.hasDealbreaker) {
          return a.hasDealbreaker ? 1 : -1;
        }
        // Then sort by alignment
        return b.alignmentScore - a.alignmentScore;
      });

      // Apply pagination
      const paginatedItems = feedItems.slice(offset, offset + limit);

      return {
        items: paginatedItems,
        total: feedItems.length,
        hasMore: offset + limit < feedItems.length,
      };
    } catch (error) {
      functions.logger.error(`Error generating feed: ${error}`);
      throw new functions.https.HttpsError('internal', 'Failed to generate feed');
    }
  }
);

/**
 * Calculate alignment score between user and candidate
 */
function calculateAlignmentScore(
  userIssues: string[],
  userResponses: any[],
  candidateIssues: any[]
): number {
  if (userIssues.length === 0 || candidateIssues.length === 0) {
    return 50; // Default to neutral
  }

  let matchedCount = 0;
  let totalWeight = 0;

  // Check issue overlap
  candidateIssues.forEach((candidateIssue, index) => {
    const weight = candidateIssues.length - index; // Higher priority = more weight
    totalWeight += weight;

    if (userIssues.includes(candidateIssue.issueId)) {
      matchedCount += weight;
    }
  });

  // Calculate base score from issue overlap
  const issueScore = totalWeight > 0 ? (matchedCount / totalWeight) * 100 : 50;

  // TODO: Factor in questionnaire response alignment
  // This would compare user responses to candidate positions on specific questions

  return Math.round(issueScore);
}
