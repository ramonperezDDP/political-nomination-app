import firestore, {
  FirebaseFirestoreTypes,
} from '@react-native-firebase/firestore';
import { Collections } from './config';
import type {
  User,
  Candidate,
  CandidateApplication,
  PSA,
  Issue,
  Endorsement,
  Conversation,
  Message,
  Notification,
  Question,
  PartyConfig,
  ProfileMetrics,
  LeaderboardEntry,
  FeedItem,
} from '@/types';

type Timestamp = FirebaseFirestoreTypes.Timestamp;

// Generic helper to get collection reference
const getCollection = <T extends FirebaseFirestoreTypes.DocumentData>(collectionName: string) =>
  firestore().collection(collectionName) as FirebaseFirestoreTypes.CollectionReference<T>;

// ==================== USER OPERATIONS ====================

export const createUser = async (
  userId: string,
  data: Omit<User, 'id' | 'createdAt' | 'updatedAt'>
): Promise<void> => {
  const now = firestore.Timestamp.now();
  await getCollection<User>(Collections.USERS).doc(userId).set({
    id: userId,
    ...data,
    createdAt: now,
    updatedAt: now,
  } as User);
};

export const getUser = async (userId: string): Promise<User | null> => {
  const doc = await getCollection<User>(Collections.USERS).doc(userId).get();
  return doc.exists ? (doc.data() as User) : null;
};

export const updateUser = async (
  userId: string,
  data: Partial<User>
): Promise<void> => {
  await getCollection<User>(Collections.USERS).doc(userId).update({
    ...data,
    updatedAt: firestore.Timestamp.now(),
  });
};

export const subscribeToUser = (
  userId: string,
  callback: (user: User | null) => void
): (() => void) => {
  return getCollection<User>(Collections.USERS)
    .doc(userId)
    .onSnapshot((doc) => {
      callback(doc.exists ? (doc.data() as User) : null);
    });
};

// ==================== CANDIDATE OPERATIONS ====================

export const createCandidate = async (
  data: Omit<Candidate, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> => {
  const now = firestore.Timestamp.now();
  const docRef = await getCollection<Candidate>(Collections.CANDIDATES).add({
    ...data,
    createdAt: now,
    updatedAt: now,
  } as Candidate);
  await docRef.update({ id: docRef.id });
  return docRef.id;
};

export const getCandidate = async (candidateId: string): Promise<Candidate | null> => {
  const doc = await getCollection<Candidate>(Collections.CANDIDATES)
    .doc(candidateId)
    .get();
  return doc.exists ? (doc.data() as Candidate) : null;
};

export const getCandidateByUserId = async (
  userId: string
): Promise<Candidate | null> => {
  const snapshot = await getCollection<Candidate>(Collections.CANDIDATES)
    .where('userId', '==', userId)
    .limit(1)
    .get();
  return snapshot.empty ? null : (snapshot.docs[0].data() as Candidate);
};

export const updateCandidate = async (
  candidateId: string,
  data: Partial<Candidate>
): Promise<void> => {
  await getCollection<Candidate>(Collections.CANDIDATES).doc(candidateId).update({
    ...data,
    updatedAt: firestore.Timestamp.now(),
  });
};

export const getApprovedCandidates = async (
  limit = 50
): Promise<Candidate[]> => {
  const snapshot = await getCollection<Candidate>(Collections.CANDIDATES)
    .where('status', '==', 'approved')
    .orderBy('endorsementCount', 'desc')
    .limit(limit)
    .get();
  return snapshot.docs.map((doc) => doc.data() as Candidate);
};

export const incrementCandidateViews = async (
  candidateId: string
): Promise<void> => {
  await getCollection<Candidate>(Collections.CANDIDATES)
    .doc(candidateId)
    .update({
      profileViews: firestore.FieldValue.increment(1),
    });
};

// ==================== CANDIDATE APPLICATION OPERATIONS ====================

export const createCandidateApplication = async (
  data: Omit<CandidateApplication, 'id' | 'submittedAt'>
): Promise<string> => {
  const docRef = await getCollection<CandidateApplication>(
    Collections.CANDIDATE_APPLICATIONS
  ).add({
    ...data,
    submittedAt: firestore.Timestamp.now(),
  } as CandidateApplication);
  await docRef.update({ id: docRef.id });
  return docRef.id;
};

export const getCandidateApplication = async (
  applicationId: string
): Promise<CandidateApplication | null> => {
  const doc = await getCollection<CandidateApplication>(
    Collections.CANDIDATE_APPLICATIONS
  )
    .doc(applicationId)
    .get();
  return doc.exists ? (doc.data() as CandidateApplication) : null;
};

export const getUserCandidateApplication = async (
  userId: string
): Promise<CandidateApplication | null> => {
  const snapshot = await getCollection<CandidateApplication>(
    Collections.CANDIDATE_APPLICATIONS
  )
    .where('userId', '==', userId)
    .orderBy('submittedAt', 'desc')
    .limit(1)
    .get();
  return snapshot.empty
    ? null
    : (snapshot.docs[0].data() as CandidateApplication);
};

// ==================== PSA OPERATIONS ====================

export const createPSA = async (
  data: Omit<PSA, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> => {
  const now = firestore.Timestamp.now();
  const docRef = await getCollection<PSA>(Collections.PSAS).add({
    ...data,
    createdAt: now,
    updatedAt: now,
  } as PSA);
  await docRef.update({ id: docRef.id });
  return docRef.id;
};

export const getPSA = async (psaId: string): Promise<PSA | null> => {
  const doc = await getCollection<PSA>(Collections.PSAS).doc(psaId).get();
  return doc.exists ? (doc.data() as PSA) : null;
};

export const getCandidatePSAs = async (
  candidateId: string,
  status?: 'draft' | 'published'
): Promise<PSA[]> => {
  let query = getCollection<PSA>(Collections.PSAS).where(
    'candidateId',
    '==',
    candidateId
  );
  if (status) {
    query = query.where('status', '==', status);
  }
  const snapshot = await query.orderBy('createdAt', 'desc').get();
  return snapshot.docs.map((doc) => doc.data() as PSA);
};

export const updatePSA = async (
  psaId: string,
  data: Partial<PSA>
): Promise<void> => {
  await getCollection<PSA>(Collections.PSAS).doc(psaId).update({
    ...data,
    updatedAt: firestore.Timestamp.now(),
  });
};

export const incrementPSAViews = async (psaId: string): Promise<void> => {
  await getCollection<PSA>(Collections.PSAS)
    .doc(psaId)
    .update({
      views: firestore.FieldValue.increment(1),
    });
};

// ==================== ISSUE OPERATIONS ====================

export const getIssues = async (): Promise<Issue[]> => {
  const snapshot = await getCollection<Issue>(Collections.ISSUES)
    .where('isActive', '==', true)
    .orderBy('order')
    .get();
  return snapshot.docs.map((doc) => doc.data() as Issue);
};

export const getIssuesByCategory = async (category: string): Promise<Issue[]> => {
  const snapshot = await getCollection<Issue>(Collections.ISSUES)
    .where('category', '==', category)
    .where('isActive', '==', true)
    .orderBy('order')
    .get();
  return snapshot.docs.map((doc) => doc.data() as Issue);
};

// ==================== ENDORSEMENT OPERATIONS ====================

export const createEndorsement = async (
  odid: string,
  candidateId: string
): Promise<string> => {
  // Check if user already endorsed this candidate
  const existing = await getCollection<Endorsement>(Collections.ENDORSEMENTS)
    .where('odid', '==', odid)
    .where('candidateId', '==', candidateId)
    .where('isActive', '==', true)
    .limit(1)
    .get();

  if (!existing.empty) {
    throw new Error('You have already endorsed this candidate');
  }

  const docRef = await getCollection<Endorsement>(Collections.ENDORSEMENTS).add({
    odid,
    candidateId,
    isActive: true,
    createdAt: firestore.Timestamp.now(),
  } as Endorsement);
  await docRef.update({ id: docRef.id });

  // Increment candidate's endorsement count
  await updateCandidate(candidateId, {
    endorsementCount: firestore.FieldValue.increment(1) as unknown as number,
  });

  return docRef.id;
};

export const revokeEndorsement = async (
  odid: string,
  candidateId: string
): Promise<void> => {
  const snapshot = await getCollection<Endorsement>(Collections.ENDORSEMENTS)
    .where('odid', '==', odid)
    .where('candidateId', '==', candidateId)
    .where('isActive', '==', true)
    .limit(1)
    .get();

  if (!snapshot.empty) {
    await snapshot.docs[0].ref.update({ isActive: false });
    // Decrement candidate's endorsement count
    await updateCandidate(candidateId, {
      endorsementCount: firestore.FieldValue.increment(-1) as unknown as number,
    });
  }
};

export const getUserEndorsements = async (odid: string): Promise<Endorsement[]> => {
  const snapshot = await getCollection<Endorsement>(Collections.ENDORSEMENTS)
    .where('odid', '==', odid)
    .where('isActive', '==', true)
    .get();
  return snapshot.docs.map((doc) => doc.data() as Endorsement);
};

export const hasUserEndorsedCandidate = async (
  odid: string,
  candidateId: string
): Promise<boolean> => {
  const snapshot = await getCollection<Endorsement>(Collections.ENDORSEMENTS)
    .where('odid', '==', odid)
    .where('candidateId', '==', candidateId)
    .where('isActive', '==', true)
    .limit(1)
    .get();
  return !snapshot.empty;
};

// ==================== CONVERSATION/MESSAGE OPERATIONS ====================

export const getOrCreateConversation = async (
  participantIds: string[]
): Promise<string> => {
  const sortedIds = [...participantIds].sort();
  const snapshot = await getCollection<Conversation>(Collections.CONVERSATIONS)
    .where('participantIds', '==', sortedIds)
    .limit(1)
    .get();

  if (!snapshot.empty) {
    return snapshot.docs[0].id;
  }

  const now = firestore.Timestamp.now();
  const docRef = await getCollection<Conversation>(Collections.CONVERSATIONS).add({
    participantIds: sortedIds,
    createdAt: now,
    updatedAt: now,
  } as Conversation);
  await docRef.update({ id: docRef.id });
  return docRef.id;
};

export const getUserConversations = async (
  userId: string
): Promise<Conversation[]> => {
  const snapshot = await getCollection<Conversation>(Collections.CONVERSATIONS)
    .where('participantIds', 'array-contains', userId)
    .orderBy('updatedAt', 'desc')
    .get();
  return snapshot.docs.map((doc) => doc.data() as Conversation);
};

export const sendMessage = async (
  conversationId: string,
  senderId: string,
  content: string,
  attachments?: Message['attachments']
): Promise<string> => {
  const messagesRef = firestore()
    .collection(Collections.CONVERSATIONS)
    .doc(conversationId)
    .collection(Collections.MESSAGES);

  const now = firestore.Timestamp.now();
  const docRef = await messagesRef.add({
    conversationId,
    senderId,
    content,
    attachments,
    createdAt: now,
  } as Message);
  await docRef.update({ id: docRef.id });

  // Update conversation's last message
  await getCollection<Conversation>(Collections.CONVERSATIONS)
    .doc(conversationId)
    .update({
      lastMessage: { content, senderId, createdAt: now },
      updatedAt: now,
    });

  return docRef.id;
};

export const subscribeToMessages = (
  conversationId: string,
  callback: (messages: Message[]) => void
): (() => void) => {
  return firestore()
    .collection(Collections.CONVERSATIONS)
    .doc(conversationId)
    .collection(Collections.MESSAGES)
    .orderBy('createdAt', 'asc')
    .onSnapshot((snapshot) => {
      const messages = snapshot.docs.map((doc) => doc.data() as Message);
      callback(messages);
    });
};

// ==================== NOTIFICATION OPERATIONS ====================

export const getUserNotifications = async (
  userId: string,
  limit = 50
): Promise<Notification[]> => {
  const snapshot = await getCollection<Notification>(Collections.NOTIFICATIONS)
    .where('userId', '==', userId)
    .orderBy('createdAt', 'desc')
    .limit(limit)
    .get();
  return snapshot.docs.map((doc) => doc.data() as Notification);
};

export const markNotificationRead = async (
  notificationId: string
): Promise<void> => {
  await getCollection<Notification>(Collections.NOTIFICATIONS)
    .doc(notificationId)
    .update({ isRead: true });
};

export const subscribeToNotifications = (
  userId: string,
  callback: (notifications: Notification[]) => void
): (() => void) => {
  return getCollection<Notification>(Collections.NOTIFICATIONS)
    .where('userId', '==', userId)
    .orderBy('createdAt', 'desc')
    .limit(50)
    .onSnapshot((snapshot) => {
      const notifications = snapshot.docs.map((doc) => doc.data() as Notification);
      callback(notifications);
    });
};

// ==================== QUESTIONNAIRE OPERATIONS ====================

export const getQuestions = async (issueIds: string[]): Promise<Question[]> => {
  if (issueIds.length === 0) return [];

  const snapshot = await getCollection<Question>(Collections.QUESTIONS)
    .where('issueId', 'in', issueIds)
    .orderBy('order')
    .get();
  return snapshot.docs.map((doc) => doc.data() as Question);
};

// ==================== PARTY CONFIG OPERATIONS ====================

export const getPartyConfig = async (): Promise<PartyConfig | null> => {
  const snapshot = await getCollection<PartyConfig>(Collections.PARTY_CONFIG)
    .limit(1)
    .get();
  return snapshot.empty ? null : (snapshot.docs[0].data() as PartyConfig);
};

export const subscribeToPartyConfig = (
  callback: (config: PartyConfig | null) => void
): (() => void) => {
  return getCollection<PartyConfig>(Collections.PARTY_CONFIG)
    .limit(1)
    .onSnapshot((snapshot) => {
      callback(snapshot.empty ? null : (snapshot.docs[0].data() as PartyConfig));
    });
};

// ==================== LEADERBOARD OPERATIONS ====================

export const getEndorsementLeaderboard = async (
  limit = 50
): Promise<LeaderboardEntry[]> => {
  const snapshot = await getCollection<Candidate>(Collections.CANDIDATES)
    .where('status', '==', 'approved')
    .orderBy('endorsementCount', 'desc')
    .limit(limit)
    .get();

  return snapshot.docs.map((doc, index) => {
    const candidate = doc.data() as Candidate;
    return {
      candidateId: candidate.id,
      candidateName: '', // Will be populated from user data
      photoUrl: undefined,
      endorsementCount: candidate.endorsementCount,
      profileViews: candidate.profileViews,
      trendingScore: candidate.trendingScore,
      rank: index + 1,
    };
  });
};

export const getTrendingLeaderboard = async (
  limit = 50
): Promise<LeaderboardEntry[]> => {
  const snapshot = await getCollection<Candidate>(Collections.CANDIDATES)
    .where('status', '==', 'approved')
    .orderBy('trendingScore', 'desc')
    .limit(limit)
    .get();

  return snapshot.docs.map((doc, index) => {
    const candidate = doc.data() as Candidate;
    return {
      candidateId: candidate.id,
      candidateName: '',
      photoUrl: undefined,
      endorsementCount: candidate.endorsementCount,
      profileViews: candidate.profileViews,
      trendingScore: candidate.trendingScore,
      rank: index + 1,
    };
  });
};

// ==================== METRICS OPERATIONS ====================

export const getProfileMetrics = async (
  candidateId: string,
  days = 30
): Promise<ProfileMetrics[]> => {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  const startDateStr = startDate.toISOString().split('T')[0];

  const snapshot = await getCollection<ProfileMetrics>(Collections.PROFILE_METRICS)
    .where('candidateId', '==', candidateId)
    .where('date', '>=', startDateStr)
    .orderBy('date', 'asc')
    .get();
  return snapshot.docs.map((doc) => doc.data() as ProfileMetrics);
};
