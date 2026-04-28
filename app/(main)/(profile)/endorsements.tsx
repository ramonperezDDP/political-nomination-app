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
import EndorseConfirmModal from '@/components/feed/EndorseConfirmModal';
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
  const { endorsements, bookmarks, removeBookmark, reEndorseFromBookmark, fetchBookmarks } = useUserStore();
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
  const [pendingEndorse, setPendingEndorse] = useState<{ candidateId: string; name: string } | null>(null);
  const [showEndorseAllConfirm, setShowEndorseAllConfirm] = useState(false);

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

  const handleRemoveBookmark = async (candidateId: string) => {
    if (!currentUser?.id) return;
    setActionId(candidateId);
    try {
      await removeBookmark(currentUser.id, candidateId);
    } finally {
      setActionId(null);
    }
  };

  const handleReEndorsePress = (candidateId: string, name: string) => {
    if (!isFullyVerified) {
      setShowVerifySheet(true);
      return;
    }
    setPendingEndorse({ candidateId, name });
  };

  const handleConfirmReEndorse = async () => {
    if (!currentUser?.id || !pendingEndorse) return;
    const { candidateId } = pendingEndorse;
    setActionId(candidateId);
    try {
      await reEndorseFromBookmark(currentUser.id, candidateId, currentRoundId);
    } finally {
      setActionId(null);
      setPendingEndorse(null);
    }
  };

  const activeEndorsements = endorsedCandidates.filter(e => e.candidate !== null && e.candidate.district === selectedDistrict);
  const activeBookmarks = bookmarkedCandidates.filter(b => b.candidate !== null && b.candidate.district === selectedDistrict);

  const endorsableBookmarks = activeBookmarks.filter(b => {
    if (!b.candidate || b.candidate.contestStatus === 'eliminated') return false;
    return !endorsements.some(e => e.candidateId === b.candidate!.id && e.isActive);
  });

  const handleEndorseAllPress = () => {
    if (!isFullyVerified) {
      setShowVerifySheet(true);
      return;
    }
    if (!currentUser?.id || endorsingAll || endorsableBookmarks.length === 0) return;
    setShowEndorseAllConfirm(true);
  };

  const handleConfirmEndorseAll = async () => {
    if (!currentUser?.id || endorsingAll) return;
    setEndorsingAll(true);
    try {
      for (const item of endorsableBookmarks) {
        await reEndorseFromBookmark(currentUser.id, item.candidate!.id, currentRoundId);
      }
    } finally {
      setEndorsingAll(false);
      setShowEndorseAllConfirm(false);
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
                Endorsed (final this round)
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
          <MaterialCommunityIcons
            name="lock-check"
            size={20}
            color={theme.colors.primary}
            style={styles.endorsedLock}
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
                onPress={() => handleReEndorsePress(item.candidate!.id, item.user?.displayName || 'this candidate')}
                loading={actionId === item.candidate!.id}
                disabled={actionId !== null}
                style={styles.reEndorseButton}
                labelStyle={styles.reEndorseLabel}
              >
                Endorse
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
            message="Save candidates you're interested in, then endorse them from the Bookmarks tab when you're ready. Endorsements are final once made."
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
            message="Save candidates you're interested in. When you're ready to commit, endorse them from here — endorsements are final for the round."
          />
        ) : (
          <>
            <View style={styles.endorseAllContainer}>
              <Button
                mode="contained"
                icon="thumb-up"
                onPress={handleEndorseAllPress}
                loading={endorsingAll}
                disabled={endorsingAll || endorsableBookmarks.length === 0}
                style={styles.endorseAllButton}
              >
                {endorsableBookmarks.length > 0
                  ? `Endorse All (${endorsableBookmarks.length})`
                  : 'Endorse All'}
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

      {pendingEndorse && (
        <EndorseConfirmModal
          visible={pendingEndorse !== null}
          onDismiss={() => setPendingEndorse(null)}
          onConfirm={handleConfirmReEndorse}
          candidateName={pendingEndorse.name}
          loading={actionId !== null}
        />
      )}

      {showEndorseAllConfirm && (
        <EndorseConfirmModal
          visible={showEndorseAllConfirm}
          onDismiss={() => setShowEndorseAllConfirm(false)}
          onConfirm={handleConfirmEndorseAll}
          candidateCount={endorsableBookmarks.length}
          loading={endorsingAll}
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
  endorsedLock: {
    marginRight: 12,
    marginTop: 4,
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
