import * as admin from 'firebase-admin';

// Initialize Firebase Admin
admin.initializeApp();

// Export auth triggers
export { onUserCreate, onUserDelete } from './auth/onUserCreate';

// Export candidate functions
export { processApplication, approveCandidate, denyCandidate } from './candidates/processApplication';

// Export endorsement functions
export { onEndorsementCreate, onEndorsementDelete } from './endorsements/endorsementTriggers';

// Export notification functions
export { sendPushNotification, sendBatchNotifications } from './notifications/sendPushNotification';

// Export feed functions
export { generatePersonalizedFeed } from './feed/generateFeed';

// Export leaderboard functions
export { calculateRankings, updateTrendingScores } from './leaderboard/calculateRankings';

// Export admin functions
export { updatePartyConfig, manageContestStage } from './admin/partyConfig';
