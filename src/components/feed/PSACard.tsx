import React, { useRef, useState, useEffect } from 'react';
import { StyleSheet, View, Pressable, Dimensions, Platform } from 'react-native';
import { Text, useTheme, IconButton } from 'react-native-paper';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';

import { Card, CandidateAvatar, AlignmentBadge, Chip, PrimaryButton, Modal } from '@/components/ui';
import { useAuthStore, useUserStore } from '@/stores';
import { DEALBREAKER_MAP } from '@/utils/alignment';
import type { FeedItem, Issue } from '@/types';

const DEALBREAKER_LABELS: Record<string, { name: string; description: string }> = {
  abortion_access:         { name: 'Abortion Access', description: 'Supports unrestricted access to abortion services' },
  abortion_restrictions:   { name: 'Abortion Restrictions', description: 'Supports restrictions or bans on abortion' },
  gun_control:             { name: 'Gun Control', description: 'Supports stricter gun control measures' },
  gun_rights:              { name: 'Gun Rights', description: 'Opposes additional gun control measures' },
  climate_action:          { name: 'Climate Action', description: 'Supports aggressive climate change policies' },
  fossil_fuels:            { name: 'Fossil Fuel Support', description: 'Supports continued fossil fuel development' },
  immigration_restrictive: { name: 'Immigration Restrictions', description: 'Supports stricter immigration enforcement' },
  immigration_permissive:  { name: 'Immigration Reform', description: 'Supports pathway to citizenship' },
  universal_healthcare:    { name: 'Universal Healthcare', description: 'Supports government-run healthcare system' },
  private_healthcare:      { name: 'Private Healthcare', description: 'Supports market-based healthcare solutions' },
  lgbtq_rights:            { name: 'LGBTQ+ Rights', description: 'Supports LGBTQ+ protections and rights' },
  religious_liberty:       { name: 'Religious Liberty', description: 'Prioritizes religious exemptions' },
};

interface PSACardProps {
  feedItem: FeedItem;
  isActive?: boolean;
  selectedIssueId?: string | null;
  issues?: Issue[];
}

export default function PSACard({ feedItem, isActive = true, selectedIssueId, issues = [] }: PSACardProps) {
  const theme = useTheme();
  const { user } = useAuthStore();
  const { hasEndorsedCandidate, endorseCandidate, revokeEndorsement } = useUserStore();
  const videoRef = useRef<Video>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isEndorsing, setIsEndorsing] = useState(false);
  const [displayedEndorsementCount, setDisplayedEndorsementCount] = useState(0);
  const [dealbreakerModalVisible, setDealbreakerModalVisible] = useState(false);

  const { psa, candidate, alignmentScore, matchedIssues, hasDealbreaker, matchedDealbreakers, candidatePositions } = feedItem;

  // Check endorsement status from global store
  const hasEndorsed = hasEndorsedCandidate(candidate.id);

  // Get the position for the selected issue, if any
  const getSelectedIssueContent = () => {
    if (!selectedIssueId || !candidatePositions) {
      return { title: psa.title, description: psa.description };
    }

    const position = candidatePositions.find((p) => p.issueId === selectedIssueId);
    if (!position) {
      return { title: psa.title, description: psa.description };
    }

    const issueName = issues.find((i) => i.id === selectedIssueId)?.name || 'This Issue';
    return {
      title: `My Position on ${issueName}`,
      description: position.position || psa.description,
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

    setIsEndorsing(true);
    try {
      if (hasEndorsed) {
        // Remove endorsement
        const success = await revokeEndorsement(user.id, candidate.id);
        if (success) {
          // Decrement the displayed count immediately for visual feedback
          setDisplayedEndorsementCount((prev) => Math.max(0, prev - 1));
        }
      } else {
        // Add endorsement
        const success = await endorseCandidate(user.id, candidate.id);
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

        {/* Dealbreaker Warning */}
        {hasDealbreaker && (
          <Pressable
            onPress={() => setDealbreakerModalVisible(true)}
            style={[styles.dealbreakerBadge, { backgroundColor: theme.colors.error }]}
            accessibilityRole="button"
            accessibilityLabel="View dealbreaker details"
          >
            <MaterialCommunityIcons name="alert" size={16} color="white" />
            <Text variant="labelSmall" style={{ color: 'white', marginLeft: 4 }}>
              Dealbreaker
            </Text>
          </Pressable>
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

        {/* Matched Issues */}
        <View style={styles.matchedIssues}>
          {matchedIssues.slice(0, 3).map((issue) => (
            <Chip key={issue} label={issue} variant="info" style={styles.issueChip} />
          ))}
        </View>

        {/* Action Buttons */}
        <View style={styles.actionRow}>
          <PrimaryButton
            onPress={handleEndorseToggle}
            loading={isEndorsing}
            icon={hasEndorsed ? 'check' : 'thumb-up'}
            style={[
              styles.endorseButton,
              hasEndorsed && { backgroundColor: theme.colors.surfaceVariant },
            ] as any}
            labelStyle={hasEndorsed ? { color: theme.colors.onSurfaceVariant } : undefined}
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

      {/* Dealbreaker Details */}
      <Modal
        visible={dealbreakerModalVisible}
        onDismiss={() => setDealbreakerModalVisible(false)}
        title="Dealbreaker Details"
        contentStyle={{ maxHeight: undefined }}
      >
        <Text variant="bodyMedium" style={{ color: theme.colors.outline, marginBottom: 16 }}>
          This candidate triggers the following dealbreakers based on your settings:
        </Text>
        {(matchedDealbreakers || []).map((dbId) => {
          const label = DEALBREAKER_LABELS[dbId];
          const mapping = DEALBREAKER_MAP[dbId];
          const position = mapping
            ? candidatePositions.find((p) => p.issueId === mapping.issueId)
            : undefined;

          return (
            <View
              key={dbId}
              style={[styles.dealbreakerItem, { borderBottomColor: theme.colors.outlineVariant }]}
            >
              <View style={styles.dealbreakerItemHeader}>
                <MaterialCommunityIcons
                  name="alert-circle"
                  size={20}
                  color={theme.colors.error}
                />
                <Text variant="titleSmall" style={{ marginLeft: 8, fontWeight: '600' }}>
                  {label?.name || dbId}
                </Text>
              </View>
              <Text variant="bodySmall" style={{ color: theme.colors.outline, marginTop: 4 }}>
                {label?.description}
              </Text>
              {position && (
                <Text variant="bodySmall" style={{ color: theme.colors.onSurface, marginTop: 8 }}>
                  Candidate&apos;s position: {position.position || 'Not specified'}
                </Text>
              )}
            </View>
          );
        })}
      </Modal>
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
  dealbreakerItem: {
    paddingBottom: 12,
    marginBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  dealbreakerItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
