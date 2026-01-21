import React, { useEffect, useState } from 'react';
import { StyleSheet, View, ScrollView, Dimensions, FlatList } from 'react-native';
import { Text, useTheme, SegmentedButtons, Chip, Divider } from 'react-native-paper';
import { useLocalSearchParams, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import {
  getCandidate,
  getCandidatePSAs,
  incrementCandidateViews,
  getUser,
  createEndorsement,
  hasUserEndorsedCandidate,
} from '@/services/firebase/firestore';
import { useAuthStore, useConfigStore } from '@/stores';
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

  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [candidateUser, setCandidateUser] = useState<User | null>(null);
  const [psas, setPSAs] = useState<PSA[]>([]);
  const [activeTab, setActiveTab] = useState<ProfileTab>('issues');
  const [isLoading, setIsLoading] = useState(true);
  const [hasEndorsed, setHasEndorsed] = useState(false);
  const [isEndorsing, setIsEndorsing] = useState(false);

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

          // Check endorsement status
          if (currentUser?.id) {
            const endorsed = await hasUserEndorsedCandidate(currentUser.id, id);
            setHasEndorsed(endorsed);
          }
        }
      } catch (error) {
        console.error('Error fetching candidate:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCandidateData();
  }, [id, currentUser?.id]);

  const handleEndorse = async () => {
    if (!currentUser?.id || !id || hasEndorsed) return;

    setIsEndorsing(true);
    try {
      await createEndorsement(currentUser.id, id);
      setHasEndorsed(true);
    } catch (error) {
      console.error('Error endorsing:', error);
    } finally {
      setIsEndorsing(false);
    }
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
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
                {formatNumber(candidate.endorsementCount)}
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
              <AlignmentBadge score={85} size="small" />
              <Text variant="bodySmall" style={{ color: theme.colors.outline, marginTop: 4 }}>
                Match
              </Text>
            </View>
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
              onPress={handleEndorse}
              disabled={hasEndorsed}
              loading={isEndorsing}
              icon={hasEndorsed ? 'check' : 'thumb-up'}
              style={styles.endorseButton}
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
});
