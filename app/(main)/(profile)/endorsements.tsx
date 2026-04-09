import React, { useState, useEffect } from 'react';
import { StyleSheet, View, FlatList, Pressable, Platform } from 'react-native';
import { Text, useTheme, IconButton, SegmentedButtons, Button } from 'react-native-paper';
import { router } from 'expo-router';
import { SafeAreaView as NativeSafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { useAuthStore, useUserStore, useConfigStore, selectFullyVerified } from '@/stores';
import { selectCurrentRoundId } from '@/stores/configStore';
import { Card, UserAvatar, EmptyState, LoadingScreen, Chip } from '@/components/ui';
import VerifyIdentitySheet from '@/components/home/VerifyIdentitySheet';
import { getCandidate, getUser } from '@/services/firebase/firestore';
import type { Candidate, User, Endorsement, Bookmark } from '@/types';

const SafeAreaView = Platform.OS === 'web' ? View : NativeSafeAreaView;

type TabValue = 'endorsements' | 'bookmarks';

interface CandidateInfo {
  candidate: Candidate | null;
  user: User | null;
}

interface EndorsedCandidateInfo extends CandidateInfo {
  endorsement: Endorsement;
}

interface BookmarkedCandidateInfo extends CandidateInfo {
  bookmark: Bookmark;
}

export default function MyEndorsementsScreen() {
  const theme = useTheme();
  const { user: currentUser } = useAuthStore();
  const { endorsements, bookmarks, revokeEndorsement, removeBookmark, reEndorseFromBookmark, fetchBookmarks } = useUserStore();
  const currentRoundId = useConfigStore(selectCurrentRoundId);

  const selectedDistrict = useUserStore((s) => s.selectedBrowsingDistrict) || 'PA-01';

  const isFullyVerified = useUserStore(selectFullyVerified);

  const [activeTab, setActiveTab] = useState<TabValue>('endorsements');
  const [endorsedCandidates, setEndorsedCandidates] = useState<EndorsedCandidateInfo[]>([]);
  const [bookmarkedCandidates, setBookmarkedCandidates] = useState<BookmarkedCandidateInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [showVerifySheet, setShowVerifySheet] = useState(false);
  const [endorsingAll, setEndorsingAll] = useState(false);

  // Fetch bookmarks on mount
  useEffect(() => {
    if (currentUser?.id) {
      fetchBookmarks(currentUser.id);
    }
  }, [currentUser?.id]);

  // Fetch candidate details for endorsements
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

  // Fetch candidate details for bookmarks
  useEffect(() => {
    const fetchBookmarkedCandidates = async () => {
      try {
        const results = await Promise.all(
          bookmarks.map(async (bookmark) => {
            const candidate = await getCandidate(bookmark.candidateId);
            const user = candidate ? await getUser(candidate.userId) : null;
            return { bookmark, candidate, user };
          })
        );
        setBookmarkedCandidates(results);
      } catch (error) {
        console.error('Error fetching bookmarked candidates:', error);
      }
    };

    fetchBookmarkedCandidates();
  }, [bookmarks]);

  const handleRemoveEndorsement = async (candidateId: string) => {
    if (!currentUser?.id) return;
    setActionId(candidateId);
    try {
      await revokeEndorsement(currentUser.id, candidateId, currentRoundId);
    } finally {
      setActionId(null);
    }
  };

  const handleRemoveBookmark = async (candidateId: string) => {
    if (!currentUser?.id) return;
    setActionId(candidateId);
    try {
      await removeBookmark(currentUser.id, candidateId);
    } finally {
      setActionId(null);
    }
  };

  const handleReEndorse = async (candidateId: string) => {
    if (!currentUser?.id) return;
    setActionId(candidateId);
    try {
      await reEndorseFromBookmark(currentUser.id, candidateId, currentRoundId);
    } finally {
      setActionId(null);
    }
  };

  const activeEndorsements = endorsedCandidates.filter(e => e.candidate !== null && e.candidate.district === selectedDistrict);
  const activeBookmarks = bookmarkedCandidates.filter(b => b.candidate !== null && b.candidate.district === selectedDistrict);

  const handleEndorseAll = async () => {
    if (!isFullyVerified) {
      setShowVerifySheet(true);
      return;
    }
    if (!currentUser?.id || endorsingAll) return;
    setEndorsingAll(true);
    try {
      // Endorse all non-eliminated bookmarked candidates that aren't already endorsed
      const endorsable = activeBookmarks.filter(b => {
        if (!b.candidate || b.candidate.contestStatus === 'eliminated') return false;
        return !endorsements.some(e => e.candidateId === b.candidate!.id && e.isActive);
      });
      for (const item of endorsable) {
        await reEndorseFromBookmark(currentUser.id, item.candidate!.id, currentRoundId);
      }
    } finally {
      setEndorsingAll(false);
    }
  };

  const handleViewCandidate = (candidateId: string) => {
    router.push(
      Platform.OS === 'web'
        ? `/(main)/(feed)/candidate/${candidateId}`
        : `/(main)/(feed)/candidate/${candidateId}`
    );
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
                color={theme.colors.primary}
              />
              <Text variant="bodySmall" style={{ color: theme.colors.primary, marginLeft: 4, fontWeight: '600' }}>
                Endorsed
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
            loading={actionId === item.candidate!.id}
            disabled={actionId !== null}
          />
        </Pressable>
      </Card>
    );
  };

  const renderBookmarkItem = ({ item }: { item: BookmarkedCandidateInfo }) => {
    if (!item.candidate) return null;

    const isEliminated = item.candidate.contestStatus === 'eliminated';
    const topIssues = item.candidate.topIssues?.slice(0, 3) || [];

    return (
      <Card style={[styles.candidateCard, isEliminated && styles.eliminatedCard]}>
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
            <View style={styles.nameRow}>
              <Text variant="titleMedium" style={[styles.candidateName, isEliminated && { color: theme.colors.outline }]}>
                {item.user?.displayName || 'Unknown Candidate'}
              </Text>
              {isEliminated && (
                <Text variant="labelSmall" style={{ color: theme.colors.error, fontWeight: '600' }}>
                  Eliminated
                </Text>
              )}
            </View>
            {item.bookmark.convertedFromRoundId && (
              <Text variant="bodySmall" style={{ color: theme.colors.outline, marginTop: 2 }}>
                Endorsed in {item.bookmark.convertedFromRoundId.replace(/_/g, ' ')}
              </Text>
            )}
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
          <View style={styles.bookmarkActions}>
            {!isEliminated && (
              <Button
                mode="outlined"
                compact
                onPress={() => handleReEndorse(item.candidate!.id)}
                loading={actionId === item.candidate!.id}
                disabled={actionId !== null}
                style={styles.reEndorseButton}
                labelStyle={styles.reEndorseLabel}
              >
                Re-endorse
              </Button>
            )}
            <IconButton
              icon="bookmark-remove"
              iconColor={theme.colors.outline}
              size={20}
              onPress={() => handleRemoveBookmark(item.candidate!.id)}
              disabled={actionId !== null}
            />
          </View>
        </Pressable>
      </Card>
    );
  };

  if (isLoading) {
    return <LoadingScreen message="Loading..." />;
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={['bottom']}
    >
      <View style={styles.header}>
        <SegmentedButtons
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as TabValue)}
          buttons={[
            {
              value: 'endorsements',
              label: `Endorsements (${activeEndorsements.length})`,
              icon: 'thumb-up',
            },
            {
              value: 'bookmarks',
              label: `Bookmarks (${activeBookmarks.length})`,
              icon: 'bookmark',
            },
          ]}
          style={styles.segmentedButtons}
        />
      </View>

      {activeTab === 'endorsements' ? (
        activeEndorsements.length === 0 ? (
          <EmptyState
            icon="thumb-up-outline"
            title="No endorsements this round"
            message="You haven't endorsed anyone this round yet. Browse candidates and endorse the ones you support."
            actionLabel="Browse Candidates"
            onAction={() => router.push('/(main)/(feed)' as any)}
          />
        ) : (
          <FlatList
            data={activeEndorsements}
            renderItem={renderEndorsementItem}
            keyExtractor={(item) => item.endorsement.id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        )
      ) : (
        activeBookmarks.length === 0 ? (
          <EmptyState
            icon="bookmark-outline"
            title="No bookmarks yet"
            message="Bookmarks are created when endorsements carry over between rounds, or when you manually bookmark a candidate."
          />
        ) : (
          <>
            <View style={styles.endorseAllContainer}>
              <Button
                mode="contained"
                icon="thumb-up"
                onPress={handleEndorseAll}
                loading={endorsingAll}
                disabled={endorsingAll}
                style={styles.endorseAllButton}
              >
                Endorse All
              </Button>
            </View>
            <FlatList
              data={activeBookmarks}
              renderItem={renderBookmarkItem}
              keyExtractor={(item) => item.bookmark.id}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
            />
          </>
        )
      )}

      <VerifyIdentitySheet
        visible={showVerifySheet}
        onDismiss={() => setShowVerifySheet(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 16,
    paddingBottom: 8,
  },
  segmentedButtons: {
    marginBottom: 4,
  },
  listContent: {
    padding: 16,
    paddingTop: 8,
  },
  candidateCard: {
    marginBottom: 12,
  },
  eliminatedCard: {
    opacity: 0.6,
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
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
  bookmarkActions: {
    alignItems: 'center',
  },
  reEndorseButton: {
    borderRadius: 16,
  },
  reEndorseLabel: {
    fontSize: 11,
  },
  endorseAllContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  endorseAllButton: {
    borderRadius: 24,
  },
});
