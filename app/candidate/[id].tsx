import React, { useEffect, useState, useMemo } from 'react';
import { StyleSheet, View, ScrollView, Dimensions, FlatList, Pressable, Modal } from 'react-native';
import { Text, useTheme, SegmentedButtons, Chip, Divider, IconButton, Portal } from 'react-native-paper';
import { useLocalSearchParams, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import {
  getCandidate,
  getCandidatePSAs,
  incrementCandidateViews,
  getUser,
} from '@/services/firebase/firestore';
import { useAuthStore, useConfigStore, useUserStore } from '@/stores';
import {
  Card,
  UserAvatar,
  AlignmentBadge,
  PrimaryButton,
  SecondaryButton,
  LoadingScreen,
  EmptyState,
} from '@/components/ui';
import type { Candidate, PSA, User, TopIssue } from '@/types';

type ProfileTab = 'issues' | 'bio' | 'psas';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function CandidateProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const { user: currentUser } = useAuthStore();
  const { issues } = useConfigStore();
  const { hasEndorsedCandidate, endorseCandidate, revokeEndorsement } = useUserStore();

  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [candidateUser, setCandidateUser] = useState<User | null>(null);
  const [psas, setPSAs] = useState<PSA[]>([]);
  const [activeTab, setActiveTab] = useState<ProfileTab>('issues');
  const [isLoading, setIsLoading] = useState(true);
  const [isEndorsing, setIsEndorsing] = useState(false);
  const [displayedEndorsementCount, setDisplayedEndorsementCount] = useState(0);
  const [showAlignmentTooltip, setShowAlignmentTooltip] = useState(false);

  // Check endorsement status from global store
  const hasEndorsed = id ? hasEndorsedCandidate(id) : false;

  // Calculate alignment score and matching details
  const alignmentDetails = useMemo(() => {
    if (!candidate || !currentUser) {
      return { score: 0, matchedIssues: [], hasDealbreaker: false, matchedIssueNames: [] };
    }

    const candidateIssueIds = candidate.topIssues?.map((ti) => ti.issueId) || [];
    const userIssues = currentUser.selectedIssues || [];
    const userDealbreakers = currentUser.dealbreakers || [];

    const matchedIssues = candidateIssueIds.filter((id) => userIssues.includes(id));
    const matchRatio = userIssues.length > 0 ? matchedIssues.length / userIssues.length : 0;

    // Check for dealbreakers
    const hasDealbreaker = userDealbreakers.some((dealbreaker) => {
      const position = candidate.topIssues?.find((p) => p.issueId === dealbreaker);
      return position && Math.abs(position.spectrumPosition) > 80;
    });

    // Calculate score
    const matchBonus = matchedIssues.length * 12;
    const ratioBonus = matchRatio * 25;
    const baseScore = Math.round(40 + matchBonus + ratioBonus);
    const score = Math.min(100, Math.max(0, baseScore));

    // Get matched issue names for display
    const matchedIssueNames = matchedIssues.map(
      (issueId) => issues.find((i) => i.id === issueId)?.name || issueId
    );

    return { score, matchedIssues, hasDealbreaker, matchedIssueNames, userIssueCount: userIssues.length };
  }, [candidate, currentUser, issues]);

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

    setIsEndorsing(true);
    try {
      if (hasEndorsed) {
        // Remove endorsement
        const success = await revokeEndorsement(currentUser.id, id);
        if (success) {
          // Decrement the displayed count immediately for visual feedback
          setDisplayedEndorsementCount((prev) => Math.max(0, prev - 1));
        }
      } else {
        // Add endorsement
        const success = await endorseCandidate(currentUser.id, id);
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

  const renderIssuesTab = () => (
    <View style={styles.tabContent}>
      {candidate?.topIssues?.map((topIssue, index) => (
        <Card key={topIssue.issueId} style={styles.issueCard}>
          <View style={styles.issueHeader}>
            <Text variant="titleLarge" style={styles.issueRank}>
              #{index + 1}
            </Text>
            <Text variant="titleMedium" style={styles.issueName}>
              {getIssueName(topIssue.issueId)}
            </Text>
          </View>
          <Text variant="bodyMedium" style={{ color: theme.colors.outline, marginBottom: 16 }}>
            {topIssue.position}
          </Text>
          {renderSpectrumPosition(topIssue.spectrumPosition)}
        </Card>
      ))}

      {(!candidate?.topIssues || candidate.topIssues.length === 0) && (
        <EmptyState
          icon="clipboard-list-outline"
          title="No issues listed"
          message="This candidate hasn't added their issue positions yet"
        />
      )}
    </View>
  );

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
        onAction={() => router.back()}
      />
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={['bottom']}
    >
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Profile Header */}
        <View style={styles.header}>
          <UserAvatar
            photoUrl={candidateUser?.photoUrl}
            displayName={candidateUser?.displayName || 'Candidate'}
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
            <Pressable
              style={styles.stat}
              onPress={() => setShowAlignmentTooltip(true)}
              accessibilityRole="button"
              accessibilityLabel={`${alignmentDetails.score}% match. Tap for details.`}
            >
              <View style={styles.alignmentRow}>
                <AlignmentBadge score={alignmentDetails.score} size="small" />
                <MaterialCommunityIcons
                  name="information-outline"
                  size={16}
                  color={theme.colors.primary}
                  style={{ marginLeft: 4 }}
                />
              </View>
              <Text variant="bodySmall" style={{ color: theme.colors.outline, marginTop: 4 }}>
                Match
              </Text>
            </Pressable>
          </View>

          {/* Top Issues Chips */}
          <View style={styles.chipsContainer}>
            {candidate.topIssues?.slice(0, 3).map((issue) => (
              <Chip key={issue.issueId} style={styles.chip}>
                {getIssueName(issue.issueId)}
              </Chip>
            ))}
          </View>

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            <PrimaryButton
              onPress={handleEndorseToggle}
              loading={isEndorsing}
              icon={hasEndorsed ? 'check' : 'thumb-up'}
              style={[
                styles.endorseButton,
                hasEndorsed && { backgroundColor: theme.colors.surfaceVariant },
              ]}
              labelStyle={hasEndorsed ? { color: theme.colors.onSurfaceVariant } : undefined}
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

      {/* Alignment Score Tooltip Modal */}
      <Modal
        visible={showAlignmentTooltip}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAlignmentTooltip(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowAlignmentTooltip(false)}
        >
          <Pressable
            style={[styles.tooltipContainer, { backgroundColor: theme.colors.surface }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.tooltipHeader}>
              <Text variant="titleMedium" style={{ fontWeight: 'bold' }}>
                Alignment Score Explained
              </Text>
              <IconButton
                icon="close"
                size={20}
                onPress={() => setShowAlignmentTooltip(false)}
              />
            </View>

            <View style={[styles.scoreHighlight, { backgroundColor: theme.colors.primaryContainer }]}>
              <Text variant="displaySmall" style={{ fontWeight: 'bold', color: theme.colors.primary }}>
                {alignmentDetails.score}%
              </Text>
              <Text variant="bodyMedium" style={{ color: theme.colors.onPrimaryContainer }}>
                Overall Match
              </Text>
            </View>

            <Divider style={{ marginVertical: 16 }} />

            <View style={styles.tooltipSection}>
              <View style={styles.tooltipRow}>
                <MaterialCommunityIcons
                  name="checkbox-marked-circle"
                  size={20}
                  color={theme.colors.primary}
                />
                <Text variant="bodyMedium" style={{ marginLeft: 8, flex: 1 }}>
                  <Text style={{ fontWeight: 'bold' }}>{alignmentDetails.matchedIssues.length}</Text> of{' '}
                  <Text style={{ fontWeight: 'bold' }}>{alignmentDetails.userIssueCount || 0}</Text> priority issues match
                </Text>
              </View>

              {alignmentDetails.matchedIssueNames.length > 0 && (
                <View style={styles.matchedIssuesList}>
                  <Text variant="labelMedium" style={{ color: theme.colors.outline, marginBottom: 8 }}>
                    Matching Issues:
                  </Text>
                  <View style={styles.issueChipsWrap}>
                    {alignmentDetails.matchedIssueNames.map((name) => (
                      <Chip
                        key={name}
                        style={styles.matchedIssueChip}
                        textStyle={{ fontSize: 12 }}
                      >
                        {name}
                      </Chip>
                    ))}
                  </View>
                </View>
              )}

              {alignmentDetails.hasDealbreaker && (
                <View style={[styles.tooltipRow, { marginTop: 12 }]}>
                  <MaterialCommunityIcons
                    name="alert-circle"
                    size={20}
                    color={theme.colors.error}
                  />
                  <Text variant="bodyMedium" style={{ marginLeft: 8, color: theme.colors.error }}>
                    Contains a dealbreaker position
                  </Text>
                </View>
              )}
            </View>

            <Divider style={{ marginVertical: 16 }} />

            <Text variant="bodySmall" style={{ color: theme.colors.outline, textAlign: 'center' }}>
              Score is based on shared policy priorities between you and this candidate.
            </Text>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginBottom: 16,
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
