import React, { useState, useEffect } from 'react';
import { StyleSheet, View, FlatList, Pressable } from 'react-native';
import { Text, useTheme, IconButton } from 'react-native-paper';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { useAuthStore, useUserStore } from '@/stores';
import { Card, UserAvatar, EmptyState, LoadingScreen, Chip } from '@/components/ui';
import { getCandidate, getUser } from '@/services/firebase/firestore';
import type { Candidate, User, Endorsement } from '@/types';

interface EndorsedCandidateInfo {
  endorsement: Endorsement;
  candidate: Candidate | null;
  user: User | null;
}

export default function MyEndorsementsScreen() {
  const theme = useTheme();
  const { user: currentUser } = useAuthStore();
  const { endorsements, revokeEndorsement } = useUserStore();

  const [endorsedCandidates, setEndorsedCandidates] = useState<EndorsedCandidateInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [removingId, setRemovingId] = useState<string | null>(null);

  // Fetch candidate details for each endorsement
  useEffect(() => {
    const fetchEndorsedCandidates = async () => {
      setIsLoading(true);
      try {
        const activeEndorsements = endorsements.filter(e => e.isActive);
        const results = await Promise.all(
          activeEndorsements.map(async (endorsement) => {
            const candidate = await getCandidate(endorsement.candidateId);
            const user = candidate ? await getUser(candidate.userId) : null;
            return { endorsement, candidate, user };
          })
        );
        setEndorsedCandidates(results);
      } catch (error) {
        console.error('Error fetching endorsed candidates:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchEndorsedCandidates();
  }, [endorsements]);

  const handleRemoveEndorsement = async (candidateId: string) => {
    if (!currentUser?.id) return;

    setRemovingId(candidateId);
    try {
      await revokeEndorsement(currentUser.id, candidateId);
    } catch (error) {
      console.error('Error removing endorsement:', error);
    } finally {
      setRemovingId(null);
    }
  };

  const handleViewCandidate = (candidateId: string) => {
    router.push(`/candidate/${candidateId}`);
  };

  const renderEndorsementItem = ({ item }: { item: EndorsedCandidateInfo }) => {
    if (!item.candidate) return null;

    const topIssues = item.candidate.topIssues?.slice(0, 3) || [];

    return (
      <Card style={styles.candidateCard}>
        <Pressable
          onPress={() => handleViewCandidate(item.candidate!.id)}
          style={styles.cardContent}
        >
          <UserAvatar
            photoUrl={item.user?.photoUrl}
            displayName={item.user?.displayName || 'Candidate'}
            size={56}
          />
          <View style={styles.candidateInfo}>
            <Text variant="titleMedium" style={styles.candidateName}>
              {item.user?.displayName || 'Unknown Candidate'}
            </Text>
            <View style={styles.statsRow}>
              <MaterialCommunityIcons
                name="thumb-up"
                size={14}
                color={theme.colors.outline}
              />
              <Text variant="bodySmall" style={{ color: theme.colors.outline, marginLeft: 4 }}>
                {item.candidate.endorsementCount?.toLocaleString() || 0} endorsements
              </Text>
            </View>
            <View style={styles.issueChips}>
              {topIssues.map((issue) => (
                <Chip
                  key={issue.issueId}
                  label={issue.issueId.replace(/-/g, ' ')}
                  variant="info"
                  style={styles.chip}
                />
              ))}
            </View>
          </View>
          <IconButton
            icon="close-circle"
            iconColor={theme.colors.error}
            size={24}
            onPress={() => handleRemoveEndorsement(item.candidate!.id)}
            loading={removingId === item.candidate!.id}
            disabled={removingId !== null}
          />
        </Pressable>
      </Card>
    );
  };

  if (isLoading) {
    return <LoadingScreen message="Loading endorsements..." />;
  }

  const activeEndorsements = endorsedCandidates.filter(e => e.candidate !== null);

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={['bottom']}
    >
      <View style={styles.header}>
        <Text variant="bodyMedium" style={{ color: theme.colors.outline }}>
          You have endorsed {activeEndorsements.length} candidate{activeEndorsements.length !== 1 ? 's' : ''}.
          You can remove an endorsement at any time.
        </Text>
      </View>

      {activeEndorsements.length === 0 ? (
        <EmptyState
          icon="thumb-up-outline"
          title="No endorsements yet"
          message="Browse candidates and endorse the ones you support"
          actionLabel="Browse Candidates"
          onAction={() => router.push('/(tabs)/for-you')}
        />
      ) : (
        <FlatList
          data={activeEndorsements}
          renderItem={renderEndorsementItem}
          keyExtractor={(item) => item.endorsement.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 24,
    paddingBottom: 8,
  },
  listContent: {
    padding: 16,
    paddingTop: 8,
  },
  candidateCard: {
    marginBottom: 12,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
  },
  candidateInfo: {
    flex: 1,
    marginLeft: 12,
  },
  candidateName: {
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  issueChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
    gap: 4,
  },
  chip: {
    marginRight: 0,
  },
});
