import React, { useEffect, useState, useMemo } from 'react';
import { StyleSheet, View, ScrollView, Dimensions, FlatList, Pressable, Modal, Platform } from 'react-native';
import { Text, useTheme, SegmentedButtons, Chip, Divider, IconButton } from 'react-native-paper';
import { useLocalSearchParams, useGlobalSearchParams, router } from 'expo-router';
import { SafeAreaView as NativeSafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import {
  getCandidate,
  getCandidatePSAs,
  incrementCandidateViews,
  getUser,
  inferGenderFromName,
  getActiveQuestions,
} from '@/services/firebase/firestore';
import { useAuthStore, useConfigStore, useUserStore, selectCurrentRoundId } from '@/stores';
import { selectEndorseLockReason, selectHasAccount } from '@/stores';
import VerifyIdentitySheet from '@/components/home/VerifyIdentitySheet';

const DISTRICT_COLORS: Record<string, string> = {
  'PA-01': '#FFB6C1',
  'PA-02': '#ADD8E6',
};
import { calculateAlignmentScore } from '@/utils/alignment';
import {
  Card,
  CandidateAvatar,
  calculateAverageSpectrum,
  AlignmentBadge,
  PrimaryButton,
  SecondaryButton,
  LoadingScreen,
  EmptyState,
} from '@/components/ui';
import type { Candidate, PSA, User, Question } from '@/types';

const SafeAreaView = Platform.OS === 'web' ? View : NativeSafeAreaView;

type ProfileTab = 'issues' | 'bio' | 'psas';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function CandidateProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { from } = useGlobalSearchParams<{ from?: string }>();
  const theme = useTheme();
  const { user: currentUser } = useAuthStore();
  const { issues } = useConfigStore();
  const { endorseCandidate, revokeEndorsement } = useUserStore();
  const currentRoundId = useConfigStore(selectCurrentRoundId);
  const selectedDistrict = useUserStore((s) => s.selectedBrowsingDistrict) || 'PA-01';
  const chipColor = DISTRICT_COLORS[selectedDistrict] || '#E0E0E0';

  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [candidateUser, setCandidateUser] = useState<User | null>(null);
  const [psas, setPSAs] = useState<PSA[]>([]);
  const [quizQuestions, setQuizQuestions] = useState<Question[]>([]);
  const [activeTab, setActiveTab] = useState<ProfileTab>('issues');
  const [isLoading, setIsLoading] = useState(true);
  const [isEndorsing, setIsEndorsing] = useState(false);
  const [displayedEndorsementCount, setDisplayedEndorsementCount] = useState(0);
  const [showLockModal, setShowLockModal] = useState(false);

  // Check endorsement status and lock state
  const hasEndorsed = useUserStore((s) =>
    id ? s.endorsements.some((e) => e.candidateId === id && e.isActive) : false
  );
  const hasAccount = useUserStore(selectHasAccount);
  const lockReasonSelector = useMemo(
    () => selectEndorseLockReason(candidate?.district || selectedDistrict),
    [candidate?.district, selectedDistrict]
  );
  const lockReason = useUserStore(lockReasonSelector);
  const canEndorse = lockReason === null;

  // Calculate alignment score and matching details (same algorithm as For You feed)
  // PLAN-10E: Pure quiz-based matching using questionnaireResponses
  const alignmentDetails = useMemo(() => {
    if (!candidate || !currentUser) {
      return { score: null, sharedCount: 0, exactMatches: [], closeMatches: [], notMatched: [] };
    }

    const userResponses = (currentUser.questionnaireResponses || [])
      .map((r) => ({ questionId: r.questionId, issueId: r.issueId, answer: Number(r.answer) }))
      .filter((r) => !isNaN(r.answer));

    const candidateResponses = (candidateUser?.questionnaireResponses || [])
      .map((r) => ({ questionId: r.questionId, issueId: r.issueId, answer: Number(r.answer) }))
      .filter((r) => !isNaN(r.answer));

    const { score, sharedCount, exactMatchIds, closeMatchIds, notMatchedIds } = calculateAlignmentScore({
      candidateResponses,
      userResponses,
    });

    // Map questionIds to issue names for display
    const questionToIssue = new Map<string, string>();
    for (const r of candidateResponses) {
      questionToIssue.set(r.questionId, r.issueId);
    }

    const mapToNames = (ids: string[]) => {
      const seen = new Set<string>();
      const result: { issueId: string; name: string }[] = [];
      for (const qId of ids) {
        const issueId = questionToIssue.get(qId);
        if (!issueId || seen.has(issueId)) continue;
        seen.add(issueId);
        const issue = issues.find((i) => i.id === issueId);
        if (issue) result.push({ issueId, name: issue.name });
      }
      return result;
    };

    return {
      score,
      sharedCount,
      exactMatches: mapToNames(exactMatchIds),
      closeMatches: mapToNames(closeMatchIds),
      notMatched: mapToNames(notMatchedIds),
    };
  }, [candidate, candidateUser, currentUser, issues]);

  // Sync endorsement count when candidate loads
  useEffect(() => {
    if (candidate?.endorsementCount !== undefined) {
      setDisplayedEndorsementCount(candidate.endorsementCount);
    }
  }, [candidate?.endorsementCount]);

  useEffect(() => {
    const fetchCandidateData = async () => {
      if (!id) return;

      try {
        const candidateData = await getCandidate(id);
        setCandidate(candidateData);

        if (candidateData) {
          // Increment view count
          incrementCandidateViews(id);

          // Fetch user data
          const userData = await getUser(candidateData.userId);
          setCandidateUser(userData);

          // Fetch PSAs
          const candidatePSAs = await getCandidatePSAs(id, 'published');
          setPSAs(candidatePSAs);

          // Fetch quiz questions for the candidate's district
          const district = candidateData.district || selectedDistrict;
          const questions = await getActiveQuestions(district);
          setQuizQuestions(questions);
        }
      } catch (error) {
        console.error('Error fetching candidate:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCandidateData();
  }, [id]);

  const handleEndorseToggle = async () => {
    if (!currentUser?.id || !id || isEndorsing) return;

    // Check lock before endorsing (allow revocation even if locked)
    if (!hasEndorsed && !canEndorse) {
      setShowLockModal(true);
      return;
    }

    setIsEndorsing(true);
    try {
      if (hasEndorsed) {
        // Remove endorsement
        const success = await revokeEndorsement(currentUser.id, id, currentRoundId);
        if (success) {
          // Decrement the displayed count immediately for visual feedback
          setDisplayedEndorsementCount((prev) => Math.max(0, prev - 1));
        }
      } else {
        // Add endorsement
        const success = await endorseCandidate(currentUser.id, id, currentRoundId);
        if (success) {
          // Increment the displayed count immediately for visual feedback
          setDisplayedEndorsementCount((prev) => prev + 1);
        }
      }
    } catch (error) {
      console.error('Error toggling endorsement:', error);
    } finally {
      setIsEndorsing(false);
    }
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  // Format number with commas for full display
  const formatWithCommas = (num: number) => {
    return num.toLocaleString();
  };

  const getIssueName = (issueId: string) => {
    return issues.find((i) => i.id === issueId)?.name || issueId;
  };

  const renderSpectrumPosition = (position: number) => {
    // Position from -100 to 100
    const percentage = ((position + 100) / 200) * 100;
    return (
      <View style={styles.spectrumContainer}>
        <View style={[styles.spectrum, { backgroundColor: theme.colors.surfaceVariant }]}>
          <View
            style={[
              styles.spectrumIndicator,
              {
                left: `${percentage}%`,
                backgroundColor: theme.colors.primary,
              },
            ]}
          />
        </View>
        <View style={styles.spectrumLabels}>
          <Text variant="labelSmall" style={{ color: theme.colors.outline }}>
            Progressive
          </Text>
          <Text variant="labelSmall" style={{ color: theme.colors.outline }}>
            Conservative
          </Text>
        </View>
      </View>
    );
  };

  const renderIssuesTab = () => {
    const candidateResponses = candidateUser?.questionnaireResponses || [];
    const userResponses = currentUser?.questionnaireResponses || [];

    // Build lookup maps
    const candidateAnswerMap = new Map<string, number>();
    for (const r of candidateResponses) {
      candidateAnswerMap.set(r.questionId, Number(r.answer));
    }
    const userAnswerMap = new Map<string, number>();
    for (const r of userResponses) {
      userAnswerMap.set(r.questionId, Number(r.answer));
    }

    if (quizQuestions.length === 0 && candidateResponses.length === 0) {
      return (
        <View style={styles.tabContent}>
          <EmptyState
            icon="clipboard-list-outline"
            title="No quiz responses yet"
            message="This candidate hasn't answered their quiz yet"
          />
        </View>
      );
    }

    return (
      <View style={styles.tabContent}>
        {quizQuestions.map((question) => {
          const candidateVal = candidateAnswerMap.get(question.id);
          const userVal = userAnswerMap.get(question.id);
          const hasCandidate = candidateVal !== undefined && !isNaN(candidateVal);
          const hasUser = userVal !== undefined && !isNaN(userVal);

          return (
            <Card key={question.id} style={styles.issueCard}>
              <Text variant="titleSmall" style={{ fontWeight: '600', marginBottom: 10 }}>
                {question.text}
              </Text>
              {(() => {
                // Find closest option for a given spectrum value
                const findClosestId = (val: number | undefined) => {
                  if (val === undefined || isNaN(val) || !question.options?.length) return null;
                  let best = question.options[0];
                  for (const opt of question.options) {
                    if (Math.abs(val - opt.spectrumValue) < Math.abs(val - best.spectrumValue)) best = opt;
                  }
                  return best.id;
                };
                const candidatePickId = hasCandidate ? findClosestId(candidateVal) : null;
                const userPickId = hasUser ? findClosestId(userVal) : null;

                return question.options?.map((option) => {
                const isCandidatePick = option.id === candidatePickId;
                const isUserPick = option.id === userPickId;

                return (
                  <View
                    key={option.id}
                    style={[
                      styles.quizOptionRow,
                      isCandidatePick && { backgroundColor: chipColor, borderRadius: 8 },
                      isUserPick && !isCandidatePick && { backgroundColor: theme.colors.primaryContainer, borderRadius: 8 },
                      isCandidatePick && isUserPick && { backgroundColor: chipColor, borderColor: theme.colors.primary, borderWidth: 2, borderRadius: 8 },
                    ]}
                  >
                    <Text variant="bodyMedium" style={{ flex: 1 }}>
                      <Text style={{ fontWeight: '600' }}>{option.shortLabel}</Text>
                      {'  '}
                      <Text style={{ color: theme.colors.outline, fontSize: 12 }}>{option.text}</Text>
                    </Text>
                    <View style={{ flexDirection: 'row', gap: 4 }}>
                      {isUserPick && (
                        <View style={{ backgroundColor: theme.colors.primary, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 }}>
                          <Text variant="labelSmall" style={{ color: '#fff', fontSize: 10, fontWeight: '600' }}>You</Text>
                        </View>
                      )}
                    </View>
                  </View>
                );
                });
              })()}
              {!hasCandidate && (
                <Text variant="bodySmall" style={{ color: theme.colors.outline, fontStyle: 'italic', marginTop: 4 }}>
                  No response yet
                </Text>
              )}
            </Card>
          );
        })}
      </View>
    );
  };

  const renderBioTab = () => (
    <View style={styles.tabContent}>
      {candidate?.bio?.summary && (
        <Card style={styles.bioCard}>
          <Text variant="titleMedium" style={styles.bioSectionTitle}>
            About
          </Text>
          <Text variant="bodyMedium">{candidate.bio.summary}</Text>
        </Card>
      )}

      {candidate?.bio?.background && (
        <Card style={styles.bioCard}>
          <Text variant="titleMedium" style={styles.bioSectionTitle}>
            Background
          </Text>
          <Text variant="bodyMedium">{candidate.bio.background}</Text>
        </Card>
      )}

      {candidate?.bio?.education && candidate.bio.education.length > 0 && (
        <Card style={styles.bioCard}>
          <Text variant="titleMedium" style={styles.bioSectionTitle}>
            Education
          </Text>
          {candidate.bio.education.map((edu, index) => (
            <View key={index} style={styles.bioItem}>
              <MaterialCommunityIcons
                name="school"
                size={20}
                color={theme.colors.primary}
              />
              <View style={styles.bioItemText}>
                <Text variant="titleSmall">{edu.degree}</Text>
                <Text variant="bodySmall" style={{ color: theme.colors.outline }}>
                  {edu.institution} • {edu.year}
                </Text>
              </View>
            </View>
          ))}
        </Card>
      )}

      {candidate?.bio?.experience && candidate.bio.experience.length > 0 && (
        <Card style={styles.bioCard}>
          <Text variant="titleMedium" style={styles.bioSectionTitle}>
            Experience
          </Text>
          {candidate.bio.experience.map((exp, index) => (
            <View key={index} style={styles.bioItem}>
              <MaterialCommunityIcons
                name="briefcase"
                size={20}
                color={theme.colors.primary}
              />
              <View style={styles.bioItemText}>
                <Text variant="titleSmall">{exp.title}</Text>
                <Text variant="bodySmall" style={{ color: theme.colors.outline }}>
                  {exp.organization} • {exp.startYear} - {exp.endYear || 'Present'}
                </Text>
                {exp.description && (
                  <Text variant="bodySmall" style={{ marginTop: 4 }}>
                    {exp.description}
                  </Text>
                )}
              </View>
            </View>
          ))}
        </Card>
      )}

      {candidate?.reasonForRunning && (
        <Card style={styles.bioCard}>
          <Text variant="titleMedium" style={styles.bioSectionTitle}>
            Why I'm Running
          </Text>
          <Text variant="bodyMedium">{candidate.reasonForRunning}</Text>
        </Card>
      )}
    </View>
  );

  const renderPSAsTab = () => (
    <View style={styles.tabContent}>
      {psas.length > 0 ? (
        <View style={styles.psaGrid}>
          {psas.map((psa) => (
            <Card
              key={psa.id}
              style={styles.psaCard}
              onPress={() => {}}
            >
              <View style={[styles.psaThumbnail, { backgroundColor: theme.colors.surfaceVariant }]}>
                <MaterialCommunityIcons
                  name="play-circle"
                  size={48}
                  color={theme.colors.primary}
                />
              </View>
              <View style={styles.psaInfo}>
                <Text variant="titleSmall" numberOfLines={2}>
                  {psa.title}
                </Text>
                <Text variant="bodySmall" style={{ color: theme.colors.outline }}>
                  {formatNumber(psa.views)} views
                </Text>
              </View>
            </Card>
          ))}
        </View>
      ) : (
        <EmptyState
          icon="video-off"
          title="No PSAs yet"
          message="This candidate hasn't published any videos yet"
        />
      )}
    </View>
  );

  if (isLoading) {
    return <LoadingScreen message="Loading profile..." />;
  }

  if (!candidate) {
    return (
      <EmptyState
        icon="account-question"
        title="Candidate not found"
        message="This candidate profile doesn't exist or has been removed"
        actionLabel="Go Back"
        onAction={() => {
          if (Platform.OS === 'web' && from) {
            router.replace(from as any);
          } else {
            router.back();
          }
        }}
      />
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={['bottom']}
    >
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Back button now handled by AppHeader showBack prop */}

        {/* Profile Header */}
        <View style={styles.header}>
          <CandidateAvatar
            candidateId={id || ''}
            displayName={candidateUser?.displayName || 'Candidate'}
            gender={candidateUser?.gender || inferGenderFromName(candidateUser?.displayName || '')}
            photoUrl={candidate?.photoUrl || candidateUser?.photoUrl}
            spectrumPosition={calculateAverageSpectrum(candidate?.topIssues || [])}
            size={100}
          />
          <Text variant="headlineMedium" style={styles.name}>
            {candidateUser?.displayName || 'Candidate'}
          </Text>

          {/* Stats Row */}
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text variant="titleLarge" style={{ fontWeight: 'bold' }}>
                {formatWithCommas(displayedEndorsementCount)}
              </Text>
              <Text variant="bodySmall" style={{ color: theme.colors.outline }}>
                Endorsements
              </Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text variant="titleLarge" style={{ fontWeight: 'bold' }}>
                {formatNumber(candidate.profileViews)}
              </Text>
              <Text variant="bodySmall" style={{ color: theme.colors.outline }}>
                Views
              </Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <AlignmentBadge score={alignmentDetails.score} size="small" />
              <Text variant="bodySmall" style={{ color: theme.colors.outline, marginTop: 4 }}>
                Match
              </Text>
            </View>
          </View>

          {/* Alignment Breakdown */}
          {alignmentDetails.sharedCount > 0 && (
            <View style={styles.alignmentBreakdown}>
              <Text variant="bodySmall" style={{ color: theme.colors.outline, marginBottom: 8, textAlign: 'center' }}>
                Alignment based on {alignmentDetails.sharedCount} shared responses
              </Text>

              {alignmentDetails.exactMatches.length > 0 && (
                <View style={styles.chipSection}>
                  <Text variant="labelSmall" style={{ color: theme.colors.primary, marginBottom: 4 }}>
                    Exact position matches
                  </Text>
                  <View style={styles.chipsContainer}>
                    {alignmentDetails.exactMatches.map((p) => (
                      <Chip key={p.issueId} style={[styles.chip, { backgroundColor: chipColor }]} textStyle={{ fontSize: 12 }}>
                        {p.name}
                      </Chip>
                    ))}
                  </View>
                </View>
              )}

              {alignmentDetails.closeMatches.length > 0 && (
                <View style={styles.chipSection}>
                  <Text variant="labelSmall" style={{ color: theme.colors.outline, marginBottom: 4 }}>
                    Close matches
                  </Text>
                  <View style={styles.chipsContainer}>
                    {alignmentDetails.closeMatches.map((p) => (
                      <Chip key={p.issueId} style={[styles.chip, { backgroundColor: theme.colors.surfaceVariant }]} textStyle={{ fontSize: 12 }}>
                        {p.name}
                      </Chip>
                    ))}
                  </View>
                </View>
              )}

              {alignmentDetails.notMatched.length > 0 && (
                <View style={styles.chipSection}>
                  <Text variant="labelSmall" style={{ color: theme.colors.error, marginBottom: 4 }}>
                    Not matched
                  </Text>
                  <View style={styles.chipsContainer}>
                    {alignmentDetails.notMatched.map((p) => (
                      <Chip key={p.issueId} style={[styles.chip, { backgroundColor: theme.colors.errorContainer }]} textStyle={{ fontSize: 12, color: theme.colors.onErrorContainer }}>
                        {p.name}
                      </Chip>
                    ))}
                  </View>
                </View>
              )}
            </View>
          )}

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            <PrimaryButton
              onPress={handleEndorseToggle}
              loading={isEndorsing}
              icon={!canEndorse && !hasEndorsed ? 'lock' : hasEndorsed ? 'check' : 'thumb-up'}
              style={[
                styles.endorseButton,
                hasEndorsed && { backgroundColor: theme.colors.surfaceVariant },
                !canEndorse && !hasEndorsed && { backgroundColor: theme.colors.surfaceDisabled || '#e0e0e0' },
              ] as any}
              labelStyle={
                hasEndorsed
                  ? { color: theme.colors.onSurfaceVariant }
                  : !canEndorse
                    ? { color: theme.colors.onSurfaceDisabled || '#999' }
                    : undefined
              }
            >
              {hasEndorsed ? 'Endorsed' : 'Endorse'}
            </PrimaryButton>
            <SecondaryButton
              onPress={() => {}}
              icon="share-variant"
              style={styles.shareButton}
            >
              Share
            </SecondaryButton>
          </View>
        </View>

        {/* Tab Navigation */}
        <View style={styles.tabNavigation}>
          <SegmentedButtons
            value={activeTab}
            onValueChange={(value) => setActiveTab(value as ProfileTab)}
            buttons={[
              { value: 'issues', label: 'Issues' },
              { value: 'bio', label: 'Bio' },
              { value: 'psas', label: 'PSAs' },
            ]}
          />
        </View>

        {/* Tab Content */}
        {activeTab === 'issues' && renderIssuesTab()}
        {activeTab === 'bio' && renderBioTab()}
        {activeTab === 'psas' && renderPSAsTab()}
      </ScrollView>

      <VerifyIdentitySheet
        visible={showLockModal}
        onDismiss={() => setShowLockModal(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  webBackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    paddingHorizontal: 16,
  },
  webBackText: {
    marginLeft: 4,
    color: '#5a3977',
    fontWeight: '600',
  },
  header: {
    alignItems: 'center',
    padding: 24,
    paddingTop: 16,
  },
  name: {
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  stat: {
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  alignmentBreakdown: {
    marginTop: 8,
    marginBottom: 12,
    paddingHorizontal: 8,
  },
  chipSection: {
    marginBottom: 8,
    alignItems: 'center',
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginBottom: 4,
  },
  chip: {
    margin: 4,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  endorseButton: {
    flex: 1,
  },
  shareButton: {
    flex: 1,
  },
  tabNavigation: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  tabContent: {
    padding: 16,
    paddingTop: 0,
  },
  issueCard: {
    marginBottom: 16,
    padding: 16,
  },
  quizOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 4,
  },
  issueHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  issueRank: {
    fontWeight: 'bold',
    marginRight: 12,
    color: '#666',
  },
  issueName: {
    fontWeight: 'bold',
  },
  spectrumContainer: {
    marginTop: 8,
  },
  spectrum: {
    height: 8,
    borderRadius: 4,
    position: 'relative',
  },
  spectrumIndicator: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    top: -4,
    marginLeft: -8,
  },
  spectrumLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  bioCard: {
    marginBottom: 16,
    padding: 16,
  },
  bioSectionTitle: {
    fontWeight: 'bold',
    marginBottom: 12,
  },
  bioItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  bioItemText: {
    flex: 1,
    marginLeft: 12,
  },
  psaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  psaCard: {
    width: (SCREEN_WIDTH - 44) / 2,
    overflow: 'hidden',
  },
  psaThumbnail: {
    aspectRatio: 16 / 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  psaInfo: {
    padding: 12,
  },
  alignmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  tooltipContainer: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 16,
    padding: 20,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  tooltipHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  scoreHighlight: {
    alignItems: 'center',
    padding: 20,
    borderRadius: 12,
  },
  tooltipSection: {
    marginBottom: 8,
  },
  tooltipRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  matchedIssuesList: {
    marginTop: 12,
    marginLeft: 28,
  },
  issueChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  matchedIssueChip: {
    height: 28,
  },
});
