import React, { useRef, useState, useMemo } from 'react';
import { View, Pressable, StyleSheet, Image, useWindowDimensions, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from 'react-native-paper';
import { Video, ResizeMode } from 'expo-av';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuthStore, useConfigStore, selectCurrentRoundId } from '@/stores';
import { useUserStore, selectCanSeeAlignment, selectEndorseLockReason, selectHasAccount } from '@/stores';

const DISTRICT_COLORS: Record<string, string> = {
  'PA-01': '#FFB6C1',
  'PA-02': '#ADD8E6',
};
import AlignmentCircle from './AlignmentCircle';
import AlignmentExplainerModal from './AlignmentExplainerModal';
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
  const isWeb = Platform.OS === 'web';
  const videoRef = useRef<Video>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  const { candidate, psa, alignmentScore, alignedQuestionIds, candidateResponses, sharedCount, exactMatchIds, closeMatchIds, notMatchedIds } = feedItem;

  const currentUser = useAuthStore((s) => s.user);
  const { issues } = useConfigStore();
  const currentRoundId = useConfigStore(selectCurrentRoundId);
  const canSeeAlignment = useUserStore(selectCanSeeAlignment);
  const hasAccount = useUserStore(selectHasAccount);
  const endorseCandidate = useUserStore((s) => s.endorseCandidate);
  const revokeEndorsement = useUserStore((s) => s.revokeEndorsement);
  const hasEndorsed = useUserStore((s) => s.endorsements.some(
    (e) => e.candidateId === candidate.id && e.isActive
  ));
  const bookmarkCandidate = useUserStore((s) => s.bookmarkCandidate);
  const removeBookmark = useUserStore((s) => s.removeBookmark);
  const isBookmarked = useUserStore((s) => s.bookmarks.some(
    (b) => b.candidateId === candidate.id
  ));
  const lockReasonSelector = useMemo(() => selectEndorseLockReason(candidate.district), [candidate.district]);
  const lockReason = useUserStore(lockReasonSelector);
  const canEndorse = lockReason === null;

  // Derive shared policy chip names from pre-computed alignedQuestionIds
  const sharedPolicies = useMemo(() => {
    if (!alignedQuestionIds || alignedQuestionIds.length === 0) return [];

    // Map questionId -> issueId via candidateResponses
    const questionToIssue = new Map<string, string>();
    for (const r of candidateResponses || []) {
      questionToIssue.set(r.questionId, r.issueId);
    }

    const seen = new Set<string>();
    const result: { issueId: string; name: string }[] = [];
    for (const qId of alignedQuestionIds) {
      const issueId = questionToIssue.get(qId);
      if (!issueId || seen.has(issueId)) continue;
      seen.add(issueId);
      const issue = issues.find((i) => i.id === issueId);
      if (issue) result.push({ issueId, name: issue.name });
    }
    return result;
  }, [alignedQuestionIds, candidateResponses, issues]);

  const [showLockModal, setShowLockModal] = useState(false);
  const [showAlignmentModal, setShowAlignmentModal] = useState(false);

  // Derive alignment breakdown from feedItem IDs for the explainer modal
  const alignmentBreakdown = useMemo(() => {
    const questionToIssue = new Map<string, string>();
    for (const r of candidateResponses || []) {
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
      exactMatches: mapToNames(exactMatchIds || []),
      closeMatches: mapToNames(closeMatchIds || []),
      notMatched: mapToNames(notMatchedIds || []),
    };
  }, [exactMatchIds, closeMatchIds, notMatchedIds, candidateResponses, issues]);

  const handleEndorsePress = () => {
    if (!canEndorse) {
      setShowLockModal(true);
      return;
    }
    if (!currentUser?.id) return;
    if (hasEndorsed) revokeEndorsement(currentUser.id, candidate.id, currentRoundId);
    else endorseCandidate(currentUser.id, candidate.id, currentRoundId);
  };

  const handleBookmarkPress = () => {
    if (!currentUser?.id) return;
    if (isBookmarked) removeBookmark(currentUser.id, candidate.id);
    else bookmarkCandidate(currentUser.id, candidate.id);
  };

  const hasVideo = psa.videoUrl && psa.videoUrl.length > 0;

  return (
    <View style={[styles.container, { height, width: isWeb ? '100%' as any : screenWidth }]}>
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

      {/* Alignment circle — top left, tappable to show breakdown */}
      {/* On web, insets.top is 0 but AppHeader is outside the card, so use a fixed offset */}
      <AlignmentCircle
        score={canSeeAlignment ? alignmentScore : null}
        style={[styles.alignmentCircle, { top: isWeb ? 52 : insets.top + 8 }]}
        onPress={canSeeAlignment ? () => setShowAlignmentModal(true) : undefined}
      />

      {/* Right-side action buttons (TikTok style) */}
      <View style={styles.rightActions}>
        {/* Candidate avatar */}
        <Pressable
          onPress={() => router.push(
            Platform.OS === 'web'
              ? `/(main)/(feed)/candidate/${candidate.id}`
              : `/(main)/(feed)/candidate/${candidate.id}`
          )}
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

        {/* Bookmark */}
        <Pressable onPress={handleBookmarkPress} style={styles.actionButton}>
          <MaterialCommunityIcons
            name={isBookmarked ? 'bookmark' : 'bookmark-outline'}
            size={28}
            color={isBookmarked ? '#ffd700' : '#fff'}
          />
          <Text style={styles.actionLabel}>
            {isBookmarked ? 'Saved' : 'Save'}
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
        <Text style={styles.candidateName}>{candidate.displayName}</Text>
        {sharedPolicies.length > 0 && (
          <>
            <Text style={styles.psaTitle}>Shares my position on:</Text>
            <View style={styles.issueTags}>
              {sharedPolicies.map((policy) => (
                <View
                  key={policy.issueId}
                  style={[styles.sharedPolicyChip, { backgroundColor: DISTRICT_COLORS[candidate.district] || '#FFB6C1' }]}
                >
                  <Text style={styles.sharedPolicyText}>{policy.name}</Text>
                </View>
              ))}
            </View>
          </>
        )}
      </View>

      {/* Alignment explainer modal — tappable from alignment circle */}
      {showAlignmentModal && (
        <AlignmentExplainerModal
          visible={showAlignmentModal}
          onDismiss={() => setShowAlignmentModal(false)}
          score={alignmentScore}
          sharedCount={sharedCount}
          exactMatches={alignmentBreakdown.exactMatches}
          closeMatches={alignmentBreakdown.closeMatches}
          notMatched={alignmentBreakdown.notMatched}
          candidateName={candidate.displayName}
        />
      )}

      {/* Lock modal for endorsement gating — only mount when needed to avoid Portal blocking tab bar */}
      {showLockModal && (
        <EndorseLockModal
          visible={showLockModal}
          reason={lockReason}
          hasAccount={hasAccount}
          onDismiss={() => setShowLockModal(false)}
          onSignUp={() => router.push('/(auth)/register')}
          onVerify={() => router.push('/(auth)/verify-identity' as any)}
        />
      )}
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
    height: Platform.OS === 'web' ? 180 : 200,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  alignmentCircle: {
    position: 'absolute',
    left: 16,
  },
  rightActions: {
    position: 'absolute',
    right: 12,
    bottom: Platform.OS === 'web' ? 16 : 55,
    alignItems: 'center',
    gap: Platform.OS === 'web' ? 12 : 20,
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
    width: Platform.OS === 'web' ? 40 : 48,
    height: Platform.OS === 'web' ? 40 : 48,
    borderRadius: Platform.OS === 'web' ? 20 : 24,
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
  sharedPolicyChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
  },
  sharedPolicyText: {
    color: '#333',
    fontSize: 12,
    fontWeight: '600',
  },
});
