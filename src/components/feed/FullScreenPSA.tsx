import React, { useRef, useState, useMemo } from 'react';
import { View, Pressable, StyleSheet, Image, useWindowDimensions, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from 'react-native-paper';
import { Video, ResizeMode } from 'expo-av';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuthStore, useConfigStore } from '@/stores';
import { useUserStore, selectCanSeeAlignment, selectEndorseLockReason, selectHasAccount } from '@/stores';

// Only match on quiz issues relevant to the browsed district
const DISTRICT_ISSUE_IDS: Record<string, Set<string>> = {
  'PA-01': new Set(['trade', 'iran', 'inflation', 'borders', 'welfare', 'pa01-infrastructure', 'pa01-housing']),
  'PA-02': new Set(['trade', 'iran', 'inflation', 'borders', 'welfare', 'pa02-budget', 'pa02-transit']),
};

const DISTRICT_COLORS: Record<string, string> = {
  'PA-01': '#FFB6C1',
  'PA-02': '#ADD8E6',
};
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
  const isWeb = Platform.OS === 'web';
  const videoRef = useRef<Video>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  const { candidate, psa, alignmentScore, matchedIssues, candidatePositions } = feedItem;

  const currentUser = useAuthStore((s) => s.user);
  const { issues } = useConfigStore();
  const canSeeAlignment = useUserStore(selectCanSeeAlignment);
  const hasAccount = useUserStore(selectHasAccount);
  const endorseCandidate = useUserStore((s) => s.endorseCandidate);
  const revokeEndorsement = useUserStore((s) => s.revokeEndorsement);
  const hasEndorsedCandidate = useUserStore((s) => s.hasEndorsedCandidate);
  const hasEndorsed = hasEndorsedCandidate(candidate.id);
  const lockReasonSelector = useMemo(() => selectEndorseLockReason(candidate.district), [candidate.district]);
  const lockReason = useUserStore(lockReasonSelector);
  const canEndorse = lockReason === null;

  // Find all shared policies where user and candidate align (closeness > 0.5)
  // Use the candidate's actual district for filtering local issues
  const candidateDistrict = candidate.district || 'PA-01';
  const districtIssueIds = DISTRICT_ISSUE_IDS[candidateDistrict] || DISTRICT_ISSUE_IDS['PA-01'];

  const sharedPolicies = useMemo(() => {
    const responses = currentUser?.questionnaireResponses || [];
    if (responses.length === 0 || !candidatePositions?.length) return [];

    const matches: { issueId: string; name: string; closeness: number }[] = [];
    for (const cp of candidatePositions) {
      // Only compare on issues relevant to the candidate's district
      if (!districtIssueIds.has(cp.issueId)) continue;
      const userResp = responses.find((r) => r.issueId === cp.issueId);
      if (!userResp) continue;
      const userVal = Number(userResp.answer);
      if (isNaN(userVal)) continue;
      // Spectrum-mapped closeness: 1 - (|userVal - candidatePos| / 200)
      // Consistent with calculateAlignmentScore in alignment.ts
      const closeness = 1 - Math.abs(userVal - cp.spectrumPosition) / 200;
      if (closeness >= 0.5) {
        const issue = issues.find((i) => i.id === cp.issueId);
        if (issue) matches.push({ issueId: cp.issueId, name: issue.name, closeness });
      }
    }
    return matches.sort((a, b) => b.closeness - a.closeness);
  }, [currentUser?.questionnaireResponses, candidatePositions, issues, districtIssueIds]);

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

      {/* Alignment circle — top left */}
      <AlignmentCircle
        score={canSeeAlignment ? alignmentScore : null}
        style={[styles.alignmentCircle, { top: insets.top + 8 }]}
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
        {sharedPolicies.length > 0 ? (
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
        ) : (
          <>
            <Text style={styles.psaTitle}>Top issues:</Text>
            <View style={styles.issueTags}>
              {candidate.topIssues.slice(0, 3).map((issue) => (
                <View key={issue} style={[styles.sharedPolicyChip, { backgroundColor: DISTRICT_COLORS[candidate.district] || '#FFB6C1' }]}>
                  <Text style={styles.sharedPolicyText}>{issue}</Text>
                </View>
              ))}
            </View>
          </>
        )}
      </View>

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
    height: 200,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  alignmentCircle: {
    position: 'absolute',
    left: 16,
  },
  rightActions: {
    position: 'absolute',
    right: 12,
    bottom: 55,
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
