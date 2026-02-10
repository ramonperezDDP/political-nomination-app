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
  const candidate = doc.data() as Candidate;
  return fillMissingIssuePositions(candidate);
};

export const getCandidateByUserId = async (
  userId: string
): Promise<Candidate | null> => {
  const snapshot = await getCollection<Candidate>(Collections.CANDIDATES)
    .where('userId', '==', userId)
    .limit(1)
    .get();
  if (snapshot.empty) return null;
  const candidate = snapshot.docs[0].data() as Candidate;
  return fillMissingIssuePositions(candidate);
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
  try {
    // Fetch all and filter in memory to avoid composite index
    const snapshot = await getCollection<Candidate>(Collections.CANDIDATES).get();
    const allCandidates = snapshot?.docs?.map((doc) => doc.data() as Candidate) || [];
    console.log('Total candidates in Firestore:', allCandidates.length);

    const approved = allCandidates
      .filter((c) => c.status === 'approved')
      .sort((a, b) => (b.endorsementCount || 0) - (a.endorsementCount || 0))
      .slice(0, limit)
      .map(fillMissingIssuePositions); // Fill in any missing issue positions

    console.log('Approved candidates:', approved.length);
    return approved;
  } catch (error) {
    console.warn('Error fetching approved candidates:', error);
    return [];
  }
};

// Get candidates with full data for feed generation
export const getCandidatesForFeed = async (): Promise<Array<{ candidate: Candidate; user: User | null }>> => {
  try {
    const candidates = await getApprovedCandidates(50);
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
  limit = 50
): Promise<LeaderboardEntry[]> => {
  try {
    // Fetch all candidates to avoid composite index requirement
    const snapshot = await getCollection<Candidate>(Collections.CANDIDATES).get();

    // Filter and sort in memory
    const candidates = (snapshot?.docs?.map((doc) => doc.data() as Candidate) || [])
      .filter((c) => c.status === 'approved')
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
  ];

  const batch = firestore().batch();

  for (const issue of issues) {
    const docRef = getCollection<Issue>(Collections.ISSUES).doc(issue.id);
    batch.set(docRef, issue);
  }

  await batch.commit();
  console.log('Issues seeded successfully!');
};

// Seed questionnaire questions for each issue
export const seedQuestions = async (): Promise<void> => {
  const questions: Question[] = [
    // Economy & Jobs
    {
      id: 'economy-1',
      issueId: 'economy',
      text: 'What role should the government play in the economy?',
      type: 'single_choice',
      options: [
        { id: 'e1-a', text: 'Significant intervention to ensure fair wages, worker protections, and reduce inequality', value: -80 },
        { id: 'e1-b', text: 'Moderate regulation to protect consumers and workers while allowing business growth', value: -30 },
        { id: 'e1-c', text: 'Limited regulation focused on preventing monopolies and fraud', value: 30 },
        { id: 'e1-d', text: 'Minimal government involvement - free markets work best with little interference', value: 80 },
      ],
      order: 1,
      isRequired: true,
    },

    // Tax Policy
    {
      id: 'taxes-1',
      issueId: 'taxes',
      text: 'How should the tax system be structured?',
      type: 'single_choice',
      options: [
        { id: 't1-a', text: 'Significantly higher taxes on wealthy individuals and corporations to fund social programs', value: -85 },
        { id: 't1-b', text: 'Moderately progressive taxes with higher rates for top earners', value: -40 },
        { id: 't1-c', text: 'Flatter tax rates with fewer deductions and loopholes', value: 40 },
        { id: 't1-d', text: 'Lower taxes across the board to stimulate economic growth', value: 85 },
      ],
      order: 1,
      isRequired: true,
    },

    // Minimum Wage
    {
      id: 'minimum-wage-1',
      issueId: 'minimum-wage',
      text: 'What should happen with the federal minimum wage?',
      type: 'single_choice',
      options: [
        { id: 'mw1-a', text: 'Raise to $20-25/hour and index to inflation', value: -90 },
        { id: 'mw1-b', text: 'Raise to $15-17/hour gradually over several years', value: -50 },
        { id: 'mw1-c', text: 'Keep current levels and let states decide their own minimums', value: 40 },
        { id: 'mw1-d', text: 'Eliminate the federal minimum wage - let the market determine wages', value: 90 },
      ],
      order: 1,
      isRequired: true,
    },

    // Healthcare
    {
      id: 'healthcare-1',
      issueId: 'healthcare',
      text: 'What healthcare system do you prefer?',
      type: 'single_choice',
      options: [
        { id: 'h1-a', text: 'Single-payer Medicare for All - government-funded universal healthcare', value: -90 },
        { id: 'h1-b', text: 'Public option alongside private insurance - expand ACA', value: -45 },
        { id: 'h1-c', text: 'Market-based with subsidies for those who need help', value: 45 },
        { id: 'h1-d', text: 'Fully private system with minimal government involvement', value: 90 },
      ],
      order: 1,
      isRequired: true,
    },

    // Medicare & Medicaid
    {
      id: 'medicare-1',
      issueId: 'medicare',
      text: 'What changes should be made to Medicare and Medicaid?',
      type: 'single_choice',
      options: [
        { id: 'mc1-a', text: 'Expand both programs significantly - lower Medicare age, expand Medicaid to all states', value: -85 },
        { id: 'mc1-b', text: 'Strengthen current programs and fill coverage gaps', value: -40 },
        { id: 'mc1-c', text: 'Add private options and competition to improve efficiency', value: 40 },
        { id: 'mc1-d', text: 'Convert to block grants and give states more control', value: 85 },
      ],
      order: 1,
      isRequired: true,
    },

    // Prescription Drugs
    {
      id: 'prescription-drugs-1',
      issueId: 'prescription-drugs',
      text: 'How should prescription drug prices be addressed?',
      type: 'single_choice',
      options: [
        { id: 'pd1-a', text: 'Allow government to negotiate all drug prices and cap costs', value: -85 },
        { id: 'pd1-b', text: 'Allow Medicare to negotiate prices for some drugs', value: -40 },
        { id: 'pd1-c', text: 'Increase market competition and transparency', value: 40 },
        { id: 'pd1-d', text: 'Let the free market determine prices without government interference', value: 85 },
      ],
      order: 1,
      isRequired: true,
    },

    // Education
    {
      id: 'education-1',
      issueId: 'education',
      text: 'What approach to K-12 education do you support?',
      type: 'single_choice',
      options: [
        { id: 'ed1-a', text: 'Significantly increase public school funding, reduce class sizes, pay teachers more', value: -80 },
        { id: 'ed1-b', text: 'Increase funding while also supporting some charter school options', value: -30 },
        { id: 'ed1-c', text: 'Promote school choice through vouchers and charter schools', value: 50 },
        { id: 'ed1-d', text: 'Full parental choice - vouchers for private, religious, or homeschool', value: 85 },
      ],
      order: 1,
      isRequired: true,
    },

    // Higher Education
    {
      id: 'higher-education-1',
      issueId: 'higher-education',
      text: 'What should be done about college costs and student debt?',
      type: 'single_choice',
      options: [
        { id: 'he1-a', text: 'Free public college and cancel most student debt', value: -90 },
        { id: 'he1-b', text: 'Debt-free community college and income-based repayment', value: -45 },
        { id: 'he1-c', text: 'Expand Pell grants and vocational training alternatives', value: 30 },
        { id: 'he1-d', text: 'Reduce government involvement - let market competition lower costs', value: 80 },
      ],
      order: 1,
      isRequired: true,
    },

    // Climate Change
    {
      id: 'climate-change-1',
      issueId: 'climate-change',
      text: 'What action should be taken on climate change?',
      type: 'single_choice',
      options: [
        { id: 'cc1-a', text: 'Aggressive action - Green New Deal, end fossil fuels by 2035', value: -95 },
        { id: 'cc1-b', text: 'Strong action - net-zero by 2050, major investments in clean energy', value: -50 },
        { id: 'cc1-c', text: 'Market-based solutions like carbon pricing, support innovation', value: 30 },
        { id: 'cc1-d', text: 'No major government action - focus on adaptation, not prevention', value: 85 },
      ],
      order: 1,
      isRequired: true,
    },

    // Clean Energy
    {
      id: 'clean-energy-1',
      issueId: 'clean-energy',
      text: 'How should we approach energy policy?',
      type: 'single_choice',
      options: [
        { id: 'ce1-a', text: 'Rapidly transition to 100% renewable energy, phase out fossil fuels', value: -90 },
        { id: 'ce1-b', text: 'Major investment in renewables while using natural gas as bridge fuel', value: -40 },
        { id: 'ce1-c', text: 'All-of-the-above approach including oil, gas, nuclear, and renewables', value: 40 },
        { id: 'ce1-d', text: 'Focus on energy independence through domestic fossil fuel production', value: 85 },
      ],
      order: 1,
      isRequired: true,
    },

    // Immigration
    {
      id: 'immigration-1',
      issueId: 'immigration',
      text: 'What should be the approach to immigration?',
      type: 'single_choice',
      options: [
        { id: 'im1-a', text: 'Welcome more immigrants, create easier paths to legal status, reduce enforcement', value: -85 },
        { id: 'im1-b', text: 'Comprehensive reform with path to citizenship and reasonable enforcement', value: -35 },
        { id: 'im1-c', text: 'Secure borders first, then consider legal immigration reform', value: 45 },
        { id: 'im1-d', text: 'Significantly reduce immigration, build wall, increase deportations', value: 90 },
      ],
      order: 1,
      isRequired: true,
    },

    // Path to Citizenship
    {
      id: 'path-to-citizenship-1',
      issueId: 'path-to-citizenship',
      text: 'What should happen with undocumented immigrants already in the US?',
      type: 'single_choice',
      options: [
        { id: 'pc1-a', text: 'Clear path to citizenship for all, protect DACA recipients', value: -90 },
        { id: 'pc1-b', text: 'Earned legalization after meeting requirements (taxes, background check)', value: -40 },
        { id: 'pc1-c', text: 'Legal status but not citizenship, focus on enforcement', value: 40 },
        { id: 'pc1-d', text: 'No amnesty - enforce existing laws and increase deportations', value: 90 },
      ],
      order: 1,
      isRequired: true,
    },

    // Civil Rights
    {
      id: 'civil-rights-1',
      issueId: 'civil-rights',
      text: 'What approach should government take on civil rights and discrimination?',
      type: 'single_choice',
      options: [
        { id: 'cr1-a', text: 'Strong federal enforcement, expand protected classes, support reparations study', value: -85 },
        { id: 'cr1-b', text: 'Enforce existing civil rights laws and address systemic inequities', value: -40 },
        { id: 'cr1-c', text: 'Protect individual rights, limit government mandates on private businesses', value: 40 },
        { id: 'cr1-d', text: 'Reduce federal civil rights enforcement, let states and markets decide', value: 85 },
      ],
      order: 1,
      isRequired: true,
    },

    // Voting Rights
    {
      id: 'voting-rights-1',
      issueId: 'voting-rights',
      text: 'What voting policies do you support?',
      type: 'single_choice',
      options: [
        { id: 'vr1-a', text: 'Automatic registration, expand early/mail voting, make Election Day a holiday', value: -85 },
        { id: 'vr1-b', text: 'Make voting easier while maintaining reasonable verification', value: -35 },
        { id: 'vr1-c', text: 'Require voter ID, verify citizenship, clean up voter rolls', value: 50 },
        { id: 'vr1-d', text: 'Strict voter ID, limit mail voting, tighten registration requirements', value: 90 },
      ],
      order: 1,
      isRequired: true,
    },

    // Criminal Justice
    {
      id: 'criminal-justice-1',
      issueId: 'criminal-justice',
      text: 'What criminal justice reforms do you support?',
      type: 'single_choice',
      options: [
        { id: 'cj1-a', text: 'End cash bail, abolish private prisons, defund police and invest in communities', value: -90 },
        { id: 'cj1-b', text: 'Reform sentencing, invest in rehabilitation, community policing', value: -45 },
        { id: 'cj1-c', text: 'Support police, focus on reducing crime, modest sentencing reform', value: 45 },
        { id: 'cj1-d', text: 'Tough on crime, mandatory minimums, back the blue', value: 90 },
      ],
      order: 1,
      isRequired: true,
    },

    // Foreign Policy
    {
      id: 'foreign-policy-1',
      issueId: 'foreign-policy',
      text: 'What should guide American foreign policy?',
      type: 'single_choice',
      options: [
        { id: 'fp1-a', text: 'Diplomacy first, reduce military interventions, strengthen international institutions', value: -75 },
        { id: 'fp1-b', text: 'Engaged diplomacy with allies, use military as last resort', value: -30 },
        { id: 'fp1-c', text: 'Peace through strength, support allies, deter adversaries', value: 40 },
        { id: 'fp1-d', text: 'America First, reduce foreign commitments, focus on national interests', value: 80 },
      ],
      order: 1,
      isRequired: true,
    },

    // National Defense
    {
      id: 'defense-1',
      issueId: 'defense',
      text: 'What level of military spending do you support?',
      type: 'single_choice',
      options: [
        { id: 'd1-a', text: 'Significantly reduce military budget, invest savings in domestic programs', value: -85 },
        { id: 'd1-b', text: 'Modest reductions focused on waste, maintain core capabilities', value: -35 },
        { id: 'd1-c', text: 'Maintain current levels, modernize equipment', value: 35 },
        { id: 'd1-d', text: 'Increase military spending to maintain global superiority', value: 85 },
      ],
      order: 1,
      isRequired: true,
    },

    // Gun Policy
    {
      id: 'gun-policy-1',
      issueId: 'gun-policy',
      text: 'What gun policies do you support?',
      type: 'single_choice',
      options: [
        { id: 'gp1-a', text: 'Assault weapons ban, universal background checks, red flag laws, gun registry', value: -90 },
        { id: 'gp1-b', text: 'Universal background checks and red flag laws, no assault weapons ban', value: -40 },
        { id: 'gp1-c', text: 'Enforce existing laws better, protect Second Amendment rights', value: 45 },
        { id: 'gp1-d', text: 'No new restrictions, constitutional carry, protect all gun rights', value: 90 },
      ],
      order: 1,
      isRequired: true,
    },

    // Reproductive Rights
    {
      id: 'abortion-1',
      issueId: 'abortion',
      text: 'What is your position on abortion?',
      type: 'single_choice',
      options: [
        { id: 'ab1-a', text: 'Legal without restrictions, codify Roe v. Wade, government funding', value: -90 },
        { id: 'ab1-b', text: 'Legal with some restrictions (viability), keep government out of the decision', value: -40 },
        { id: 'ab1-c', text: 'Legal only in limited cases (rape, incest, health), support alternatives', value: 45 },
        { id: 'ab1-d', text: 'Oppose abortion in most/all cases, support life from conception', value: 90 },
      ],
      order: 1,
      isRequired: true,
    },

    // LGBTQ+ Rights
    {
      id: 'lgbtq-rights-1',
      issueId: 'lgbtq-rights',
      text: 'What LGBTQ+ policies do you support?',
      type: 'single_choice',
      options: [
        { id: 'lg1-a', text: 'Full equality, expand anti-discrimination protections, support gender-affirming care', value: -90 },
        { id: 'lg1-b', text: 'Support marriage equality and workplace protections', value: -40 },
        { id: 'lg1-c', text: 'Protect religious liberty, parental rights in schools, limit medical transitions for minors', value: 50 },
        { id: 'lg1-d', text: 'Traditional marriage, religious exemptions, oppose gender ideology in schools', value: 90 },
      ],
      order: 1,
      isRequired: true,
    },

    // Infrastructure
    {
      id: 'infrastructure-1',
      issueId: 'infrastructure',
      text: 'How should we approach infrastructure investment?',
      type: 'single_choice',
      options: [
        { id: 'in1-a', text: 'Massive public investment in green infrastructure, public transit, broadband', value: -80 },
        { id: 'in1-b', text: 'Bipartisan investment in roads, bridges, broadband, some clean energy', value: -25 },
        { id: 'in1-c', text: 'Public-private partnerships, focus on traditional infrastructure', value: 35 },
        { id: 'in1-d', text: 'Limit federal role, let states and private sector lead', value: 80 },
      ],
      order: 1,
      isRequired: true,
    },

    // Housing
    {
      id: 'housing-1',
      issueId: 'housing',
      text: 'How should we address housing affordability?',
      type: 'single_choice',
      options: [
        { id: 'ho1-a', text: 'Major public investment in affordable housing, rent control, tenant protections', value: -85 },
        { id: 'ho1-b', text: 'Incentivize construction, expand housing vouchers, support first-time buyers', value: -35 },
        { id: 'ho1-c', text: 'Reduce regulations to allow more building, limit rent control', value: 45 },
        { id: 'ho1-d', text: 'Let the market work, reduce government involvement in housing', value: 85 },
      ],
      order: 1,
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

// All issue IDs for generating complete candidate positions
const ALL_ISSUE_IDS = [
  'economy', 'taxes', 'minimum-wage', 'healthcare', 'medicare', 'prescription-drugs',
  'education', 'higher-education', 'climate-change', 'clean-energy', 'immigration',
  'path-to-citizenship', 'civil-rights', 'voting-rights', 'criminal-justice',
  'foreign-policy', 'defense', 'gun-policy', 'abortion', 'lgbtq-rights',
  'infrastructure', 'housing',
];

// Position templates by political leaning (spectrum: -100 = progressive, +100 = conservative)
const POSITION_TEMPLATES: Record<string, Record<string, { position: string; baseSpectrum: number }>> = {
  progressive: {
    'economy': { position: 'Strong government investment in jobs programs, worker protections, and reducing wealth inequality through progressive policies', baseSpectrum: -85 },
    'taxes': { position: 'Higher taxes on wealthy and corporations to fund social programs, close tax loopholes', baseSpectrum: -90 },
    'minimum-wage': { position: '$25/hour federal minimum wage indexed to inflation, strengthen union rights', baseSpectrum: -88 },
    'healthcare': { position: 'Medicare for All - single payer universal healthcare as a human right', baseSpectrum: -92 },
    'medicare': { position: 'Expand Medicare to cover all Americans, add dental, vision, and hearing', baseSpectrum: -90 },
    'prescription-drugs': { position: 'Government price controls on all drugs, allow imports, public manufacturing option', baseSpectrum: -85 },
    'education': { position: 'Fully fund public education, ban for-profit charter schools, pay teachers $80k minimum', baseSpectrum: -88 },
    'higher-education': { position: 'Free public college for all, cancel all student debt', baseSpectrum: -92 },
    'climate-change': { position: 'Green New Deal, net-zero by 2035, treat climate as existential threat', baseSpectrum: -95 },
    'clean-energy': { position: '100% renewable energy by 2035, ban fracking, end fossil fuel subsidies', baseSpectrum: -93 },
    'immigration': { position: 'Welcome refugees, path to citizenship for all, abolish ICE, no border wall', baseSpectrum: -90 },
    'path-to-citizenship': { position: 'Immediate citizenship path for DACA recipients and all undocumented immigrants', baseSpectrum: -92 },
    'civil-rights': { position: 'Federal reparations study, end qualified immunity, strong civil rights enforcement', baseSpectrum: -88 },
    'voting-rights': { position: 'Automatic voter registration, DC and PR statehood, end electoral college', baseSpectrum: -90 },
    'criminal-justice': { position: 'Abolish private prisons, end cash bail, decriminalize drugs, defund police', baseSpectrum: -93 },
    'foreign-policy': { position: 'Diplomatic solutions first, reduce military footprint, end forever wars', baseSpectrum: -80 },
    'defense': { position: 'Cut military budget by 25%, redirect to domestic needs', baseSpectrum: -85 },
    'gun-policy': { position: 'Assault weapons ban, universal background checks, red flag laws, gun buybacks', baseSpectrum: -88 },
    'abortion': { position: 'Codify Roe, abortion access without restrictions, fund reproductive healthcare', baseSpectrum: -95 },
    'lgbtq-rights': { position: 'Full equality, ban conversion therapy, protect trans rights, pass Equality Act', baseSpectrum: -92 },
    'infrastructure': { position: 'Massive public investment in green infrastructure, public transit, high-speed rail', baseSpectrum: -82 },
    'housing': { position: 'National rent control, social housing, end homelessness with Housing First', baseSpectrum: -88 },
  },
  moderate_progressive: {
    'economy': { position: 'Balanced approach with targeted investments in infrastructure and job training', baseSpectrum: -45 },
    'taxes': { position: 'Modest tax increases on wealthy to fund key programs, simplify tax code', baseSpectrum: -50 },
    'minimum-wage': { position: '$17/hour federal minimum wage, phased in over 3 years', baseSpectrum: -55 },
    'healthcare': { position: 'Public option alongside private insurance, strengthen ACA marketplace', baseSpectrum: -50 },
    'medicare': { position: 'Lower Medicare eligibility to 55, negotiate drug prices', baseSpectrum: -55 },
    'prescription-drugs': { position: 'Allow Medicare to negotiate prices, cap out-of-pocket costs', baseSpectrum: -52 },
    'education': { position: 'Increase federal funding, support teachers, expand pre-K access', baseSpectrum: -48 },
    'higher-education': { position: 'Free community college, income-based repayment for loans', baseSpectrum: -55 },
    'climate-change': { position: 'Rejoin Paris Agreement, invest in clean energy, net-zero by 2050', baseSpectrum: -60 },
    'clean-energy': { position: 'Incentives for renewable adoption, phase out coal, keep natural gas as bridge', baseSpectrum: -55 },
    'immigration': { position: 'Comprehensive reform with path to citizenship and reasonable border security', baseSpectrum: -45 },
    'path-to-citizenship': { position: 'Earned citizenship for long-term residents and DACA recipients', baseSpectrum: -50 },
    'civil-rights': { position: 'Strengthen civil rights enforcement, police reform with accountability', baseSpectrum: -52 },
    'voting-rights': { position: 'Expand early voting, fight gerrymandering, secure elections', baseSpectrum: -55 },
    'criminal-justice': { position: 'End mandatory minimums, reform cash bail, invest in rehabilitation', baseSpectrum: -58 },
    'foreign-policy': { position: 'Strong alliances, diplomacy first, targeted sanctions when needed', baseSpectrum: -35 },
    'defense': { position: 'Maintain strong defense, audit Pentagon spending, invest in cyber security', baseSpectrum: -30 },
    'gun-policy': { position: 'Universal background checks, red flag laws, respect 2nd Amendment', baseSpectrum: -50 },
    'abortion': { position: 'Protect Roe, keep abortion safe, legal, and rare, support family planning', baseSpectrum: -60 },
    'lgbtq-rights': { position: 'Support marriage equality and anti-discrimination protections', baseSpectrum: -55 },
    'infrastructure': { position: 'Bipartisan infrastructure investment in roads, bridges, broadband', baseSpectrum: -40 },
    'housing': { position: 'Expand affordable housing tax credits, help first-time buyers', baseSpectrum: -48 },
  },
  centrist: {
    'economy': { position: 'Pro-growth policies that work for business and workers, reduce regulations', baseSpectrum: 5 },
    'taxes': { position: 'Lower rates, broaden base, simplify code, maintain fiscal responsibility', baseSpectrum: 10 },
    'minimum-wage': { position: '$12/hour federal minimum, let states go higher if they choose', baseSpectrum: -15 },
    'healthcare': { position: 'Fix ACA, increase competition, reduce costs through market solutions', baseSpectrum: 0 },
    'medicare': { position: 'Preserve Medicare, consider premium support for future generations', baseSpectrum: 15 },
    'prescription-drugs': { position: 'Increase generic competition, streamline FDA approval', baseSpectrum: 10 },
    'education': { position: 'Local control, school choice, accountability standards', baseSpectrum: 20 },
    'higher-education': { position: 'Reform student loans, promote vocational training alternatives', baseSpectrum: 5 },
    'climate-change': { position: 'Market-based solutions like carbon pricing, technology innovation', baseSpectrum: -10 },
    'clean-energy': { position: 'All-of-the-above energy policy including nuclear and natural gas', baseSpectrum: 5 },
    'immigration': { position: 'Secure borders first, then address status of undocumented', baseSpectrum: 15 },
    'path-to-citizenship': { position: 'Legal status for DACA, earned pathway for others with requirements', baseSpectrum: 0 },
    'civil-rights': { position: 'Equal enforcement of existing laws, oppose discrimination', baseSpectrum: -5 },
    'voting-rights': { position: 'Secure elections with voter ID, maintain ballot access', baseSpectrum: 20 },
    'criminal-justice': { position: 'Support police with reforms, tough on violent crime, fair sentencing', baseSpectrum: 10 },
    'foreign-policy': { position: 'Peace through strength, support allies, confront adversaries', baseSpectrum: 20 },
    'defense': { position: 'Strong military, modernize forces, maintain readiness', baseSpectrum: 30 },
    'gun-policy': { position: 'Enforce existing laws, support responsible ownership, protect rights', baseSpectrum: 25 },
    'abortion': { position: 'Reduce abortions through support services, some reasonable restrictions', baseSpectrum: 10 },
    'lgbtq-rights': { position: 'Civil unions, oppose discrimination, respect religious freedom', baseSpectrum: 5 },
    'infrastructure': { position: 'Public-private partnerships, prioritize maintenance over new projects', baseSpectrum: 15 },
    'housing': { position: 'Reduce regulations to increase supply, oppose rent control', baseSpectrum: 25 },
  },
  moderate_conservative: {
    'economy': { position: 'Free market solutions, reduce regulations, lower taxes to spur growth', baseSpectrum: 55 },
    'taxes': { position: 'Lower taxes across the board, flatten tax brackets, cut corporate rate', baseSpectrum: 60 },
    'minimum-wage': { position: 'Oppose federal minimum wage increases, let markets determine wages', baseSpectrum: 50 },
    'healthcare': { position: 'Repeal ACA mandates, health savings accounts, sell insurance across state lines', baseSpectrum: 55 },
    'medicare': { position: 'Preserve for current seniors, transition to premium support for younger workers', baseSpectrum: 50 },
    'prescription-drugs': { position: 'Remove regulations, speed up generic approvals, free market pricing', baseSpectrum: 48 },
    'education': { position: 'School choice, charter schools, vouchers, local control', baseSpectrum: 55 },
    'higher-education': { position: 'Get government out of student loans, promote trade schools', baseSpectrum: 52 },
    'climate-change': { position: 'Acknowledge climate change, oppose economically harmful mandates', baseSpectrum: 40 },
    'clean-energy': { position: 'All-of-the-above including fossil fuels, no mandates or bans', baseSpectrum: 50 },
    'immigration': { position: 'Secure border first, merit-based legal immigration, E-Verify', baseSpectrum: 55 },
    'path-to-citizenship': { position: 'Legal status possible after border security, no amnesty', baseSpectrum: 45 },
    'civil-rights': { position: 'Colorblind policies, oppose affirmative action preferences', baseSpectrum: 50 },
    'voting-rights': { position: 'Voter ID required, clean voter rolls, oppose mail-in ballot expansion', baseSpectrum: 55 },
    'criminal-justice': { position: 'Back the blue, tough on crime, oppose defunding police', baseSpectrum: 52 },
    'foreign-policy': { position: 'America first, strong military, fair trade deals', baseSpectrum: 55 },
    'defense': { position: 'Increase military spending, modernize nuclear arsenal', baseSpectrum: 60 },
    'gun-policy': { position: 'Protect 2nd Amendment, oppose new restrictions, support concealed carry', baseSpectrum: 65 },
    'abortion': { position: 'Pro-life with exceptions for rape, incest, life of mother', baseSpectrum: 55 },
    'lgbtq-rights': { position: 'Oppose special protections, protect religious liberty', baseSpectrum: 50 },
    'infrastructure': { position: 'Private sector solutions, toll roads, oppose federal spending increases', baseSpectrum: 52 },
    'housing': { position: 'Free market housing, reduce zoning regulations, no rent control', baseSpectrum: 55 },
  },
  conservative: {
    'economy': { position: 'Dramatically reduce government, slash regulations, free enterprise', baseSpectrum: 85 },
    'taxes': { position: 'Major tax cuts, flat tax or fair tax, abolish IRS', baseSpectrum: 90 },
    'minimum-wage': { position: 'Abolish federal minimum wage, government should not set wages', baseSpectrum: 88 },
    'healthcare': { position: 'Full repeal of Obamacare, free market healthcare, no mandates', baseSpectrum: 85 },
    'medicare': { position: 'Transition to fully private system, phase out government healthcare', baseSpectrum: 80 },
    'prescription-drugs': { position: 'Complete deregulation, let free market set prices', baseSpectrum: 82 },
    'education': { position: 'Abolish Department of Education, full school choice, end public school monopoly', baseSpectrum: 88 },
    'higher-education': { position: 'End all federal student aid, privatize higher education', baseSpectrum: 85 },
    'climate-change': { position: 'Climate change is overstated, oppose all climate regulations', baseSpectrum: 88 },
    'clean-energy': { position: 'Drill baby drill, expand fossil fuels, end all green energy subsidies', baseSpectrum: 90 },
    'immigration': { position: 'Build the wall, mass deportations, end birthright citizenship', baseSpectrum: 92 },
    'path-to-citizenship': { position: 'No amnesty ever, deport all illegals, legal immigration only', baseSpectrum: 88 },
    'civil-rights': { position: 'End all affirmative action, no reparations, equal treatment only', baseSpectrum: 80 },
    'voting-rights': { position: 'Strict voter ID, purge rolls, in-person voting only', baseSpectrum: 85 },
    'criminal-justice': { position: 'Tough on crime, mandatory minimums, support police fully', baseSpectrum: 82 },
    'foreign-policy': { position: 'America first, no foreign aid, strong borders, military strength', baseSpectrum: 80 },
    'defense': { position: 'Massive military buildup, peace through strength', baseSpectrum: 88 },
    'gun-policy': { position: 'Absolute 2nd Amendment rights, constitutional carry, no restrictions', baseSpectrum: 92 },
    'abortion': { position: 'Abortion is murder, ban all abortions, personhood at conception', baseSpectrum: 95 },
    'lgbtq-rights': { position: 'Traditional marriage only, oppose transgender policies, religious freedom first', baseSpectrum: 88 },
    'infrastructure': { position: 'Privatize infrastructure, toll roads, no federal involvement', baseSpectrum: 78 },
    'housing': { position: 'Complete deregulation, eliminate HUD, free market only', baseSpectrum: 85 },
  },
};

// Generate all issue positions for a candidate based on their political leaning
const generateAllIssuePositions = (
  leaning: 'progressive' | 'moderate_progressive' | 'centrist' | 'moderate_conservative' | 'conservative',
  priorityIssues: string[], // Issues in priority order (index 0 = top priority)
  customPositions?: Record<string, { position: string; spectrum: number }> // Override specific positions
): Array<{ issueId: string; position: string; priority: number; spectrumPosition: number }> => {
  const template = POSITION_TEMPLATES[leaning];

  return ALL_ISSUE_IDS.map((issueId) => {
    // Check for custom override
    if (customPositions && customPositions[issueId]) {
      return {
        issueId,
        position: customPositions[issueId].position,
        priority: priorityIssues.indexOf(issueId) + 1 || ALL_ISSUE_IDS.length,
        spectrumPosition: customPositions[issueId].spectrum,
      };
    }

    const templatePosition = template[issueId];
    // Add some variance to spectrum position (-8 to +8)
    const variance = Math.floor(Math.random() * 17) - 8;
    const spectrum = Math.max(-100, Math.min(100, templatePosition.baseSpectrum + variance));

    return {
      issueId,
      position: templatePosition.position,
      priority: priorityIssues.indexOf(issueId) + 1 || ALL_ISSUE_IDS.length,
      spectrumPosition: spectrum,
    };
  }).sort((a, b) => a.priority - b.priority);
};

// Helper to fill in missing issue positions for candidates with incomplete data
const fillMissingIssuePositions = (candidate: Candidate): Candidate => {
  const existingIssues = candidate.topIssues || [];

  // If candidate already has all issues, return as-is
  if (existingIssues.length >= ALL_ISSUE_IDS.length) {
    return candidate;
  }

  // Determine political leaning from existing positions
  const avgSpectrum = existingIssues.length > 0
    ? existingIssues.reduce((sum, i) => sum + i.spectrumPosition, 0) / existingIssues.length
    : 0;

  let leaning: 'progressive' | 'moderate_progressive' | 'centrist' | 'moderate_conservative' | 'conservative';
  if (avgSpectrum <= -70) leaning = 'progressive';
  else if (avgSpectrum <= -30) leaning = 'moderate_progressive';
  else if (avgSpectrum <= 30) leaning = 'centrist';
  else if (avgSpectrum <= 70) leaning = 'moderate_conservative';
  else leaning = 'conservative';

  // Get existing issue IDs and their priorities
  const existingIssueIds = new Set(existingIssues.map(i => i.issueId));
  const priorityIssues = existingIssues
    .sort((a, b) => a.priority - b.priority)
    .map(i => i.issueId);

  // Build custom positions from existing data
  const customPositions: Record<string, { position: string; spectrum: number }> = {};
  existingIssues.forEach(i => {
    customPositions[i.issueId] = { position: i.position, spectrum: i.spectrumPosition };
  });

  // Generate all positions (this will use existing ones via customPositions)
  const fullTopIssues = generateAllIssuePositions(leaning, priorityIssues, customPositions);

  return {
    ...candidate,
    topIssues: fullTopIssues,
  };
};

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

  const batch = firestore().batch();

  for (const candidate of candidates) {
    // Determine political leaning based on average spectrum position
    const avgSpectrum = candidate.topIssues.reduce((sum, i) => sum + i.spectrumPosition, 0) / candidate.topIssues.length;
    let leaning: 'progressive' | 'moderate_progressive' | 'centrist' | 'moderate_conservative' | 'conservative';
    if (avgSpectrum <= -70) leaning = 'progressive';
    else if (avgSpectrum <= -30) leaning = 'moderate_progressive';
    else if (avgSpectrum <= 30) leaning = 'centrist';
    else if (avgSpectrum <= 70) leaning = 'moderate_conservative';
    else leaning = 'conservative';

    // Get priority issues from the candidate's stated top issues
    const priorityIssues = candidate.topIssues.map(i => i.issueId);

    // Generate full positions for all issues, using stated positions as custom overrides
    const customPositions: Record<string, { position: string; spectrum: number }> = {};
    candidate.topIssues.forEach(i => {
      customPositions[i.issueId] = { position: i.position, spectrum: i.spectrumPosition };
    });

    const fullTopIssues = generateAllIssuePositions(leaning, priorityIssues, customPositions);

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
      questionnaireResponses: [],
      dealbreakers: [],
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
      publishedAt: now,
      createdAt: now,
      updatedAt: now,
    } as Candidate);
  }

  await batch.commit();
  console.log(`Seeded ${candidates.length} candidates with full issue positions successfully!`);
};

// ==================== ENDORSEMENT OPERATIONS ====================

export const createEndorsement = async (
  odid: string,
  candidateId: string
): Promise<string> => {
  // Check if user already endorsed this candidate (filter in memory to avoid index)
  const allEndorsements = await getCollection<Endorsement>(Collections.ENDORSEMENTS).get();
  const existing = (allEndorsements?.docs || []).find((doc) => {
    const e = doc.data() as Endorsement;
    return e.odid === odid && e.candidateId === candidateId && e.isActive === true;
  });

  if (existing) {
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
  // Filter in memory to avoid composite index requirement
  const allEndorsements = await getCollection<Endorsement>(Collections.ENDORSEMENTS).get();
  const matchingDoc = (allEndorsements?.docs || []).find((doc) => {
    const e = doc.data() as Endorsement;
    return e.odid === odid && e.candidateId === candidateId && e.isActive === true;
  });

  if (matchingDoc) {
    await matchingDoc.ref.update({ isActive: false });
    // Decrement candidate's endorsement count
    await updateCandidate(candidateId, {
      endorsementCount: firestore.FieldValue.increment(-1) as unknown as number,
    });
  }
};

export const getUserEndorsements = async (odid: string): Promise<Endorsement[]> => {
  try {
    // Filter in memory to avoid composite index requirement
    const snapshot = await getCollection<Endorsement>(Collections.ENDORSEMENTS).get();
    return (snapshot?.docs || [])
      .map((doc) => doc.data() as Endorsement)
      .filter((e) => e.odid === odid && e.isActive === true);
  } catch (error) {
    console.warn('Error fetching user endorsements:', error);
    return [];
  }
};

export const hasUserEndorsedCandidate = async (
  odid: string,
  candidateId: string
): Promise<boolean> => {
  try {
    // Fetch all endorsements and filter in memory to avoid composite index
    const snapshot = await getCollection<Endorsement>(Collections.ENDORSEMENTS).get();
    const hasEndorsed = (snapshot?.docs || []).some((doc) => {
      const endorsement = doc.data() as Endorsement;
      return (
        endorsement.odid === odid &&
        endorsement.candidateId === candidateId &&
        endorsement.isActive === true
      );
    });
    return hasEndorsed;
  } catch (error) {
    console.warn('Error checking endorsement status:', error);
    return false;
  }
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

// Check if questions exist and seed them if not
export const ensureQuestionsExist = async (): Promise<void> => {
  try {
    const snapshot = await getCollection<Question>(Collections.QUESTIONS).limit(1).get();
    if (snapshot.empty) {
      console.log('No questions found, seeding...');
      await seedQuestions();
      console.log('Questions seeded!');
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
