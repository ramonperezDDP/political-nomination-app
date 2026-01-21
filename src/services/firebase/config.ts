import { Platform } from 'react-native';

// Firebase configuration
// Replace these values with your actual Firebase project configuration
export const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || '',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || '',
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: Platform.select({
    ios: process.env.EXPO_PUBLIC_FIREBASE_APP_ID_IOS || '',
    android: process.env.EXPO_PUBLIC_FIREBASE_APP_ID_ANDROID || '',
    default: process.env.EXPO_PUBLIC_FIREBASE_APP_ID_WEB || '',
  }),
  measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID || '',
};

// Collection names
export const Collections = {
  USERS: 'users',
  CANDIDATES: 'candidates',
  CANDIDATE_APPLICATIONS: 'candidateApplications',
  PSAS: 'psas',
  ISSUES: 'issues',
  ISSUE_CATEGORIES: 'issueCategories',
  ENDORSEMENTS: 'endorsements',
  CONVERSATIONS: 'conversations',
  MESSAGES: 'messages',
  NOTIFICATIONS: 'notifications',
  QUESTIONS: 'questions',
  PARTY_CONFIG: 'partyConfig',
  PROFILE_METRICS: 'profileMetrics',
  AUDIT_LOG: 'auditLog',
} as const;

// Storage paths
export const StoragePaths = {
  PROFILE_PHOTOS: 'profilePhotos',
  PSA_VIDEOS: 'psaVideos',
  PSA_THUMBNAILS: 'psaThumbnails',
  SIGNATURE_DOCS: 'signatureDocs',
  ID_DOCS: 'idDocs',
  RESUMES: 'resumes',
  TAX_RETURNS: 'taxReturns',
  MESSAGE_ATTACHMENTS: 'messageAttachments',
} as const;

// Firebase error codes
export const FirebaseErrorCodes = {
  AUTH: {
    USER_NOT_FOUND: 'auth/user-not-found',
    WRONG_PASSWORD: 'auth/wrong-password',
    EMAIL_ALREADY_IN_USE: 'auth/email-already-in-use',
    WEAK_PASSWORD: 'auth/weak-password',
    INVALID_EMAIL: 'auth/invalid-email',
    USER_DISABLED: 'auth/user-disabled',
    TOO_MANY_REQUESTS: 'auth/too-many-requests',
    NETWORK_REQUEST_FAILED: 'auth/network-request-failed',
  },
  FIRESTORE: {
    PERMISSION_DENIED: 'permission-denied',
    NOT_FOUND: 'not-found',
    ALREADY_EXISTS: 'already-exists',
  },
} as const;
