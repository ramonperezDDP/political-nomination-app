import React, { useRef, useState, useEffect } from 'react';
import { StyleSheet, View, Pressable, Dimensions } from 'react-native';
import { Text, useTheme, IconButton } from 'react-native-paper';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';

import { Card, UserAvatar, AlignmentBadge, Chip, PrimaryButton } from '@/components/ui';
import { useAuthStore, useUserStore } from '@/stores';
import type { FeedItem } from '@/types';

interface PSACardProps {
  feedItem: FeedItem;
  isActive?: boolean;
}

export default function PSACard({ feedItem, isActive = true }: PSACardProps) {
  const theme = useTheme();
  const { user } = useAuthStore();
  const { hasEndorsedCandidate, endorseCandidate } = useUserStore();
  const videoRef = useRef<Video>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isEndorsing, setIsEndorsing] = useState(false);
  const [displayedEndorsementCount, setDisplayedEndorsementCount] = useState(0);

  const { psa, candidate, alignmentScore, matchedIssues, hasDealbreaker } = feedItem;

  // Check endorsement status from global store
  const hasEndorsed = hasEndorsedCandidate(candidate.id);

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

  const handleEndorse = async () => {
    if (!user?.id || hasEndorsed || isEndorsing) return;

    setIsEndorsing(true);
    try {
      const success = await endorseCandidate(user.id, candidate.id);
      if (success) {
        // Increment the displayed count immediately for visual feedback
        setDisplayedEndorsementCount((prev) => prev + 1);
      }
    } catch (error) {
      console.error('Error endorsing candidate:', error);
    } finally {
      setIsEndorsing(false);
    }
  };

  const handleViewProfile = () => {
    router.push(`/candidate/${candidate.id}`);
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
              {psa.title}
            </Text>
          </View>
        )}

        {/* Video Controls Overlay */}
        {!isPlaying && (
          <View style={styles.playOverlay}>
            <MaterialCommunityIcons name="play" size={64} color="white" />
          </View>
        )}

        {/* Dealbreaker Warning */}
        {hasDealbreaker && (
          <View style={[styles.dealbreakerBadge, { backgroundColor: theme.colors.error }]}>
            <MaterialCommunityIcons name="alert" size={16} color="white" />
            <Text variant="labelSmall" style={{ color: 'white', marginLeft: 4 }}>
              Dealbreaker
            </Text>
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
          <UserAvatar
            photoUrl={candidate.photoUrl}
            displayName={candidate.displayName}
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
          {psa.title}
        </Text>
        <Text
          variant="bodySmall"
          style={{ color: theme.colors.outline }}
          numberOfLines={2}
        >
          {psa.description}
        </Text>

        {/* Matched Issues */}
        <View style={styles.matchedIssues}>
          {matchedIssues.slice(0, 3).map((issue) => (
            <Chip key={issue} label={issue} variant="info" style={styles.issueChip} />
          ))}
        </View>

        {/* Action Buttons */}
        <View style={styles.actionRow}>
          <PrimaryButton
            onPress={handleEndorse}
            disabled={hasEndorsed}
            loading={isEndorsing}
            icon={hasEndorsed ? 'check' : 'thumb-up'}
            style={styles.endorseButton}
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
  dealbreakerBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
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
