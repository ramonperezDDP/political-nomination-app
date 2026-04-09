import React, { useRef, useState, useEffect, useMemo } from 'react';
import { StyleSheet, View, Pressable, Dimensions, Platform } from 'react-native';
import { Text, useTheme, IconButton } from 'react-native-paper';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';

import { Card, CandidateAvatar, AlignmentBadge, Chip, PrimaryButton } from '@/components/ui';
import { useAuthStore, useUserStore, useConfigStore, selectCurrentRoundId } from '@/stores';
import { selectEndorseLockReason, selectHasAccount } from '@/stores';
import VerifyIdentitySheet from '../home/VerifyIdentitySheet';
import type { FeedItem, Issue } from '@/types';

interface PSACardProps {
  feedItem: FeedItem;
  isActive?: boolean;
  selectedIssueId?: string | null;
  issues?: Issue[];
}

export default function PSACard({ feedItem, isActive = true, selectedIssueId, issues = [] }: PSACardProps) {
  const theme = useTheme();
  const { user } = useAuthStore();
  const { endorseCandidate, revokeEndorsement } = useUserStore();
  const currentRoundId = useConfigStore(selectCurrentRoundId);
  const videoRef = useRef<Video>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isEndorsing, setIsEndorsing] = useState(false);
  const [displayedEndorsementCount, setDisplayedEndorsementCount] = useState(0);

  const { psa, candidate, alignmentScore, alignedQuestionIds, candidateResponses } = feedItem;

  // Check endorsement status and lock state
  const hasEndorsed = useUserStore((s) => s.endorsements.some(
    (e) => e.candidateId === candidate.id && e.isActive
  ));
  const hasAccount = useUserStore(selectHasAccount);
  const lockReasonSelector = useMemo(() => selectEndorseLockReason(candidate.district), [candidate.district]);
  const lockReason = useUserStore(lockReasonSelector);
  const canEndorse = lockReason === null;
  const [showLockModal, setShowLockModal] = useState(false);

  // Get display content for the selected issue, if any
  const getSelectedIssueContent = () => {
    if (!selectedIssueId) {
      return { title: psa.title, description: psa.description };
    }

    const issueName = issues.find((i) => i.id === selectedIssueId)?.name || 'This Issue';
    return {
      title: `My Position on ${issueName}`,
      description: psa.description,
    };
  };

  const { title: displayTitle, description: displayDescription } = getSelectedIssueContent();

  // Initialize and sync endorsement count
  useEffect(() => {
    setDisplayedEndorsementCount(candidate.endorsementCount);
  }, [candidate.endorsementCount]);

  // Control video playback based on active state
  useEffect(() => {
    if (isActive && videoRef.current) {
      videoRef.current.playAsync();
      setIsPlaying(true);
    } else if (videoRef.current) {
      videoRef.current.pauseAsync();
      setIsPlaying(false);
    }
  }, [isActive]);

  const handlePlayPause = async () => {
    if (!videoRef.current) return;

    if (isPlaying) {
      await videoRef.current.pauseAsync();
    } else {
      await videoRef.current.playAsync();
    }
    setIsPlaying(!isPlaying);
  };

  const handleMuteToggle = async () => {
    if (!videoRef.current) return;
    await videoRef.current.setIsMutedAsync(!isMuted);
    setIsMuted(!isMuted);
  };

  const handleEndorseToggle = async () => {
    if (!user?.id || isEndorsing) return;

    if (!hasEndorsed && !canEndorse) {
      setShowLockModal(true);
      return;
    }

    setIsEndorsing(true);
    try {
      if (hasEndorsed) {
        // Remove endorsement
        const success = await revokeEndorsement(user.id, candidate.id, currentRoundId);
        if (success) {
          // Decrement the displayed count immediately for visual feedback
          setDisplayedEndorsementCount((prev) => Math.max(0, prev - 1));
        }
      } else {
        // Add endorsement
        const success = await endorseCandidate(user.id, candidate.id, currentRoundId);
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

  const handleViewProfile = () => {
    router.push(`/(main)/(feed)/candidate/${candidate.id}` as any);
  };

  const formatViews = (views: number) => {
    if (views >= 1000000) return `${(views / 1000000).toFixed(1)}M`;
    if (views >= 1000) return `${(views / 1000).toFixed(1)}K`;
    return views.toString();
  };

  // Format number with commas for full display
  const formatWithCommas = (num: number) => {
    return num.toLocaleString();
  };

  return (
    <>
    <Card style={styles.card}>
      {/* Video/Media Area */}
      <Pressable onPress={handlePlayPause} style={styles.videoContainer}>
        {psa.videoUrl ? (
          <Video
            ref={videoRef}
            source={{ uri: psa.videoUrl }}
            style={styles.video}
            resizeMode={ResizeMode.COVER}
            isLooping
            shouldPlay={isActive}
            isMuted={isMuted}
          />
        ) : (
          <View style={[styles.videoPlaceholder, { backgroundColor: theme.colors.surfaceVariant }]}>
            <MaterialCommunityIcons
              name="video"
              size={48}
              color={theme.colors.outline}
            />
            <Text variant="bodyMedium" style={{ color: theme.colors.outline, marginTop: 8 }}>
              {displayTitle}
            </Text>
          </View>
        )}

        {/* Video Controls Overlay */}
        {!isPlaying && (
          <View style={styles.playOverlay}>
            <MaterialCommunityIcons name="play" size={64} color="white" />
          </View>
        )}

        {/* Alignment Badge */}
        <View style={styles.alignmentContainer}>
          <AlignmentBadge score={alignmentScore} size="medium" />
        </View>
      </Pressable>

      {/* Info Section */}
      <View style={styles.infoSection}>
        {/* Candidate Info */}
        <Pressable onPress={handleViewProfile} style={styles.candidateRow}>
          <CandidateAvatar
            candidateId={candidate.id}
            displayName={candidate.displayName}
            gender={candidate.gender}
            spectrumPosition={candidate.averageSpectrum}
            size={48}
          />
          <View style={styles.candidateInfo}>
            <Text variant="titleMedium" style={styles.candidateName}>
              {candidate.displayName}
            </Text>
            <View style={styles.statsRow}>
              <MaterialCommunityIcons
                name="thumb-up-outline"
                size={14}
                color={theme.colors.outline}
              />
              <Text variant="bodySmall" style={{ color: theme.colors.outline, marginLeft: 4 }}>
                {formatWithCommas(displayedEndorsementCount)} endorsements
              </Text>
              <Text variant="bodySmall" style={{ color: theme.colors.outline, marginLeft: 12 }}>
                •
              </Text>
              <Text variant="bodySmall" style={{ color: theme.colors.outline, marginLeft: 12 }}>
                {formatViews(psa.views)} views
              </Text>
            </View>
          </View>
          <IconButton
            icon={isMuted ? 'volume-off' : 'volume-high'}
            onPress={handleMuteToggle}
            size={20}
          />
        </Pressable>

        {/* PSA Title & Description */}
        <Text variant="titleSmall" style={styles.psaTitle} numberOfLines={1}>
          {displayTitle}
        </Text>
        <Text
          variant="bodySmall"
          style={{ color: theme.colors.outline }}
          numberOfLines={3}
        >
          {displayDescription}
        </Text>

        {/* Aligned Issues */}
        <View style={styles.matchedIssues}>
          {(alignedQuestionIds || []).slice(0, 3).map((qId) => {
            const issueId = candidateResponses?.find((r) => r.questionId === qId)?.issueId;
            const issueName = issueId ? (issues.find((i) => i.id === issueId)?.name || issueId) : qId;
            return <Chip key={qId} label={issueName} variant="info" style={styles.issueChip} />;
          })}
        </View>

        {/* Action Buttons */}
        <View style={styles.actionRow}>
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
          <IconButton
            icon="share-variant"
            mode="contained-tonal"
            onPress={() => {}}
          />
          <IconButton
            icon="account-details"
            mode="contained-tonal"
            onPress={handleViewProfile}
          />
        </View>
      </View>

    </Card>

    <VerifyIdentitySheet
      visible={showLockModal}
      onDismiss={() => setShowLockModal(false)}
    />
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 16,
    overflow: 'hidden',
  },
  videoContainer: {
    height: 180,
    position: 'relative',
  },
  video: {
    height: 180,
    width: '100%',
  },
  videoPlaceholder: {
    height: 180,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  alignmentContainer: {
    position: 'absolute',
    top: 12,
    right: 12,
  },
  infoSection: {
    padding: 16,
  },
  candidateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  candidateInfo: {
    flex: 1,
    marginLeft: 12,
  },
  candidateName: {
    fontWeight: 'bold',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  psaTitle: {
    fontWeight: '600',
    marginBottom: 4,
  },
  matchedIssues: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
    gap: 8,
  },
  issueChip: {
    marginRight: 0,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    gap: 8,
  },
  endorseButton: {
    flex: 1,
  },
});
