import { Timestamp } from 'firebase/firestore';

// User Types
export type UserRole = 'constituent' | 'candidate' | 'admin';

// Independent verification/onboarding states (Plan 01)
export type VerificationState = 'unverified' | 'pending' | 'verified' | 'failed';
export type OnboardingState = 'incomplete' | 'complete';

export interface UserVerification {
  email: VerificationState;
  voterRegistration: VerificationState;
  photoId: VerificationState;
}

export interface UserOnboarding {
  questionnaire: OnboardingState;
}

// Hierarchical district model
export type DistrictType = 'federal' | 'state' | 'congressional' | 'local';

export interface UserDistrict {
  id: string;
  type: DistrictType;
  name: string;
  state?: string;
}

export type Gender = 'male' | 'female' | 'non-binary' | 'prefer-not-to-say';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  displayName: string;
  isAnonymous: boolean;
  photoUrl?: string;
  gender?: Gender;
  role: UserRole;
  verification: UserVerification;
  onboarding: UserOnboarding;
  districts: UserDistrict[];
  selectedIssues: string[];
  questionnaireResponses: QuestionnaireResponse[];
  zipCode?: string;
  lastBrowsingDistrict?: string;
  // Abandonment tracking metadata
  lastActiveAt: Timestamp;
  sessionCount: number;
  firstSeenAt: Timestamp;
  appVersion: string;
  platform: string;
  lastQuizActivityAt?: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface QuestionnaireResponse {
  questionId: string;
  issueId: string;
  answer: string | number | string[];
}

// Candidate Types
export type CandidateStatus = 'pending' | 'approved' | 'denied';
export type PSAStatus = 'draft' | 'published';

export interface TopIssue {
  issueId: string;
  position: string;
  priority: number;
  spectrumPosition: number; // -100 to 100
}

export interface Candidate {
  id: string;
  userId: string;
  status: CandidateStatus;
  contestStatus?: CandidateContestStatus;
  signatureDocUrl: string;
  declarationData: EncryptedData;
  reasonForRunning: string;
  topIssues: TopIssue[];
  bio: CandidateBio;
  profileViews: number;
  endorsementCount: number;
  trendingScore: number;
  district: string;
  zone?: string;
  publishedAt?: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface CandidateBio {
  summary: string;
  background: string;
  education: EducationEntry[];
  experience: ExperienceEntry[];
  achievements: string[];
}

export interface EducationEntry {
  institution: string;
  degree: string;
  year: number;
}

export interface ExperienceEntry {
  title: string;
  organization: string;
  startYear: number;
  endYear?: number;
  description: string;
}

export interface EncryptedData {
  encryptedPayload: string;
  keyId: string;
}

// PSA Types
export interface PSA {
  id: string;
  candidateId: string;
  title: string;
  description: string;
  videoUrl: string;
  thumbnailUrl: string;
  duration: number;
  status: PSAStatus;
  issueIds: string[];
  views: number;
  likes: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Issue Types
export interface Issue {
  id: string;
  name: string;
  description: string;
  category: string;
  parentId?: string;
  icon: string;
  order: number;
  isActive: boolean;
}

export interface IssueCategory {
  id: string;
  name: string;
  description: string;
  icon: string;
  order: number;
}

// Endorsement Types
export interface Endorsement {
  id: string;
  odid: string;
  candidateId: string;
  roundId?: string;
  createdAt: Timestamp;
  isActive: boolean;
}

// Bookmark Types
export interface Bookmark {
  id: string;
  candidateId: string;
  convertedFromRoundId?: string;
  bookmarkedAt: Timestamp;
}

// Message Types
export interface Conversation {
  id: string;
  participantIds: string[];
  lastMessage?: MessagePreview;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface MessagePreview {
  content: string;
  senderId: string;
  createdAt: Timestamp;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  attachments?: Attachment[];
  createdAt: Timestamp;
  readAt?: Timestamp;
}

export interface Attachment {
  type: 'image' | 'document';
  url: string;
  name: string;
}

// Questionnaire Types
export type QuestionType = 'single_choice' | 'multiple_choice' | 'slider' | 'ranking';
export type QuestionScope = 'global' | 'national' | 'local';
export type EditorialStatus = 'approved' | 'pending' | 'rejected';

export interface SliderConfig {
  min: number;
  max: number;
  step: number;
  leftLabel: string;
  rightLabel: string;
}

export interface Question {
  id: string;
  issueId: string;
  text: string;
  type: QuestionType;
  options?: QuestionOption[];
  /** @deprecated Kept for backward compat with onboarding questionnaire */
  sliderConfig?: SliderConfig;
  scope: QuestionScope;
  districtFilter?: string[];
  isActive: boolean;
  editorialStatus: EditorialStatus;
  order: number;
  isRequired: boolean;
}

export interface QuestionOption {
  id: string;
  text: string;
  shortLabel: string;
  spectrumValue: number;
  value: string | number;
}

// Leaderboard Types
export interface LeaderboardEntry {
  candidateId: string;
  candidateName: string;
  photoUrl?: string;
  gender?: Gender;
  endorsementCount: number;
  profileViews: number;
  trendingScore: number;
  rank: number;
  alignmentScore?: number;
  averageSpectrum: number; // -100 to 100, calculated from topIssues
  contestStatus?: CandidateContestStatus;
}

// Feed Types
export interface FeedItem {
  id: string;
  psa: PSA;
  candidate: CandidatePreview;
  alignmentScore: number | null;
  candidateResponses: QuestionnaireResponse[];
  sharedCount: number;
  alignedQuestionIds: string[];
  exactMatchIds: string[];
  closeMatchIds: string[];
  notMatchedIds: string[];
}

export interface CandidatePreview {
  id: string;
  displayName: string;
  photoUrl?: string;
  gender?: Gender;
  topIssues: string[];
  endorsementCount: number;
  averageSpectrum: number; // -100 to 100
  district: string;
  zone?: string;
}

// Notification Types
export type NotificationType =
  | 'endorsement_received'
  | 'message_received'
  | 'application_approved'
  | 'application_denied'
  | 'new_psa'
  | 'leaderboard_update';

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, string>;
  isRead: boolean;
  createdAt: Timestamp;
}

// Contest Round Types
export type ContestRoundId =
  | 'pre_nomination'
  | 'round_1_endorsement'
  | 'round_2_endorsement'
  | 'round_3_endorsement'
  | 'virtual_town_hall'
  | 'debate'
  | 'final_results'
  | 'post_election';

/** @deprecated Use ContestRoundId. Kept as alias for backward compatibility. */
export type ContestStage = ContestRoundId;

export type VotingMethod = 'none' | 'approval' | 'ranked_choice' | 'pick_one';
export type ContestMode = 'beta_demo' | 'production';
export type TransitionType = 'forward' | 'reopen' | 'manual_override';
export type TieBreakPolicy = 'advance_all_tied' | 'trending_score' | 'admin_decision';

export type CandidateContestStatus =
  | 'active'
  | 'eliminated'
  | 'withdrawn'
  | 'disqualified'
  | 'winner';

export interface ContestRound {
  id: ContestRoundId;
  label: string;
  shortLabel: string;
  order: number;
  votingMethod: VotingMethod;
  isEndorsementRound: boolean;
  candidatesEntering: number | null;
  candidatesAdvancing: number | null;
  eliminationThreshold?: number;
  startDate: Timestamp | null;
  endDate: Timestamp | null;
  tieBreakPolicy: TieBreakPolicy;
}

export interface ContestTransition {
  operationId: string;
  transitionType: TransitionType;
  fromRoundId: ContestRoundId;
  toRoundId: ContestRoundId;
  transitionedAt: Timestamp;
  triggeredBy: 'admin' | 'beta_cron';
  actorId: string | null;
  contestMode: ContestMode;
  eliminationApplied: boolean;
  tallySnapshot: Record<string, number> | null;
  advancedCandidateIds: string[];
  eliminatedCandidateIds: string[];
  tieOccurred: boolean;
  tieBreakMethod: TieBreakPolicy | null;
  tieBreakDetails: string | null;
  notes: string | null;
}

export interface Vote {
  id: string;
  odid: string;
  roundId: ContestRoundId;
  votingMethod: VotingMethod;
  rankings?: string[];
  candidateId?: string;
  createdAt: Timestamp;
}

// Config Types
export interface PartyConfig {
  id: string;
  partyName: string;
  primaryColor: string;
  secondaryColor: string;
  logoUrl: string;
  tagline: string;
  introVideoUrl?: string;
  contestStage: ContestStage;
  currentRoundId?: ContestRoundId;
  contestMode?: ContestMode;
  endorsementCutoffs: EndorsementCutoff[];
}

export interface EndorsementCutoff {
  stage: number;
  threshold: number;
  eliminationDate: Timestamp;
}

// Application Types
export interface CandidateApplication {
  id: string;
  userId: string;
  status: 'pending' | 'under_review' | 'approved' | 'denied';
  signatureDocUrl: string;
  idDocUrl: string;
  resumeUrl?: string;
  taxReturnsUrl?: string;
  criminalHistoryDisclosure: CriminalHistoryDisclosure;
  declarationOfIntent: DeclarationOfIntent;
  submittedAt: Timestamp;
  reviewedAt?: Timestamp;
  reviewedBy?: string;
  denialReason?: string;
}

export interface CriminalHistoryDisclosure {
  hasConvictions: boolean;
  convictionDetails?: string;
  hasArrestHistory: boolean;
  arrestDetails?: string;
}

export interface DeclarationOfIntent {
  fullLegalName: string;
  dateOfBirth: string;
  ssn: string; // Encrypted
  address: string;
  agreedToTerms: boolean;
  signatureDataUrl: string;
  signedAt: Timestamp;
}

// Analytics Types
export interface ProfileMetrics {
  candidateId: string;
  date: string;
  profileViews: number;
  uniqueViewers: number;
  endorsementsReceived: number;
  psaViews: Record<string, number>;
}

export interface EndorsementDemographics {
  totalEndorsements: number;
  byDistrict: Record<string, number>;
  byIssue: Record<string, number>;
  byAge?: Record<string, number>;
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

// Form Types
export interface LoginFormData {
  email: string;
  password: string;
}

export interface RegisterFormData {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export interface OnboardingFormData {
  selectedIssues: string[];
  questionnaireResponses: QuestionnaireResponse[];
}
