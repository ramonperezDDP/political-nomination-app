import React, { useRef, useState, useMemo } from 'react';
import { View, Pressable, StyleSheet, Image, useWindowDimensions, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from 'react-native-paper';
import { Video, ResizeMode } from 'expo-av';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/stores';
import { useUserStore, selectCanSeeAlignment, selectEndorseLockReason, selectHasAccount } from '@/stores';
import AlignmentCircle from './AlignmentCircle';
import EndorseLockModal from './EndorseLockModal';
import type { FeedItem } from '@/types';

interface FullScreenPSAProps {
  feedItem: FeedItem;
  isActive: boolean;
  height: number;
}

export default function FullScreenPSA({ feedItem, isActive, height }: FullScreenPSAProps) {
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const videoRef = useRef<Video>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  const { candidate, psa, alignmentScore, matchedIssues, hasDealbreaker } = feedItem;

  const currentUser = useAuthStore((s) => s.user);
  const canSeeAlignment = useUserStore(selectCanSeeAlignment);
  const hasAccount = useUserStore(selectHasAccount);
  const endorseCandidate = useUserStore((s) => s.endorseCandidate);
  const revokeEndorsement = useUserStore((s) => s.revokeEndorsement);
  const hasEndorsedCandidate = useUserStore((s) => s.hasEndorsedCandidate);
  const hasEndorsed = hasEndorsedCandidate(candidate.id);
  const lockReasonSelector = useMemo(() => selectEndorseLockReason(candidate.district), [candidate.district]);
  const lockReason = useUserStore(lockReasonSelector);
  const canEndorse = lockReason === null;

  const [showLockModal, setShowLockModal] = useState(false);

  const handleEndorsePress = () => {
    if (!canEndorse) {
      setShowLockModal(true);
      return;
    }
    if (!currentUser?.id) return;
    if (hasEndorsed) revokeEndorsement(currentUser.id, candidate.id);
    else endorseCandidate(currentUser.id, candidate.id);
  };

  const hasVideo = psa.videoUrl && psa.videoUrl.length > 0;

  return (
    <View style={[styles.container, { height, width: screenWidth }]}>
      {/* Full-screen video background (or photo fallback) */}
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={() => setIsPaused((p) => !p)}
      >
        {hasVideo ? (
          <Video
            ref={videoRef}
            source={{ uri: psa.videoUrl }}
            style={StyleSheet.absoluteFill}
            resizeMode={ResizeMode.COVER}
            shouldPlay={isActive && !isPaused}
            isLooping
            isMuted={isMuted}
          />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.photoFallback]}>
            {candidate.photoUrl ? (
              <Image
                source={{ uri: candidate.photoUrl }}
                style={StyleSheet.absoluteFill}
                resizeMode="cover"
              />
            ) : (
              <View style={[StyleSheet.absoluteFill, { backgroundColor: '#1a1a2e' }]}>
                <MaterialCommunityIcons
                  name="account"
                  size={120}
                  color="rgba(255,255,255,0.15)"
                  style={styles.fallbackIcon}
                />
              </View>
            )}
            <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.4)' }]} />
          </View>
        )}
      </Pressable>

      {/* Gradient overlay at bottom for readability */}
      <View style={styles.bottomGradient} pointerEvents="none" />

      {/* Dealbreaker badge — top left, below status bar */}
      {hasDealbreaker && (
        <View style={[styles.dealbreakerBadge, { top: insets.top + 8 }]}>
          <MaterialCommunityIcons name="alert-circle" size={16} color="#fff" />
          <Text style={styles.dealbreakerText}>Dealbreaker</Text>
        </View>
      )}

      {/* Alignment circle — top left, below dealbreaker */}
      <AlignmentCircle
        score={canSeeAlignment ? alignmentScore : null}
        style={[styles.alignmentCircle, { top: insets.top + (hasDealbreaker ? 40 : 8) }]}
      />

      {/* Right-side action buttons (TikTok style) */}
      <View style={styles.rightActions}>
        {/* Candidate avatar */}
        <Pressable
          onPress={() => router.push(`/candidate/${candidate.id}`)}
          style={styles.actionButton}
        >
          <View style={styles.avatarCircle}>
            {candidate.photoUrl ? (
              <Image
                source={{ uri: candidate.photoUrl }}
                style={styles.avatarImage}
              />
            ) : (
              <MaterialCommunityIcons name="account" size={28} color="#fff" />
            )}
          </View>
        </Pressable>

        {/* Endorse */}
        <Pressable onPress={handleEndorsePress} style={styles.actionButton}>
          <MaterialCommunityIcons
            name={!canEndorse ? 'lock' : hasEndorsed ? 'heart' : 'heart-outline'}
            size={32}
            color={!canEndorse ? 'rgba(255,255,255,0.5)' : hasEndorsed ? '#de482e' : '#fff'}
          />
          <Text style={styles.actionLabel}>
            {candidate.endorsementCount}
          </Text>
        </Pressable>

        {/* Share */}
        <Pressable style={styles.actionButton}>
          <MaterialCommunityIcons name="share" size={28} color="#fff" />
          <Text style={styles.actionLabel}>Share</Text>
        </Pressable>

        {/* Mute toggle (only shown when video exists) */}
        {hasVideo && (
          <Pressable
            onPress={() => setIsMuted((m) => !m)}
            style={styles.actionButton}
          >
            <MaterialCommunityIcons
              name={isMuted ? 'volume-off' : 'volume-high'}
              size={28}
              color="#fff"
            />
          </Pressable>
        )}
      </View>

      {/* Bottom info overlay */}
      <View style={styles.bottomInfo}>
        <Text style={styles.candidateName}>@{candidate.displayName}</Text>
        <Text style={styles.psaTitle}>{psa.title}</Text>
        {matchedIssues.length > 0 && (
          <View style={styles.issueTags}>
            {matchedIssues.slice(0, 3).map((issueId) => (
              <View key={issueId} style={styles.issueTag}>
                <Text style={styles.issueTagText}>
                  {issueId}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Lock modal for endorsement gating */}
      <EndorseLockModal
        visible={showLockModal}
        reason={lockReason}
        hasAccount={hasAccount}
        onDismiss={() => setShowLockModal(false)}
        onSignUp={() => router.push('/(auth)/register')}
        onVerify={() => router.push('/(auth)/verify-identity' as any)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#000',
    position: 'relative',
  },
  photoFallback: {
    backgroundColor: '#1a1a2e',
  },
  fallbackIcon: {
    position: 'absolute',
    top: '35%',
    alignSelf: 'center',
  },
  bottomGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 200,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  dealbreakerBadge: {
    position: 'absolute',
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(244,67,54,0.85)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  dealbreakerText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  alignmentCircle: {
    position: 'absolute',
    left: 16,
  },
  rightActions: {
    position: 'absolute',
    right: 12,
    bottom: 120,
    alignItems: 'center',
    gap: 20,
  },
  actionButton: {
    alignItems: 'center',
  },
  actionLabel: {
    color: '#fff',
    fontSize: 12,
    marginTop: 2,
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
    overflow: 'hidden',
  },
  avatarImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  bottomInfo: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 80,
  },
  candidateName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  psaTitle: {
    color: '#fff',
    fontSize: 14,
    marginTop: 4,
  },
  issueTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  issueTag: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  issueTagText: {
    color: '#fff',
    fontSize: 12,
  },
});
