import { Timestamp } from 'firebase/firestore';

// User Types
export type UserRole = 'unregistered' | 'constituent' | 'candidate' | 'admin';
export type UserState = 'unverified' | 'verified' | 'pn_applicant' | 'approved_pn';
export type VerificationStatus = 'pending' | 'verified' | 'failed';

export type Gender = 'male' | 'female' | 'non-binary' | 'prefer-not-to-say';

export interface User {
  id: string;
  email: string;
  displayName: string;
  photoUrl?: string;
  gender?: Gender;
  role: UserRole;
  state: UserState;
  verificationStatus: VerificationStatus;
  selectedIssues: string[];
  questionnaireResponses: QuestionnaireResponse[];
  dealbreakers: string[];
  district?: string;
  zipCode?: string;
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
  signatureDocUrl: string;
  declarationData: EncryptedData;
  reasonForRunning: string;
  topIssues: TopIssue[];
  bio: CandidateBio;
  profileViews: number;
  endorsementCount: number;
  trendingScore: number;
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
  createdAt: Timestamp;
  isActive: boolean;
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

export interface Question {
  id: string;
  issueId: string;
  text: string;
  type: QuestionType;
  options?: QuestionOption[];
  sliderConfig?: SliderConfig;
  order: number;
  isRequired: boolean;
}

export interface QuestionOption {
  id: string;
  text: string;
  value: string | number;
}

export interface SliderConfig {
  min: number;
  max: number;
  step: number;
  leftLabel: string;
  rightLabel: string;
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
}

// Feed Types
export interface FeedItem {
  id: string;
  psa: PSA;
  candidate: CandidatePreview;
  alignmentScore: number;
  matchedIssues: string[];
  hasDealbreaker: boolean;
  candidatePositions: TopIssue[];
}

export interface CandidatePreview {
  id: string;
  displayName: string;
  photoUrl?: string;
  gender?: Gender;
  topIssues: string[];
  endorsementCount: number;
  averageSpectrum: number; // -100 to 100
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

// Config Types
export interface PartyConfig {
  id: string;
  partyName: string;
  primaryColor: string;
  secondaryColor: string;
  logoUrl: string;
  tagline: string;
  contestStage: ContestStage;
  endorsementCutoffs: EndorsementCutoff[];
}

export type ContestStage = 'pre_nomination' | 'nomination' | 'voting' | 'post_election';

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
  email: string;
  password: string;
  confirmPassword: string;
  displayName: string;
}

export interface OnboardingFormData {
  selectedIssues: string[];
  questionnaireResponses: QuestionnaireResponse[];
  dealbreakers: string[];
}
