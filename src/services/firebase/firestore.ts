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
  Bookmark,
  Conversation,
  Message,
  Notification,
  Question,
  QuestionnaireResponse,
  PartyConfig,
  ProfileMetrics,
  LeaderboardEntry,
  FeedItem,
  ContestRound,
  ContestRoundId,
} from '@/types';

type Timestamp = FirebaseFirestoreTypes.Timestamp;

// Common first names for gender inference
const FEMALE_NAMES = new Set([
  'maya', 'rosa', 'sarah', 'michelle', 'patricia', 'jennifer', 'elizabeth',
  'katherine', 'margaret', 'nancy', 'angela', 'mary', 'linda', 'barbara',
  'susan', 'jessica', 'karen', 'nancy', 'betty', 'helen', 'sandra', 'donna',
  'carol', 'ruth', 'sharon', 'michelle', 'laura', 'sarah', 'kimberly',
  'deborah', 'stephanie', 'rebecca', 'sharon', 'kathleen', 'amy', 'anna',
  'shirley', 'angela', 'brenda', 'pamela', 'emma', 'nicole', 'helen',
  'samantha', 'katherine', 'christine', 'debra', 'rachel', 'carolyn',
  'janet', 'catherine', 'maria', 'heather', 'diane', 'julie', 'olivia',
  'joyce', 'virginia', 'victoria', 'kelly', 'lauren', 'christina', 'joan',
  'evelyn', 'judith', 'megan', 'andrea', 'cheryl', 'hannah', 'jacqueline',
  'martha', 'gloria', 'teresa', 'ann', 'sara', 'madison', 'frances', 'kathryn',
  'janice', 'jean', 'abigail', 'alice', 'judy', 'sophia', 'grace', 'denise',
  'amber', 'doris', 'marilyn', 'danielle', 'beverly', 'isabella', 'theresa',
  'diana', 'natalie', 'brittany', 'charlotte', 'marie', 'kayla', 'alexis', 'lori',
]);

const MALE_NAMES = new Set([
  'marcus', 'james', 'david', 'robert', 'michael', 'william', 'thomas',
  'richard', 'john', 'donald', 'steven', 'christopher', 'joseph', 'charles',
  'daniel', 'matthew', 'anthony', 'mark', 'paul', 'steven', 'andrew', 'joshua',
  'kenneth', 'kevin', 'brian', 'george', 'timothy', 'ronald', 'edward', 'jason',
  'jeffrey', 'ryan', 'jacob', 'gary', 'nicholas', 'eric', 'jonathan', 'stephen',
  'larry', 'justin', 'scott', 'brandon', 'benjamin', 'samuel', 'raymond',
  'gregory', 'frank', 'alexander', 'patrick', 'jack', 'dennis', 'jerry',
  'tyler', 'aaron', 'jose', 'adam', 'nathan', 'henry', 'douglas', 'zachary',
  'peter', 'kyle', 'noah', 'ethan', 'jeremy', 'walter', 'christian', 'keith',
  'roger', 'terry', 'austin', 'sean', 'gerald', 'carl', 'dylan', 'harold',
  'jordan', 'jesse', 'bryan', 'lawrence', 'arthur', 'gabriel', 'bruce', 'albert',
  'willie', 'alan', 'wayne', 'elijah', 'randy', 'roy', 'vincent', 'ralph',
  'eugene', 'russell', 'bobby', 'mason', 'philip', 'louis', 'harry', 'billy',
]);

/**
 * Infers gender from a display name using common first name patterns.
 * Returns undefined if gender cannot be determined.
 */
export const inferGenderFromName = (displayName: string): 'male' | 'female' | undefined => {
  if (!displayName) return undefined;

  // Extract first name and normalize
  const firstName = displayName.split(' ')[0].toLowerCase().trim();

  if (FEMALE_NAMES.has(firstName)) return 'female';
  if (MALE_NAMES.has(firstName)) return 'male';

  return undefined;
};

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
    .onSnapshot(
      (doc) => {
        callback(doc && doc.exists ? (doc.data() as User) : null);
      },
      (error) => {
        console.warn('Error subscribing to user:', error);
        callback(null);
      }
    );
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
  if (!doc.exists) return null;
  return doc.data() as Candidate;
};

export const getCandidateByUserId = async (
  userId: string
): Promise<Candidate | null> => {
  const snapshot = await getCollection<Candidate>(Collections.CANDIDATES)
    .where('userId', '==', userId)
    .limit(1)
    .get();
  if (snapshot.empty) return null;
  return snapshot.docs[0].data() as Candidate;
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
  limit = 50,
  district?: string
): Promise<Candidate[]> => {
  try {
    // Fetch all and filter in memory to avoid composite index
    const snapshot = await getCollection<Candidate>(Collections.CANDIDATES).get();
    const allCandidates = snapshot?.docs?.map((doc) => doc.data() as Candidate) || [];
    console.log('Total candidates in Firestore:', allCandidates.length);

    const approved = allCandidates
      .filter((c) => c.status === 'approved')
      .filter((c) => !district || c.district === district)
      .sort((a, b) => (b.endorsementCount || 0) - (a.endorsementCount || 0))
      .slice(0, limit);

    console.log('Approved candidates:', approved.length);
    return approved;
  } catch (error) {
    console.warn('Error fetching approved candidates:', error);
    return [];
  }
};

// Get candidates with full data for feed generation
export const getCandidatesForFeed = async (district?: string): Promise<Array<{ candidate: Candidate; user: User | null }>> => {
  try {
    const candidates = await getApprovedCandidates(50, district);
    console.log('getApprovedCandidates returned:', candidates.length, 'candidates');

    // Fetch all users in parallel, handling errors individually
    const results = await Promise.all(
      candidates.map(async (candidate) => {
        try {
          const user = await getUser(candidate.userId);
          return { candidate, user };
        } catch (error) {
          console.warn(`Error fetching user for candidate ${candidate.id}:`, error);
          return { candidate, user: null };
        }
      })
    );

    return results;
  } catch (error) {
    console.warn('Error fetching candidates for feed:', error);
    return [];
  }
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

// Get candidates with user display names for leaderboard
export const getCandidatesWithUsers = async (
  sortBy: 'endorsements' | 'trending' = 'endorsements',
  limit = 50,
  district?: string
): Promise<LeaderboardEntry[]> => {
  try {
    // Fetch all candidates to avoid composite index requirement
    const snapshot = await getCollection<Candidate>(Collections.CANDIDATES).get();

    // Filter and sort in memory
    const candidates = (snapshot?.docs?.map((doc) => doc.data() as Candidate) || [])
      .filter((c) => c.status === 'approved')
      .filter((c) => !district || c.district === district)
      .sort((a, b) => {
        if (sortBy === 'endorsements') {
          return (b.endorsementCount || 0) - (a.endorsementCount || 0);
        }
        return (b.trendingScore || 0) - (a.trendingScore || 0);
      })
      .slice(0, limit);

    const entries: LeaderboardEntry[] = [];

    for (let i = 0; i < candidates.length; i++) {
      const candidate = candidates[i];
      // Fetch user data for display name
      const user = await getUser(candidate.userId);
      const displayName = user?.displayName || 'Unknown Candidate';

      // Calculate average spectrum position from top issues
      const topIssues = candidate.topIssues || [];
      const averageSpectrum = topIssues.length > 0
        ? topIssues.reduce((sum, issue) => sum + (issue.spectrumPosition || 0), 0) / topIssues.length
        : 0;

      // Use stored gender or infer from name
      const gender = user?.gender || inferGenderFromName(displayName);

      entries.push({
        candidateId: candidate.id,
        candidateName: displayName,
        photoUrl: user?.photoUrl,
        gender,
        endorsementCount: candidate.endorsementCount || 0,
        profileViews: candidate.profileViews || 0,
        trendingScore: candidate.trendingScore || 0,
        rank: i + 1,
        averageSpectrum: Math.round(averageSpectrum),
      });
    }

    return entries;
  } catch (error) {
    console.warn('Error fetching candidates with users:', error);
    return [];
  }
};

// ==================== CANDIDATE APPLICATION OPERATIONS ====================

export const createCandidateApplication = async (
  data: Omit<CandidateApplication, 'id' | 'submittedAt'>
): Promise<string> => {
  try {
    console.log('createCandidateApplication - Adding document to collection:', Collections.CANDIDATE_APPLICATIONS);
    const docRef = await getCollection<CandidateApplication>(
      Collections.CANDIDATE_APPLICATIONS
    ).add({
      ...data,
      submittedAt: firestore.Timestamp.now(),
    } as CandidateApplication);
    console.log('createCandidateApplication - Document added, updating with id:', docRef.id);
    await docRef.update({ id: docRef.id });
    console.log('createCandidateApplication - Success!');
    return docRef.id;
  } catch (error: any) {
    console.error('createCandidateApplication error:', error.code, error.message);
    throw error;
  }
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
  try {
    // Fetch all PSAs and filter in memory to avoid composite index requirement
    const snapshot = await getCollection<PSA>(Collections.PSAS).get();
    const psas = (snapshot?.docs?.map((doc) => doc.data() as PSA) || [])
      .filter((psa) => psa.candidateId === candidateId)
      .filter((psa) => !status || psa.status === status)
      .sort((a, b) => {
        const aTime = a.createdAt?.toMillis?.() || 0;
        const bTime = b.createdAt?.toMillis?.() || 0;
        return bTime - aTime;
      });
    return psas;
  } catch (error) {
    console.warn('Error fetching candidate PSAs:', error);
    return [];
  }
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
  try {
    // Simple query without composite index requirement
    const snapshot = await getCollection<Issue>(Collections.ISSUES).get();
    const issues = snapshot?.docs?.map((doc) => doc.data() as Issue) || [];
    // Filter and sort in memory
    return issues
      .filter((issue) => issue.isActive)
      .sort((a, b) => a.order - b.order);
  } catch (error) {
    console.warn('Error fetching issues:', error);
    return [];
  }
};

export const getIssuesByCategory = async (category: string): Promise<Issue[]> => {
  const snapshot = await getCollection<Issue>(Collections.ISSUES)
    .where('category', '==', category)
    .where('isActive', '==', true)
    .orderBy('order')
    .get();
  return snapshot.docs.map((doc) => doc.data() as Issue);
};

// Seed issues with sample political topics (for development)
export const seedIssues = async (): Promise<void> => {
  // Use explicit IDs that match what candidates expect
  const issues: Issue[] = [
    { id: 'economy', name: 'Economy & Jobs', description: 'Economic policy, job creation, and workforce development', category: 'Economy', icon: 'currency-usd', order: 1, isActive: true },
    { id: 'taxes', name: 'Tax Policy', description: 'Federal tax rates, tax reform, and fiscal policy', category: 'Economy', icon: 'file-document', order: 2, isActive: true },
    { id: 'minimum-wage', name: 'Minimum Wage', description: 'Federal and state minimum wage policies', category: 'Economy', icon: 'cash', order: 3, isActive: true },
    { id: 'healthcare', name: 'Healthcare', description: 'Healthcare access, affordability, and reform', category: 'Healthcare', icon: 'hospital', order: 4, isActive: true },
    { id: 'medicare', name: 'Medicare & Medicaid', description: 'Government healthcare programs', category: 'Healthcare', icon: 'medical-bag', order: 5, isActive: true },
    { id: 'prescription-drugs', name: 'Prescription Drug Prices', description: 'Regulation and pricing of pharmaceutical drugs', category: 'Healthcare', icon: 'pill', order: 6, isActive: true },
    { id: 'education', name: 'Education', description: 'K-12 education policy and school funding', category: 'Education', icon: 'school', order: 7, isActive: true },
    { id: 'higher-education', name: 'Higher Education', description: 'College affordability and student loan policy', category: 'Education', icon: 'account-school', order: 8, isActive: true },
    { id: 'climate-change', name: 'Climate Change', description: 'Climate policy and environmental protection', category: 'Environment', icon: 'earth', order: 9, isActive: true },
    { id: 'clean-energy', name: 'Clean Energy', description: 'Renewable energy and reducing fossil fuel dependence', category: 'Environment', icon: 'solar-power', order: 10, isActive: true },
    { id: 'immigration', name: 'Immigration', description: 'Immigration policy and border security', category: 'Immigration', icon: 'passport', order: 11, isActive: true },
    { id: 'path-to-citizenship', name: 'Path to Citizenship', description: 'Policies for undocumented immigrants', category: 'Immigration', icon: 'card-account-details', order: 12, isActive: true },
    { id: 'civil-rights', name: 'Civil Rights', description: 'Equal rights and anti-discrimination policies', category: 'Civil Rights', icon: 'scale-balance', order: 13, isActive: true },
    { id: 'voting-rights', name: 'Voting Rights', description: 'Election access and voting protections', category: 'Civil Rights', icon: 'vote', order: 14, isActive: true },
    { id: 'criminal-justice', name: 'Criminal Justice Reform', description: 'Police reform, sentencing, and prison policy', category: 'Civil Rights', icon: 'gavel', order: 15, isActive: true },
    { id: 'foreign-policy', name: 'Foreign Policy', description: 'International relations and diplomacy', category: 'Foreign Policy', icon: 'earth', order: 16, isActive: true },
    { id: 'defense', name: 'National Defense', description: 'Military spending and national security', category: 'Foreign Policy', icon: 'shield', order: 17, isActive: true },
    { id: 'gun-policy', name: 'Gun Policy', description: 'Second Amendment rights and gun safety regulations', category: 'Social Issues', icon: 'pistol', order: 18, isActive: true },
    { id: 'abortion', name: 'Reproductive Rights', description: 'Abortion access and reproductive healthcare', category: 'Social Issues', icon: 'human-pregnant', order: 19, isActive: true },
    { id: 'lgbtq-rights', name: 'LGBTQ+ Rights', description: 'Equal rights and protections for LGBTQ+ individuals', category: 'Social Issues', icon: 'rainbow', order: 20, isActive: true },
    { id: 'infrastructure', name: 'Infrastructure', description: 'Roads, bridges, and public works investment', category: 'Infrastructure', icon: 'bridge', order: 21, isActive: true },
    { id: 'housing', name: 'Housing', description: 'Affordable housing and homelessness', category: 'Infrastructure', icon: 'home', order: 22, isActive: true },
    // PLAN-10C: New MC quiz issues
    { id: 'trade', name: 'Trade Policy', description: 'Tariffs, free trade, and international commerce', category: 'Economy', icon: 'swap-horizontal', order: 23, isActive: true },
    { id: 'iran', name: 'Iran Policy', description: 'US foreign policy toward Iran', category: 'Foreign Policy', icon: 'earth', order: 24, isActive: true },
    { id: 'inflation', name: 'Cost of Living', description: 'Inflation, cost of living, and economic relief', category: 'Economy', icon: 'chart-line', order: 25, isActive: true },
    { id: 'borders', name: 'Border Policy', description: 'Immigration enforcement and border security', category: 'Immigration', icon: 'gate', order: 26, isActive: true },
    { id: 'welfare', name: 'Social Safety Net', description: 'Social Security, Medicare, and Medicaid reform', category: 'Healthcare', icon: 'shield-account', order: 27, isActive: true },
    { id: 'pa01-infrastructure', name: 'PA-01 Infrastructure', description: 'Flood mitigation and stormwater projects in PA-01', category: 'Infrastructure', icon: 'water', order: 28, isActive: true },
    { id: 'pa01-housing', name: 'PA-01 Housing Standards', description: 'Environmental and preservation standards for new homes in PA-01', category: 'Infrastructure', icon: 'home-city', order: 29, isActive: true },
    { id: 'pa02-budget', name: 'PA-02 Violence Prevention', description: 'Violence prevention grant funding in PA-02', category: 'Civil Rights', icon: 'cash-check', order: 30, isActive: true },
    { id: 'pa02-transit', name: 'PA-02 Light Rail', description: 'Federal funding for light rail safety in PA-02', category: 'Infrastructure', icon: 'train', order: 31, isActive: true },
  ];

  const batch = firestore().batch();

  for (const issue of issues) {
    const docRef = getCollection<Issue>(Collections.ISSUES).doc(issue.id);
    batch.set(docRef, issue);
  }

  await batch.commit();
  console.log('Issues seeded successfully!');
};

// Seed questionnaire questions — PLAN-10C multiple-choice format
export const seedQuestions = async (): Promise<void> => {
  const questions: Question[] = [
    {
      id: 'trade-1',
      issueId: 'trade',
      text: 'What tariff policy should apply to foreign goods?',
      type: 'single_choice',
      scope: 'global',
      isActive: true,
      editorialStatus: 'approved',
      options: [
        { id: 'trade-1-a', text: 'Eliminate most tariffs and pursue broad free-trade agreements to lower consumer prices', shortLabel: 'Free Trade', spectrumValue: -80, value: -80 },
        { id: 'trade-1-b', text: 'Keep moderate tariffs on strategic sectors while negotiating targeted trade deals', shortLabel: 'Limited Trade', spectrumValue: 0, value: 0 },
        { id: 'trade-1-c', text: 'Impose higher tariffs on imports to protect domestic industries and jobs', shortLabel: 'Protection', spectrumValue: 80, value: 80 },
      ],
      order: 1,
      isRequired: true,
    },
    {
      id: 'iran-1',
      issueId: 'iran',
      text: 'What policy do you support with respect to Iran?',
      type: 'single_choice',
      scope: 'global',
      isActive: true,
      editorialStatus: 'approved',
      options: [
        { id: 'iran-1-a', text: 'Increase sanctions and military pressure to prevent Iran from obtaining nuclear weapons', shortLabel: 'Escalation', spectrumValue: 80, value: 80 },
        { id: 'iran-1-b', text: 'Pursue diplomatic engagement with limited sanctions to encourage cooperation', shortLabel: 'Limited Response', spectrumValue: 0, value: 0 },
        { id: 'iran-1-c', text: 'Withdraw from the region and avoid military or economic involvement with Iran', shortLabel: 'No Involvement', spectrumValue: -80, value: -80 },
      ],
      order: 2,
      isRequired: true,
    },
    {
      id: 'inflation-1',
      issueId: 'inflation',
      text: 'What policy focus best eases the cost of living?',
      type: 'single_choice',
      scope: 'national',
      isActive: true,
      editorialStatus: 'approved',
      options: [
        { id: 'inflation-1-a', text: 'Strengthen regulations on pricing and corporate profits to protect consumers', shortLabel: 'Regulation', spectrumValue: -70, value: -70 },
        { id: 'inflation-1-b', text: 'Invest in domestic production and supply chains to bring costs down naturally', shortLabel: 'Strengthen Production', spectrumValue: 0, value: 0 },
        { id: 'inflation-1-c', text: 'Cut government spending and reduce the deficit to curb inflation', shortLabel: 'Fiscal Policy', spectrumValue: 70, value: 70 },
      ],
      order: 3,
      isRequired: true,
    },
    {
      id: 'borders-1',
      issueId: 'borders',
      text: 'How should undocumented immigrants and asylum seekers be treated?',
      type: 'single_choice',
      scope: 'national',
      isActive: true,
      editorialStatus: 'approved',
      options: [
        { id: 'borders-1-a', text: 'Create more legal pathways for immigration and provide a path to citizenship', shortLabel: 'Open', spectrumValue: -80, value: -80 },
        { id: 'borders-1-b', text: 'Process asylum claims fairly while maintaining border security', shortLabel: 'Partially Close', spectrumValue: 0, value: 0 },
        { id: 'borders-1-c', text: 'Strengthen border enforcement and increase deportations of undocumented immigrants', shortLabel: 'Close', spectrumValue: 80, value: 80 },
      ],
      order: 4,
      isRequired: true,
    },
    {
      id: 'welfare-1',
      issueId: 'welfare',
      text: 'What policy focus should guide Social Security & Medicare/Medicaid reform?',
      type: 'single_choice',
      scope: 'national',
      isActive: true,
      editorialStatus: 'approved',
      options: [
        { id: 'welfare-1-a', text: 'Expand benefits and fund through higher taxes on wealthy individuals and corporations', shortLabel: 'Socialize', spectrumValue: -80, value: -80 },
        { id: 'welfare-1-b', text: 'Maintain current benefit levels and make targeted adjustments for sustainability', shortLabel: 'Maintain', spectrumValue: 0, value: 0 },
        { id: 'welfare-1-c', text: 'Transition toward private accounts and market-based alternatives', shortLabel: 'Privatize', spectrumValue: 80, value: 80 },
      ],
      order: 5,
      isRequired: true,
    },
    {
      id: 'pa01-infrastructure-1',
      issueId: 'pa01-infrastructure',
      text: 'Should federal funding cover flood mitigation and stormwater projects?',
      type: 'single_choice',
      scope: 'local',
      districtFilter: ['PA-01'],
      isActive: true,
      editorialStatus: 'approved',
      options: [
        { id: 'pa01-infra-1-a', text: 'Yes, federal investment in flood mitigation protects communities and saves money long-term', shortLabel: 'Yes', spectrumValue: -50, value: -50 },
        { id: 'pa01-infra-1-b', text: 'No, stormwater projects should be funded locally or by the state', shortLabel: 'No', spectrumValue: 50, value: 50 },
      ],
      order: 6,
      isRequired: true,
    },
    {
      id: 'pa01-housing-1',
      issueId: 'pa01-housing',
      text: 'Should new homes meet stricter environmental and preservation standards?',
      type: 'single_choice',
      scope: 'local',
      districtFilter: ['PA-01'],
      isActive: true,
      editorialStatus: 'approved',
      options: [
        { id: 'pa01-housing-1-a', text: 'Yes, stricter standards protect the environment and community character', shortLabel: 'Yes', spectrumValue: -50, value: -50 },
        { id: 'pa01-housing-1-b', text: 'No, stricter standards increase costs and slow needed housing construction', shortLabel: 'No', spectrumValue: 50, value: 50 },
      ],
      order: 7,
      isRequired: true,
    },
    {
      id: 'pa02-budget-1',
      issueId: 'pa02-budget',
      text: 'Should grants for violence prevention require partner contributions?',
      type: 'single_choice',
      scope: 'local',
      districtFilter: ['PA-02'],
      isActive: true,
      editorialStatus: 'approved',
      options: [
        { id: 'pa02-budget-1-a', text: 'Yes, requiring partner contributions ensures accountability and shared investment', shortLabel: 'Yes', spectrumValue: 50, value: 50 },
        { id: 'pa02-budget-1-b', text: 'No, matching requirements exclude under-resourced communities that need help most', shortLabel: 'No', spectrumValue: -50, value: -50 },
      ],
      order: 6,
      isRequired: true,
    },
    {
      id: 'pa02-transit-1',
      issueId: 'pa02-transit',
      text: 'Should the federal government fund safety improvements for light rail?',
      type: 'single_choice',
      scope: 'local',
      districtFilter: ['PA-02'],
      isActive: true,
      editorialStatus: 'approved',
      options: [
        { id: 'pa02-transit-1-a', text: 'Yes, federal funding for transit safety benefits riders and reduces accidents', shortLabel: 'Yes', spectrumValue: -50, value: -50 },
        { id: 'pa02-transit-1-b', text: 'No, local transit safety should be funded by local and state governments', shortLabel: 'No', spectrumValue: 50, value: 50 },
      ],
      order: 7,
      isRequired: true,
    },
  ];

  const batch = firestore().batch();

  for (const question of questions) {
    const docRef = getCollection<Question>(Collections.QUESTIONS).doc(question.id);
    batch.set(docRef, question);
  }

  await batch.commit();
  console.log(`Seeded ${questions.length} questions successfully!`);
};

// Seed quiz config — maps districts to their question sets
export const seedQuizConfig = async (): Promise<void> => {
  const batch = firestore().batch();

  const pa01Ref = firestore().collection(Collections.QUIZ_CONFIG).doc('PA-01');
  batch.set(pa01Ref, {
    questionIds: ['trade-1', 'iran-1', 'inflation-1', 'borders-1', 'welfare-1', 'pa01-infrastructure-1', 'pa01-housing-1'],
    version: 1,
    updatedAt: firestore.Timestamp.now(),
  });

  const pa02Ref = firestore().collection(Collections.QUIZ_CONFIG).doc('PA-02');
  batch.set(pa02Ref, {
    questionIds: ['trade-1', 'iran-1', 'inflation-1', 'borders-1', 'welfare-1', 'pa02-budget-1', 'pa02-transit-1'],
    version: 1,
    updatedAt: firestore.Timestamp.now(),
  });

  await batch.commit();
  console.log('Quiz config seeded successfully!');
};

// PLAN-10E: Removed position templates and generation code (~440 lines).
// Matching is now purely quiz-based via questionnaireResponses.
// See git history for the old 5-leaning × 31-issue template system.

// Seed candidates with sample politicians (for development)
export const seedCandidates = async (): Promise<void> => {
  const candidates: Array<{
    displayName: string;
    email: string;
    gender: 'male' | 'female';
    bio: any;
    reasonForRunning: string;
    topIssues: any[];
  }> = [
    // Progressive candidates (-80 to -100 spectrum)
    {
      displayName: 'Maya Chen',
      email: 'maya.chen@example.com',
      gender: 'female',
      bio: {
        summary: 'Environmental justice advocate and former community organizer fighting for a Green New Deal.',
        background: 'Born to immigrant parents in Oakland, Maya spent 15 years organizing communities around climate and housing justice.',
        education: [{ institution: 'UC Berkeley', degree: 'Environmental Science', year: 2008 }],
        experience: [{ title: 'Executive Director', organization: 'Climate Justice Now', startYear: 2015, description: 'Led campaigns for renewable energy investment' }],
        achievements: ['Passed local Green New Deal resolution', 'Organized 50,000-person climate march'],
      },
      reasonForRunning: 'To ensure a livable planet for future generations and economic justice for working families.',
      topIssues: [
        { issueId: 'climate-change', position: 'Aggressive action needed - full transition to renewables by 2035', priority: 1, spectrumPosition: -95 },
        { issueId: 'healthcare', position: 'Medicare for All - single payer universal healthcare', priority: 2, spectrumPosition: -90 },
        { issueId: 'minimum-wage', position: '$25/hour federal minimum wage indexed to inflation', priority: 3, spectrumPosition: -85 },
      ],
    },
    {
      displayName: 'Marcus Washington',
      email: 'marcus.washington@example.com',
      gender: 'male',
      bio: {
        summary: 'Civil rights attorney dedicated to criminal justice reform and ending mass incarceration.',
        background: 'Public defender for 12 years, witnessed firsthand the inequities in our justice system.',
        education: [{ institution: 'Howard University', degree: 'JD', year: 2010 }],
        experience: [{ title: 'Senior Public Defender', organization: 'Philadelphia Public Defender', startYear: 2010, description: 'Defended over 1,000 clients' }],
        achievements: ['Won landmark police accountability case', 'Founded innocence project chapter'],
      },
      reasonForRunning: 'To transform our criminal justice system and invest in communities, not prisons.',
      topIssues: [
        { issueId: 'criminal-justice', position: 'End cash bail, abolish private prisons, decriminalize drugs', priority: 1, spectrumPosition: -92 },
        { issueId: 'civil-rights', position: 'Reparations study, federal anti-discrimination enforcement', priority: 2, spectrumPosition: -88 },
        { issueId: 'education', position: 'Free public college, cancel student debt', priority: 3, spectrumPosition: -85 },
      ],
    },
    {
      displayName: 'Rosa Martinez',
      email: 'rosa.martinez@example.com',
      gender: 'female',
      bio: {
        summary: 'Labor organizer fighting for workers rights and immigrant justice.',
        background: 'Daughter of farmworkers, organized hotel workers union for 10 years.',
        education: [{ institution: 'UCLA', degree: 'Labor Studies', year: 2012 }],
        experience: [{ title: 'Lead Organizer', organization: 'UNITE HERE', startYear: 2012, description: 'Organized 15,000 hospitality workers' }],
        achievements: ['Won $15 minimum wage in 3 cities', 'Secured healthcare for gig workers'],
      },
      reasonForRunning: 'To give working people a voice and create an economy that works for everyone.',
      topIssues: [
        { issueId: 'minimum-wage', position: 'Living wage for all workers, strengthen union rights', priority: 1, spectrumPosition: -90 },
        { issueId: 'immigration', position: 'Path to citizenship, abolish ICE, welcome refugees', priority: 2, spectrumPosition: -88 },
        { issueId: 'healthcare', position: 'Healthcare is a human right - Medicare for All', priority: 3, spectrumPosition: -85 },
      ],
    },

    // Moderately progressive candidates (-40 to -65 spectrum)
    {
      displayName: 'James O\'Brien',
      email: 'james.obrien@example.com',
      gender: 'male',
      bio: {
        summary: 'Former teacher and school board president focused on education equity.',
        background: 'Taught in public schools for 20 years before entering politics.',
        education: [{ institution: 'Boston College', degree: 'Education', year: 1998 }],
        experience: [{ title: 'School Board President', organization: 'Boston Public Schools', startYear: 2018, description: 'Increased funding equity across districts' }],
        achievements: ['Reduced achievement gap by 15%', 'Expanded pre-K access'],
      },
      reasonForRunning: 'Every child deserves a quality education regardless of zip code.',
      topIssues: [
        { issueId: 'education', position: 'Increase federal funding, reduce class sizes, pay teachers more', priority: 1, spectrumPosition: -60 },
        { issueId: 'higher-education', position: 'Debt-free community college, income-based repayment', priority: 2, spectrumPosition: -55 },
        { issueId: 'economy', position: 'Invest in job training and infrastructure', priority: 3, spectrumPosition: -45 },
      ],
    },
    {
      displayName: 'Sarah Kim',
      gender: 'female',
      email: 'sarah.kim@example.com',
      bio: {
        summary: 'Healthcare administrator working to expand access and lower costs.',
        background: 'Ran community health centers serving 50,000 patients annually.',
        education: [{ institution: 'Johns Hopkins', degree: 'Public Health', year: 2006 }],
        experience: [{ title: 'CEO', organization: 'Community Health Network', startYear: 2014, description: 'Expanded services to 12 underserved communities' }],
        achievements: ['Reduced ER visits by 30%', 'Pioneered telehealth programs'],
      },
      reasonForRunning: 'To make healthcare affordable and accessible for every American.',
      topIssues: [
        { issueId: 'healthcare', position: 'Public option, strengthen ACA, negotiate drug prices', priority: 1, spectrumPosition: -55 },
        { issueId: 'prescription-drugs', position: 'Allow Medicare to negotiate, import from Canada', priority: 2, spectrumPosition: -60 },
        { issueId: 'medicare', position: 'Lower Medicare age to 55, expand benefits', priority: 3, spectrumPosition: -50 },
      ],
    },
    {
      displayName: 'David Thompson',
      gender: 'male',
      email: 'david.thompson@example.com',
      bio: {
        summary: 'Environmental engineer promoting practical clean energy solutions.',
        background: 'Built renewable energy projects across 15 states.',
        education: [{ institution: 'MIT', degree: 'Engineering', year: 2004 }],
        experience: [{ title: 'Founder', organization: 'GreenTech Solutions', startYear: 2010, description: 'Deployed 500MW of solar capacity' }],
        achievements: ['Created 2,000 clean energy jobs', 'Reduced costs 40%'],
      },
      reasonForRunning: 'To accelerate the clean energy transition while creating good jobs.',
      topIssues: [
        { issueId: 'clean-energy', position: 'Tax incentives for renewables, modernize grid', priority: 1, spectrumPosition: -50 },
        { issueId: 'climate-change', position: 'Net-zero by 2050, invest in innovation', priority: 2, spectrumPosition: -55 },
        { issueId: 'infrastructure', position: 'Major investment in green infrastructure', priority: 3, spectrumPosition: -45 },
      ],
    },
    {
      displayName: 'Michelle Foster',
      gender: 'female',
      email: 'michelle.foster@example.com',
      bio: {
        summary: 'Former prosecutor focused on smart justice reform and community safety.',
        background: 'Prosecuted violent crimes while advocating for rehabilitation programs.',
        education: [{ institution: 'Georgetown Law', degree: 'JD', year: 2007 }],
        experience: [{ title: 'Assistant DA', organization: 'District Attorney Office', startYear: 2007, description: 'Led conviction integrity unit' }],
        achievements: ['Launched diversion programs', 'Reduced recidivism 25%'],
      },
      reasonForRunning: 'To build safer communities through smart, fair justice policies.',
      topIssues: [
        { issueId: 'criminal-justice', position: 'Reform sentencing, expand rehabilitation, community policing', priority: 1, spectrumPosition: -45 },
        { issueId: 'gun-policy', position: 'Universal background checks, red flag laws', priority: 2, spectrumPosition: -55 },
        { issueId: 'civil-rights', position: 'Strengthen voting rights, protect civil liberties', priority: 3, spectrumPosition: -50 },
      ],
    },

    // Centrist candidates (-20 to +20 spectrum)
    {
      displayName: 'Robert Anderson',
      gender: 'male',
      email: 'robert.anderson@example.com',
      bio: {
        summary: 'Business owner and former mayor focused on pragmatic, bipartisan solutions.',
        background: 'Built successful manufacturing company, served two terms as mayor.',
        education: [{ institution: 'University of Michigan', degree: 'Business', year: 1995 }],
        experience: [{ title: 'Mayor', organization: 'City of Grand Rapids', startYear: 2016, description: 'Balanced budget while improving services' }],
        achievements: ['Attracted $500M in investment', 'Bipartisan infrastructure plan'],
      },
      reasonForRunning: 'To bring common-sense leadership and end partisan gridlock.',
      topIssues: [
        { issueId: 'economy', position: 'Pro-business policies balanced with worker protections', priority: 1, spectrumPosition: 5 },
        { issueId: 'infrastructure', position: 'Bipartisan infrastructure investment', priority: 2, spectrumPosition: -10 },
        { issueId: 'taxes', position: 'Simplify tax code, modest middle-class cuts', priority: 3, spectrumPosition: 15 },
      ],
    },
    {
      displayName: 'Patricia Williams',
      gender: 'female',
      email: 'patricia.williams@example.com',
      bio: {
        summary: 'Retired military officer committed to strong defense and diplomatic engagement.',
        background: '25 years in the Army, served in multiple peacekeeping missions.',
        education: [{ institution: 'West Point', degree: 'Military Science', year: 1992 }],
        experience: [{ title: 'Colonel', organization: 'US Army', startYear: 1992, endYear: 2017, description: 'Commanded 3,000 troops' }],
        achievements: ['Bronze Star recipient', 'Led successful humanitarian missions'],
      },
      reasonForRunning: 'To keep America safe while pursuing smart diplomacy.',
      topIssues: [
        { issueId: 'defense', position: 'Strong military, strategic alliances, smart spending', priority: 1, spectrumPosition: 10 },
        { issueId: 'foreign-policy', position: 'Engaged diplomacy, support allies, deter adversaries', priority: 2, spectrumPosition: 5 },
        { issueId: 'immigration', position: 'Secure borders with humane, orderly legal process', priority: 3, spectrumPosition: 0 },
      ],
    },
    {
      displayName: 'Michael Chen',
      gender: 'male',
      email: 'michael.chen@example.com',
      bio: {
        summary: 'Tech entrepreneur promoting innovation and economic opportunity.',
        background: 'Founded two successful startups, created 500 jobs.',
        education: [{ institution: 'Stanford', degree: 'Computer Science', year: 2005 }],
        experience: [{ title: 'CEO', organization: 'TechForward Inc', startYear: 2010, description: 'Built company to $100M valuation' }],
        achievements: ['Forbes 30 Under 30', 'Founded coding bootcamp for underserved youth'],
      },
      reasonForRunning: 'To ensure America leads in innovation while sharing prosperity.',
      topIssues: [
        { issueId: 'economy', position: 'Support entrepreneurship, reduce red tape, invest in R&D', priority: 1, spectrumPosition: 15 },
        { issueId: 'education', position: 'STEM education, vocational training, school choice pilots', priority: 2, spectrumPosition: 10 },
        { issueId: 'higher-education', position: 'Expand Pell grants, employer partnerships', priority: 3, spectrumPosition: 0 },
      ],
    },
    {
      displayName: 'Jennifer Brooks',
      gender: 'female',
      email: 'jennifer.brooks@example.com',
      bio: {
        summary: 'Nonprofit leader bridging divides on housing and community development.',
        background: 'Led Habitat for Humanity chapter, built 500 homes.',
        education: [{ institution: 'Notre Dame', degree: 'Social Work', year: 2003 }],
        experience: [{ title: 'Executive Director', organization: 'Habitat for Humanity', startYear: 2010, description: 'Tripled home production' }],
        achievements: ['National nonprofit leader of the year', 'Bipartisan housing coalition'],
      },
      reasonForRunning: 'To make homeownership achievable and strengthen communities.',
      topIssues: [
        { issueId: 'housing', position: 'Incentivize construction, public-private partnerships', priority: 1, spectrumPosition: -15 },
        { issueId: 'infrastructure', position: 'Invest in community infrastructure and broadband', priority: 2, spectrumPosition: -10 },
        { issueId: 'economy', position: 'Support small businesses, workforce development', priority: 3, spectrumPosition: 5 },
      ],
    },
    {
      displayName: 'Christopher Davis',
      gender: 'male',
      email: 'christopher.davis@example.com',
      bio: {
        summary: 'Farmer and rural advocate fighting for agricultural communities.',
        background: 'Third-generation farmer, led state farm bureau.',
        education: [{ institution: 'Iowa State', degree: 'Agriculture', year: 2000 }],
        experience: [{ title: 'President', organization: 'State Farm Bureau', startYear: 2015, description: 'Advocated for 50,000 farmers' }],
        achievements: ['Expanded broadband to rural areas', 'Trade deal improvements'],
      },
      reasonForRunning: 'To ensure rural America is not forgotten and farmers can thrive.',
      topIssues: [
        { issueId: 'economy', position: 'Fair trade deals, support family farms', priority: 1, spectrumPosition: 10 },
        { issueId: 'infrastructure', position: 'Rural broadband, roads, and bridges', priority: 2, spectrumPosition: 0 },
        { issueId: 'clean-energy', position: 'Biofuels, wind energy on farmland', priority: 3, spectrumPosition: -5 },
      ],
    },

    // Moderately conservative candidates (+40 to +65 spectrum)
    {
      displayName: 'William Turner',
      gender: 'male',
      email: 'william.turner@example.com',
      bio: {
        summary: 'Small business owner advocating for lower taxes and less regulation.',
        background: 'Built chain of hardware stores across three states.',
        education: [{ institution: 'Texas A&M', degree: 'Business', year: 1990 }],
        experience: [{ title: 'Owner', organization: 'Turner Hardware', startYear: 1995, description: 'Grew to 25 locations, 400 employees' }],
        achievements: ['Small Business of the Year', 'Chamber of Commerce president'],
      },
      reasonForRunning: 'To get government out of the way so businesses can create jobs.',
      topIssues: [
        { issueId: 'taxes', position: 'Cut taxes for small businesses and families', priority: 1, spectrumPosition: 60 },
        { issueId: 'economy', position: 'Reduce regulations, support free enterprise', priority: 2, spectrumPosition: 55 },
        { issueId: 'healthcare', position: 'Market-based solutions, health savings accounts', priority: 3, spectrumPosition: 50 },
      ],
    },
    {
      displayName: 'Elizabeth Morgan',
      gender: 'female',
      email: 'elizabeth.morgan@example.com',
      bio: {
        summary: 'Former school principal promoting parental choice and educational excellence.',
        background: 'Led turnaround of failing schools, champion of charter schools.',
        education: [{ institution: 'Vanderbilt', degree: 'Education Leadership', year: 1998 }],
        experience: [{ title: 'Principal', organization: 'Success Academy', startYear: 2005, description: 'Improved test scores 40%' }],
        achievements: ['Principal of the Year', 'Launched STEM magnet program'],
      },
      reasonForRunning: 'To empower parents and give every child access to excellent education.',
      topIssues: [
        { issueId: 'education', position: 'School choice, charter schools, parental rights', priority: 1, spectrumPosition: 55 },
        { issueId: 'higher-education', position: 'Vocational alternatives, reduce college costs', priority: 2, spectrumPosition: 45 },
        { issueId: 'taxes', position: 'Education tax credits for families', priority: 3, spectrumPosition: 50 },
      ],
    },
    {
      displayName: 'Thomas Wright',
      gender: 'male',
      email: 'thomas.wright@example.com',
      bio: {
        summary: 'Sheriff focused on law and order and supporting police officers.',
        background: '30 years in law enforcement, elected sheriff twice.',
        education: [{ institution: 'Sam Houston State', degree: 'Criminal Justice', year: 1990 }],
        experience: [{ title: 'Sheriff', organization: 'County Sheriff Department', startYear: 2012, description: 'Reduced crime 20%' }],
        achievements: ['Officer of the Year', 'Implemented community policing'],
      },
      reasonForRunning: 'To restore law and order and support the men and women in blue.',
      topIssues: [
        { issueId: 'criminal-justice', position: 'Back the blue, tough on crime, victims rights', priority: 1, spectrumPosition: 60 },
        { issueId: 'immigration', position: 'Secure border, enforce laws, merit-based system', priority: 2, spectrumPosition: 55 },
        { issueId: 'gun-policy', position: 'Protect Second Amendment, enforce existing laws', priority: 3, spectrumPosition: 65 },
      ],
    },
    {
      displayName: 'Katherine Hayes',
      gender: 'female',
      email: 'katherine.hayes@example.com',
      bio: {
        summary: 'Healthcare executive promoting patient-centered, market-based reforms.',
        background: 'Led hospital system, reduced costs while improving care.',
        education: [{ institution: 'Duke', degree: 'Healthcare Administration', year: 2002 }],
        experience: [{ title: 'CEO', organization: 'Regional Medical Center', startYear: 2012, description: 'Improved quality rankings' }],
        achievements: ['Top 100 hospitals', 'Pioneered price transparency'],
      },
      reasonForRunning: 'To fix healthcare through competition and innovation, not government control.',
      topIssues: [
        { issueId: 'healthcare', position: 'Market competition, price transparency, HSAs', priority: 1, spectrumPosition: 55 },
        { issueId: 'prescription-drugs', position: 'Competition and transparency over price controls', priority: 2, spectrumPosition: 45 },
        { issueId: 'medicare', position: 'Protect Medicare, add private options', priority: 3, spectrumPosition: 50 },
      ],
    },
    {
      displayName: 'Richard Palmer',
      gender: 'male',
      email: 'richard.palmer@example.com',
      bio: {
        summary: 'Energy executive promoting American energy independence.',
        background: 'Led diversified energy company across oil, gas, and renewables.',
        education: [{ institution: 'Texas Tech', degree: 'Petroleum Engineering', year: 1988 }],
        experience: [{ title: 'CEO', organization: 'Palmer Energy', startYear: 2005, description: 'Managed 5,000 employees' }],
        achievements: ['Increased domestic production', 'Invested in carbon capture'],
      },
      reasonForRunning: 'To achieve energy independence and keep prices low for families.',
      topIssues: [
        { issueId: 'clean-energy', position: 'All-of-the-above energy, including oil and gas', priority: 1, spectrumPosition: 55 },
        { issueId: 'climate-change', position: 'Innovation over regulation, natural gas bridge', priority: 2, spectrumPosition: 45 },
        { issueId: 'economy', position: 'Energy jobs, manufacturing renaissance', priority: 3, spectrumPosition: 50 },
      ],
    },

    // Strongly conservative candidates (+80 to +100 spectrum)
    {
      displayName: 'John Mitchell',
      gender: 'male',
      email: 'john.mitchell@example.com',
      bio: {
        summary: 'Constitutional conservative fighting to limit government and protect liberty.',
        background: 'Constitutional lawyer, argued cases before Supreme Court.',
        education: [{ institution: 'Yale Law', degree: 'JD', year: 1995 }],
        experience: [{ title: 'Senior Counsel', organization: 'Liberty Legal Foundation', startYear: 2000, description: 'Defended constitutional rights' }],
        achievements: ['Won religious liberty cases', 'State legislator'],
      },
      reasonForRunning: 'To restore constitutional government and protect individual liberty.',
      topIssues: [
        { issueId: 'taxes', position: 'Flat tax, dramatically reduce federal spending', priority: 1, spectrumPosition: 90 },
        { issueId: 'gun-policy', position: 'Absolute Second Amendment rights, constitutional carry', priority: 2, spectrumPosition: 95 },
        { issueId: 'civil-rights', position: 'Religious liberty, limited federal power', priority: 3, spectrumPosition: 85 },
      ],
    },
    {
      displayName: 'Margaret Sullivan',
      gender: 'female',
      email: 'margaret.sullivan@example.com',
      bio: {
        summary: 'Pro-life advocate and family values champion.',
        background: 'Founded crisis pregnancy center network.',
        education: [{ institution: 'Liberty University', degree: 'Public Policy', year: 2000 }],
        experience: [{ title: 'President', organization: 'Family First Foundation', startYear: 2005, description: 'Built 50 centers nationwide' }],
        achievements: ['Helped 10,000 women choose life', 'Family policy advisor'],
      },
      reasonForRunning: 'To protect the unborn and strengthen American families.',
      topIssues: [
        { issueId: 'abortion', position: 'Pro-life, support heartbeat bills, defund Planned Parenthood', priority: 1, spectrumPosition: 95 },
        { issueId: 'education', position: 'Parental rights, homeschool freedom, no CRT', priority: 2, spectrumPosition: 85 },
        { issueId: 'lgbtq-rights', position: 'Traditional marriage, religious exemptions, parental consent', priority: 3, spectrumPosition: 90 },
      ],
    },
    {
      displayName: 'James Richardson',
      gender: 'male',
      email: 'james.richardson@example.com',
      bio: {
        summary: 'Border hawk and immigration enforcement advocate.',
        background: 'Former Border Patrol agent, 20 years on the front lines.',
        education: [{ institution: 'University of Arizona', degree: 'Criminal Justice', year: 1998 }],
        experience: [{ title: 'Sector Chief', organization: 'Border Patrol', startYear: 1998, endYear: 2018, description: 'Led 2,000 agents' }],
        achievements: ['Record drug seizures', 'Anti-trafficking task force'],
      },
      reasonForRunning: 'To finally secure our border and enforce our immigration laws.',
      topIssues: [
        { issueId: 'immigration', position: 'Build the wall, end catch-and-release, no amnesty', priority: 1, spectrumPosition: 95 },
        { issueId: 'criminal-justice', position: 'Tough on crime, mandatory minimums, death penalty', priority: 2, spectrumPosition: 85 },
        { issueId: 'defense', position: 'Rebuild military, peace through strength', priority: 3, spectrumPosition: 80 },
      ],
    },
    {
      displayName: 'Donald Peterson',
      gender: 'male',
      email: 'donald.peterson@example.com',
      bio: {
        summary: 'Fiscal conservative demanding balanced budgets and spending cuts.',
        background: 'Accountant and budget watchdog, exposed government waste.',
        education: [{ institution: 'BYU', degree: 'Accounting', year: 1992 }],
        experience: [{ title: 'Director', organization: 'Citizens Against Government Waste', startYear: 2005, description: 'Identified $500B in waste' }],
        achievements: ['Balanced budget amendment advocate', 'State budget reform'],
      },
      reasonForRunning: 'To stop the runaway spending and save future generations from debt.',
      topIssues: [
        { issueId: 'taxes', position: 'No new taxes, cut spending, balanced budget amendment', priority: 1, spectrumPosition: 90 },
        { issueId: 'medicare', position: 'Reform entitlements, premium support, raise retirement age', priority: 2, spectrumPosition: 80 },
        { issueId: 'economy', position: 'Free market, end corporate welfare, deregulate', priority: 3, spectrumPosition: 85 },
      ],
    },
    {
      displayName: 'Nancy Crawford',
      gender: 'female',
      email: 'nancy.crawford@example.com',
      bio: {
        summary: 'Foreign policy hawk committed to American strength abroad.',
        background: 'Defense policy analyst, advised on national security.',
        education: [{ institution: 'Georgetown', degree: 'International Relations', year: 1996 }],
        experience: [{ title: 'Senior Fellow', organization: 'Heritage Foundation', startYear: 2008, description: 'Defense and foreign policy analysis' }],
        achievements: ['Published national security strategy', 'Pentagon advisory board'],
      },
      reasonForRunning: 'To restore American leadership and deter our adversaries.',
      topIssues: [
        { issueId: 'defense', position: 'Massive military buildup, confront China and Russia', priority: 1, spectrumPosition: 90 },
        { issueId: 'foreign-policy', position: 'America First, skeptical of UN, strong on allies', priority: 2, spectrumPosition: 85 },
        { issueId: 'immigration', position: 'National security vetting, end visa lottery', priority: 3, spectrumPosition: 75 },
      ],
    },

    // Additional diverse candidates
    {
      displayName: 'Angela Price',
      gender: 'female',
      email: 'angela.price@example.com',
      bio: {
        summary: 'Urban planner focused on affordable housing and sustainable cities.',
        background: 'Transformed blighted neighborhoods into thriving communities.',
        education: [{ institution: 'Columbia', degree: 'Urban Planning', year: 2008 }],
        experience: [{ title: 'Planning Director', organization: 'City Planning Department', startYear: 2015, description: 'Led comprehensive plan update' }],
        achievements: ['Built 5,000 affordable units', 'Transit-oriented development'],
      },
      reasonForRunning: 'To make our cities livable, affordable, and sustainable.',
      topIssues: [
        { issueId: 'housing', position: 'Major public investment in affordable housing', priority: 1, spectrumPosition: -65 },
        { issueId: 'infrastructure', position: 'Public transit, complete streets, green buildings', priority: 2, spectrumPosition: -60 },
        { issueId: 'climate-change', position: 'Urban sustainability, building codes, green spaces', priority: 3, spectrumPosition: -55 },
      ],
    },
    {
      displayName: 'Steven Clark',
      gender: 'male',
      email: 'steven.clark@example.com',
      bio: {
        summary: 'Libertarian-leaning entrepreneur advocating for freedom and limited government.',
        background: 'Built multiple companies, tech investor.',
        education: [{ institution: 'Carnegie Mellon', degree: 'Computer Science', year: 2002 }],
        experience: [{ title: 'Investor', organization: 'Freedom Ventures', startYear: 2010, description: 'Backed 50 startups' }],
        achievements: ['Created 2,000 jobs', 'Criminal justice reform advocate'],
      },
      reasonForRunning: 'To maximize individual freedom and minimize government intrusion.',
      topIssues: [
        { issueId: 'taxes', position: 'Dramatically lower taxes, consumption-based system', priority: 1, spectrumPosition: 75 },
        { issueId: 'criminal-justice', position: 'End drug war, reduce incarceration, restore rights', priority: 2, spectrumPosition: -30 },
        { issueId: 'civil-rights', position: 'Maximum individual liberty, limited government', priority: 3, spectrumPosition: 20 },
      ],
    },
  ];

  const ZONES: Record<string, string[]> = {
    'PA-01': ['pa01-north', 'pa01-central', 'pa01-south'],
    'PA-02': ['pa02-west', 'pa02-center', 'pa02-northeast', 'pa02-south'],
  };
  const DISTRICTS = Object.keys(ZONES);

  const batch = firestore().batch();

  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    const district = DISTRICTS[i % DISTRICTS.length];
    const districtZones = ZONES[district];
    const zone = districtZones[Math.floor(Math.random() * districtZones.length)];
    // PLAN-10E: Use candidate's stated positions directly (no template expansion)
    const fullTopIssues = candidate.topIssues.map((ti, idx) => ({
      ...ti,
      priority: idx + 1,
    }));
    const priorityIssues = candidate.topIssues.map(i => i.issueId);

    // PLAN-10C: Generate quiz responses for this candidate's district
    const QUIZ_QUESTION_IDS: Record<string, string[]> = {
      'PA-01': ['trade-1', 'iran-1', 'inflation-1', 'borders-1', 'welfare-1', 'pa01-infrastructure-1', 'pa01-housing-1'],
      'PA-02': ['trade-1', 'iran-1', 'inflation-1', 'borders-1', 'welfare-1', 'pa02-budget-1', 'pa02-transit-1'],
    };
    const QUESTION_ISSUE_MAP: Record<string, string> = {
      'trade-1': 'trade', 'iran-1': 'iran', 'inflation-1': 'inflation',
      'borders-1': 'borders', 'welfare-1': 'welfare',
      'pa01-infrastructure-1': 'pa01-infrastructure', 'pa01-housing-1': 'pa01-housing',
      'pa02-budget-1': 'pa02-budget', 'pa02-transit-1': 'pa02-transit',
    };
    // Quiz option spectrum values per question — candidates snap to the nearest option
    const QUESTION_OPTIONS: Record<string, number[]> = {
      'trade-1': [-80, 0, 80],
      'iran-1': [80, 0, -80],
      'inflation-1': [-80, 0, 80],
      'borders-1': [80, 0, -80],
      'welfare-1': [-80, 0, 80],
      'pa01-infrastructure-1': [-80, 0, 80],
      'pa01-housing-1': [-80, 0, 80],
      'pa02-budget-1': [80, 0, -80],
      'pa02-transit-1': [-80, 0, 80],
    };
    const snapToOption = (val: number, options: number[]): number => {
      let closest = options[0];
      let minDist = Math.abs(val - closest);
      for (const opt of options) {
        const dist = Math.abs(val - opt);
        if (dist < minDist) { closest = opt; minDist = dist; }
      }
      return closest;
    };

    // Use candidate's average spectrum position to pick quiz answers.
    // Progressive candidates pick the progressive option, conservatives the conservative one.
    const avgSpectrum = fullTopIssues.length > 0
      ? fullTopIssues.reduce((sum: number, ti: any) => sum + (ti.spectrumPosition || 0), 0) / fullTopIssues.length
      : 0;

    const districtQuestionIds = QUIZ_QUESTION_IDS[district] || QUIZ_QUESTION_IDS['PA-01'];
    const candidateQuizResponses: QuestionnaireResponse[] = districtQuestionIds.map((qId) => {
      const issueId = QUESTION_ISSUE_MAP[qId];
      const options = QUESTION_OPTIONS[qId] || [-80, 0, 80];
      const snappedVal = snapToOption(avgSpectrum, options);
      return { questionId: qId, issueId, answer: snappedVal };
    });

    // Create user document
    const userRef = getCollection<User>(Collections.USERS).doc();
    const now = firestore.Timestamp.now();

    batch.set(userRef, {
      id: userRef.id,
      email: candidate.email,
      displayName: candidate.displayName,
      gender: candidate.gender,
      role: 'candidate' as const,
      state: 'verified' as const,
      verificationStatus: 'verified' as const,
      selectedIssues: priorityIssues,
      questionnaireResponses: candidateQuizResponses,
      createdAt: now,
      updatedAt: now,
    });

    // Create candidate document with ALL issue positions
    const candidateRef = getCollection<Candidate>(Collections.CANDIDATES).doc();
    batch.set(candidateRef, {
      id: candidateRef.id,
      userId: userRef.id,
      status: 'approved' as const,
      signatureDocUrl: '',
      declarationData: { encryptedPayload: '', keyId: '' },
      reasonForRunning: candidate.reasonForRunning,
      topIssues: fullTopIssues,
      bio: candidate.bio,
      profileViews: Math.floor(Math.random() * 10000) + 500,
      endorsementCount: Math.floor(Math.random() * 5000) + 100,
      trendingScore: Math.floor(Math.random() * 100),
      district,
      zone,
      publishedAt: now,
      createdAt: now,
      updatedAt: now,
    } as Candidate);
  }

  await batch.commit();
  console.log(`Seeded ${candidates.length} candidates with full issue positions successfully!`);
};

// ==================== CANDIDATE QUIZ RESPONSE FIX ====================

const SNAP_QUESTION_OPTIONS: Record<string, number[]> = {
  'trade-1': [-80, 0, 80],
  'iran-1': [80, 0, -80],
  'inflation-1': [-80, 0, 80],
  'borders-1': [80, 0, -80],
  'welfare-1': [-80, 0, 80],
  'pa01-infrastructure-1': [-80, 0, 80],
  'pa01-housing-1': [-80, 0, 80],
  'pa02-budget-1': [80, 0, -80],
  'pa02-transit-1': [-80, 0, 80],
};

const snapVal = (val: number, options: number[]): number => {
  let closest = options[0];
  let minDist = Math.abs(val - closest);
  for (const opt of options) {
    const dist = Math.abs(val - opt);
    if (dist < minDist) { closest = opt; minDist = dist; }
  }
  return closest;
};

/** Fix candidate user quiz responses: snap raw spectrum values to discrete option values */
export const fixCandidateQuizResponses = async (): Promise<number> => {
  const candidatesSnap = await getCollection<Candidate>(Collections.CANDIDATES).get();
  let fixed = 0;

  for (const candidateDoc of candidatesSnap.docs) {
    const candidate = candidateDoc.data() as Candidate;
    const userDoc = await getCollection<User>(Collections.USERS).doc(candidate.userId).get();
    if (!userDoc.exists) continue;

    const userData = userDoc.data() as User;
    const responses = userData.questionnaireResponses || [];
    let needsFix = false;

    const fixedResponses = responses.map((r) => {
      const options = SNAP_QUESTION_OPTIONS[r.questionId];
      if (!options) return r;
      const numAnswer = Number(r.answer);
      if (isNaN(numAnswer)) return r;
      const snapped = snapVal(numAnswer, options);
      if (snapped !== numAnswer) needsFix = true;
      return { ...r, answer: snapped };
    });

    if (needsFix) {
      await getCollection<User>(Collections.USERS).doc(candidate.userId).update({
        questionnaireResponses: fixedResponses,
      } as any);
      fixed++;
    }
  }

  return fixed;
};

// ==================== ENDORSEMENT OPERATIONS ====================

export const createEndorsement = async (
  odid: string,
  candidateId: string,
  roundId?: string
): Promise<string> => {
  // Check if user already has an active endorsement for this candidate (any round)
  const allEndorsements = await getCollection<Endorsement>(Collections.ENDORSEMENTS).get();
  const existing = (allEndorsements?.docs || []).find((doc) => {
    const e = doc.data() as Endorsement;
    return e.odid === odid && e.candidateId === candidateId && e.isActive === true;
  });

  if (existing) {
    const existingData = existing.data() as Endorsement;
    // If the existing endorsement is from a different round (or has no round), update it to the current round
    if (roundId && existingData.roundId !== roundId) {
      await existing.ref.update({ roundId });
    }
    // Return the existing ID — not an error, just already endorsed
    return existing.id;
  }

  const endorsementData: Record<string, any> = {
    odid,
    candidateId,
    isActive: true,
    createdAt: firestore.Timestamp.now(),
  };
  if (roundId) endorsementData.roundId = roundId;

  const docRef = await getCollection<Endorsement>(Collections.ENDORSEMENTS).add(
    endorsementData as Endorsement
  );
  await docRef.update({ id: docRef.id });

  // Increment candidate's endorsement count
  await updateCandidate(candidateId, {
    endorsementCount: firestore.FieldValue.increment(1) as unknown as number,
  });

  return docRef.id;
};

export const revokeEndorsement = async (
  odid: string,
  candidateId: string,
  roundId?: string
): Promise<void> => {
  // Filter in memory to avoid composite index requirement
  const allEndorsements = await getCollection<Endorsement>(Collections.ENDORSEMENTS).get();
  const matchingDoc = (allEndorsements?.docs || []).find((doc) => {
    const e = doc.data() as Endorsement;
    return e.odid === odid && e.candidateId === candidateId && e.isActive === true
      && (!roundId || e.roundId === roundId);
  });

  if (matchingDoc) {
    await matchingDoc.ref.update({ isActive: false });
    // Decrement candidate's endorsement count
    await updateCandidate(candidateId, {
      endorsementCount: firestore.FieldValue.increment(-1) as unknown as number,
    });
  }
};

export const getUserEndorsements = async (
  odid: string,
  roundId?: string
): Promise<Endorsement[]> => {
  try {
    // Filter in memory to avoid composite index requirement
    const snapshot = await getCollection<Endorsement>(Collections.ENDORSEMENTS).get();
    return (snapshot?.docs || [])
      .map((doc) => doc.data() as Endorsement)
      .filter((e) => e.odid === odid && e.isActive === true
        && (!roundId || e.roundId === roundId));
  } catch (error) {
    console.warn('Error fetching user endorsements:', error);
    return [];
  }
};

export const hasUserEndorsedCandidate = async (
  odid: string,
  candidateId: string,
  roundId?: string
): Promise<boolean> => {
  try {
    // Fetch all endorsements and filter in memory to avoid composite index
    const snapshot = await getCollection<Endorsement>(Collections.ENDORSEMENTS).get();
    const hasEndorsed = (snapshot?.docs || []).some((doc) => {
      const endorsement = doc.data() as Endorsement;
      return (
        endorsement.odid === odid &&
        endorsement.candidateId === candidateId &&
        endorsement.isActive === true &&
        (!roundId || endorsement.roundId === roundId)
      );
    });
    return hasEndorsed;
  } catch (error) {
    console.warn('Error checking endorsement status:', error);
    return false;
  }
};

// ==================== BOOKMARK OPERATIONS ====================

export const addBookmark = async (
  odid: string,
  candidateId: string,
  convertedFromRoundId?: string
): Promise<string> => {
  // Check if already bookmarked
  const snapshot = await getCollection<Bookmark>(Collections.BOOKMARKS).get();
  const existing = (snapshot?.docs || []).find((doc) => {
    const b = doc.data() as Bookmark;
    return b.candidateId === candidateId && b.id?.startsWith?.(odid);
  });
  // Use odid_candidateId as doc ID for uniqueness
  const docId = `${odid}_${candidateId}`;
  const existingDoc = await getCollection<Bookmark>(Collections.BOOKMARKS).doc(docId).get();

  if (existingDoc.exists) {
    return docId; // Already bookmarked, idempotent
  }

  await getCollection<Bookmark>(Collections.BOOKMARKS).doc(docId).set({
    id: docId,
    candidateId,
    ...(convertedFromRoundId ? { convertedFromRoundId } : {}),
    bookmarkedAt: firestore.Timestamp.now(),
  } as Bookmark);

  return docId;
};

export const removeBookmark = async (
  odid: string,
  candidateId: string
): Promise<void> => {
  const docId = `${odid}_${candidateId}`;
  await getCollection<Bookmark>(Collections.BOOKMARKS).doc(docId).delete();
};

export const getUserBookmarks = async (odid: string): Promise<Bookmark[]> => {
  try {
    const snapshot = await getCollection<Bookmark>(Collections.BOOKMARKS).get();
    return (snapshot?.docs || [])
      .map((doc) => doc.data() as Bookmark)
      .filter((b) => b.id?.startsWith(`${odid}_`));
  } catch (error) {
    console.warn('Error fetching user bookmarks:', error);
    return [];
  }
};

export const hasUserBookmarkedCandidate = async (
  odid: string,
  candidateId: string
): Promise<boolean> => {
  try {
    const docId = `${odid}_${candidateId}`;
    const doc = await getCollection<Bookmark>(Collections.BOOKMARKS).doc(docId).get();
    return doc.exists;
  } catch (error) {
    console.warn('Error checking bookmark status:', error);
    return false;
  }
};

export const convertEndorsementsToBookmarks = async (
  odid: string,
  roundId: string
): Promise<number> => {
  // Get ALL active endorsements for this user (not round-filtered)
  // so we catch endorsements regardless of their roundId
  const endorsements = await getUserEndorsements(odid);
  let converted = 0;

  for (const endorsement of endorsements) {
    await addBookmark(odid, endorsement.candidateId, roundId);
    // Soft-delete the endorsement
    const allDocs = await getCollection<Endorsement>(Collections.ENDORSEMENTS).get();
    const matchingDoc = (allDocs?.docs || []).find((doc) => doc.id === endorsement.id);
    if (matchingDoc) {
      await matchingDoc.ref.update({ isActive: false });
    }
    converted++;
  }
  return converted;
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

  try {
    // Fetch all questions and filter in memory to avoid composite index requirement
    const snapshot = await getCollection<Question>(Collections.QUESTIONS).get();
    const questions = (snapshot?.docs?.map((doc) => doc.data() as Question) || [])
      .filter((q) => issueIds.includes(q.issueId))
      .sort((a, b) => (a.order || 0) - (b.order || 0));
    return questions;
  } catch (error) {
    console.warn('Error fetching questions:', error);
    return [];
  }
};

// Get quiz config for a district
export const getQuizConfig = async (districtId: string): Promise<{ questionIds: string[]; version: number } | null> => {
  try {
    const doc = await firestore().collection(Collections.QUIZ_CONFIG).doc(districtId).get();
    return doc.exists ? (doc.data() as { questionIds: string[]; version: number }) : null;
  } catch (error) {
    console.warn('Error fetching quiz config:', error);
    return null;
  }
};

// Get active questions for a district (ordered by order field)
export const getActiveQuestions = async (districtId: string): Promise<Question[]> => {
  try {
    const config = await getQuizConfig(districtId);
    if (!config || !config.questionIds.length) return [];

    const snapshot = await getCollection<Question>(Collections.QUESTIONS).get();
    const allQuestions = snapshot?.docs?.map((doc) => doc.data() as Question) || [];

    return allQuestions
      .filter(
        (q) =>
          config.questionIds.includes(q.id) &&
          q.isActive === true &&
          q.editorialStatus === 'approved'
      )
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  } catch (error) {
    console.warn('Error fetching active questions:', error);
    return [];
  }
};

// Update a single quiz response by questionId (auto-save from quiz screen)
export const updateSingleQuizResponse = async (
  userId: string,
  response: QuestionnaireResponse
): Promise<QuestionnaireResponse[]> => {
  const userDoc = await getCollection<User>(Collections.USERS).doc(userId).get();
  if (!userDoc.exists) throw new Error('User not found');

  const userData = userDoc.data() as User;
  const existing = userData.questionnaireResponses || [];

  // Replace existing response for this questionId, or append
  const idx = existing.findIndex((r) => r.questionId === response.questionId);
  const updated = [...existing];
  if (idx >= 0) {
    updated[idx] = response;
  } else {
    updated.push(response);
  }

  const updates: Record<string, any> = {
    questionnaireResponses: updated,
    lastQuizActivityAt: firestore.Timestamp.now(),
    updatedAt: firestore.Timestamp.now(),
  };

  // Mark questionnaire complete if at least 1 response
  if (updated.length >= 1) {
    updates['onboarding.questionnaire'] = 'complete';
  }

  await getCollection<User>(Collections.USERS).doc(userId).update(updates);
  return updated;
};

// Remove a single quiz response by questionId
export const clearQuizResponse = async (
  userId: string,
  questionId: string
): Promise<QuestionnaireResponse[]> => {
  const userDoc = await getCollection<User>(Collections.USERS).doc(userId).get();
  if (!userDoc.exists) throw new Error('User not found');

  const userData = userDoc.data() as User;
  const existing = userData.questionnaireResponses || [];
  const updated = existing.filter((r) => r.questionId !== questionId);

  const updates: Record<string, any> = {
    questionnaireResponses: updated,
    lastQuizActivityAt: firestore.Timestamp.now(),
    updatedAt: firestore.Timestamp.now(),
  };

  if (updated.length === 0) {
    updates['onboarding.questionnaire'] = 'incomplete';
  }

  await getCollection<User>(Collections.USERS).doc(userId).update(updates);
  return updated;
};

// Check if questions exist and seed them if not
export const ensureQuestionsExist = async (): Promise<void> => {
  try {
    const snapshot = await getCollection<Question>(Collections.QUESTIONS).limit(1).get();
    if (snapshot.empty) {
      console.log('No questions found, seeding...');
      await seedQuestions();
      await seedQuizConfig();
      console.log('Questions and quiz config seeded!');
    }
  } catch (error) {
    console.warn('Error checking questions:', error);
  }
};

// Clear and reseed all data (issues, questions, candidates) with correct IDs
export const reseedAllData = async (): Promise<void> => {
  console.log('Reseeding all data...');

  // Delete existing issues
  const issuesSnapshot = await getCollection<Issue>(Collections.ISSUES).get();
  const batch1 = firestore().batch();
  issuesSnapshot.docs.forEach((doc) => batch1.delete(doc.ref));
  await batch1.commit();
  console.log('Deleted old issues');

  // Delete existing questions
  const questionsSnapshot = await getCollection<Question>(Collections.QUESTIONS).get();
  const batch2 = firestore().batch();
  questionsSnapshot.docs.forEach((doc) => batch2.delete(doc.ref));
  await batch2.commit();
  console.log('Deleted old questions');

  // Delete existing candidates
  const candidatesSnapshot = await getCollection<Candidate>(Collections.CANDIDATES).get();
  const batch3 = firestore().batch();
  candidatesSnapshot.docs.forEach((doc) => batch3.delete(doc.ref));
  await batch3.commit();
  console.log('Deleted old candidates');

  // Reseed everything
  await seedIssues();
  await seedQuestions();
  await seedQuizConfig();
  await seedCandidates();

  console.log('All data reseeded successfully!');
};

// ==================== PARTY CONFIG OPERATIONS ====================

export const getPartyConfig = async (): Promise<PartyConfig | null> => {
  try {
    const snapshot = await getCollection<PartyConfig>(Collections.PARTY_CONFIG)
      .limit(1)
      .get();
    return !snapshot || snapshot.empty ? null : (snapshot.docs[0].data() as PartyConfig);
  } catch (error) {
    console.warn('Error fetching party config:', error);
    return null;
  }
};

export const subscribeToPartyConfig = (
  callback: (config: PartyConfig | null) => void
): (() => void) => {
  return getCollection<PartyConfig>(Collections.PARTY_CONFIG)
    .limit(1)
    .onSnapshot(
      (snapshot) => {
        if (!snapshot || snapshot.empty) {
          callback(null);
        } else {
          callback(snapshot.docs[0].data() as PartyConfig);
        }
      },
      (error) => {
        console.warn('Error subscribing to party config:', error);
        callback(null);
      }
    );
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
    const averageSpectrum = candidate.topIssues?.length
      ? candidate.topIssues.reduce((sum, i) => sum + (i.spectrumPosition || 0), 0) / candidate.topIssues.length
      : 0;
    return {
      candidateId: candidate.id,
      candidateName: '', // Will be populated from user data
      photoUrl: undefined,
      endorsementCount: candidate.endorsementCount,
      profileViews: candidate.profileViews,
      trendingScore: candidate.trendingScore,
      rank: index + 1,
      averageSpectrum,
      contestStatus: candidate.contestStatus,
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

  // Filter out eliminated candidates from trending
  return snapshot.docs
    .filter((doc) => {
      const candidate = doc.data() as Candidate;
      return candidate.contestStatus !== 'eliminated';
    })
    .map((doc, index) => {
      const candidate = doc.data() as Candidate;
      const averageSpectrum = candidate.topIssues?.length
        ? candidate.topIssues.reduce((sum, i) => sum + (i.spectrumPosition || 0), 0) / candidate.topIssues.length
        : 0;
      return {
        candidateId: candidate.id,
        candidateName: '',
        photoUrl: undefined,
        endorsementCount: candidate.endorsementCount,
        profileViews: candidate.profileViews,
        trendingScore: candidate.trendingScore,
        rank: index + 1,
        averageSpectrum,
        contestStatus: candidate.contestStatus,
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

// ---- Contest Round Functions (PLAN-00 Phase 1) ----

export const getContestRounds = async (): Promise<ContestRound[]> => {
  try {
    const snapshot = await getCollection<ContestRound>(Collections.CONTEST_ROUNDS)
      .orderBy('order')
      .get();
    return snapshot.docs.map((doc) => doc.data() as ContestRound);
  } catch (error) {
    console.warn('Error fetching contest rounds:', error);
    return [];
  }
};

const CONTEST_ROUNDS_SEED: Omit<ContestRound, 'startDate' | 'endDate'>[] = [
  { id: 'pre_nomination', label: 'Pre-Nomination', shortLabel: 'Pre-Nom', order: 0, votingMethod: 'none', isEndorsementRound: false, candidatesEntering: null, candidatesAdvancing: null, tieBreakPolicy: 'advance_all_tied' },
  { id: 'round_1_endorsement', label: 'First Round: Endorsement', shortLabel: 'Round 1', order: 1, votingMethod: 'approval', isEndorsementRound: true, candidatesEntering: 100, candidatesAdvancing: 20, tieBreakPolicy: 'advance_all_tied' },
  { id: 'round_2_endorsement', label: 'Second Round: Endorsement', shortLabel: 'Round 2', order: 2, votingMethod: 'approval', isEndorsementRound: true, candidatesEntering: 20, candidatesAdvancing: 10, tieBreakPolicy: 'trending_score' },
  { id: 'round_3_endorsement', label: 'Third Round: Endorsement', shortLabel: 'Round 3', order: 3, votingMethod: 'approval', isEndorsementRound: true, candidatesEntering: 10, candidatesAdvancing: 4, tieBreakPolicy: 'trending_score' },
  { id: 'virtual_town_hall', label: 'Virtual Town Hall', shortLabel: 'Town Hall', order: 4, votingMethod: 'ranked_choice', isEndorsementRound: false, candidatesEntering: 4, candidatesAdvancing: 2, tieBreakPolicy: 'admin_decision' },
  { id: 'debate', label: 'Debate', shortLabel: 'Debate', order: 5, votingMethod: 'pick_one', isEndorsementRound: false, candidatesEntering: 2, candidatesAdvancing: 1, tieBreakPolicy: 'admin_decision' },
  { id: 'final_results', label: 'Final Results', shortLabel: 'Results', order: 6, votingMethod: 'none', isEndorsementRound: false, candidatesEntering: 1, candidatesAdvancing: null, tieBreakPolicy: 'advance_all_tied' },
  { id: 'post_election', label: 'Post-Election', shortLabel: 'Archive', order: 7, votingMethod: 'none', isEndorsementRound: false, candidatesEntering: null, candidatesAdvancing: null, tieBreakPolicy: 'advance_all_tied' },
];

export const seedContestRounds = async (): Promise<void> => {
  const db = firestore();
  const batch = db.batch();

  for (const round of CONTEST_ROUNDS_SEED) {
    const ref = db.collection(Collections.CONTEST_ROUNDS).doc(round.id);
    batch.set(ref, { ...round, startDate: null, endDate: null });
  }

  await batch.commit();
  console.log('Contest rounds seeded successfully');
};
