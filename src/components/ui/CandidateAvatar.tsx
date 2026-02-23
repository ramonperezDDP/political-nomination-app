import React, { useMemo, useState } from 'react';
import { StyleSheet, View, ViewStyle, Text, Image } from 'react-native';
import { useTheme } from 'react-native-paper';
import type { Gender } from '@/types';

interface CandidateAvatarProps {
  candidateId: string;
  displayName: string;
  gender?: Gender;
  spectrumPosition?: number; // -100 (progressive) to 100 (conservative)
  size?: number;
  style?: ViewStyle;
}

// DiceBear avataaars hairstyle options
const FEMALE_HAIRSTYLES = [
  'longHairBigHair',
  'longHairBob',
  'longHairBun',
  'longHairCurly',
  'longHairCurvy',
  'longHairDreads',
  'longHairFrida',
  'longHairFro',
  'longHairFroBand',
  'longHairMiaWallace',
  'longHairNotTooLong',
  'longHairShavedSides',
  'longHairStraight',
  'longHairStraight2',
  'longHairStraightStrand',
];

const MALE_HAIRSTYLES = [
  'shortHairDreads01',
  'shortHairDreads02',
  'shortHairFrizzle',
  'shortHairShaggy',
  'shortHairShaggyMullet',
  'shortHairShortCurly',
  'shortHairShortFlat',
  'shortHairShortRound',
  'shortHairShortWaved',
  'shortHairSides',
  'shortHairTheCaesar',
  'shortHairTheCaesarSidePart',
];

const NEUTRAL_HAIRSTYLES = [
  'longHairStraight',
  'shortHairShortCurly',
  'longHairBun',
  'shortHairShortFlat',
];

const MALE_FACIAL_HAIR = [
  'beardLight',
  'beardMajestic',
  'beardMedium',
  'moustacheFancy',
  'moustacheMagnum',
];

/**
 * Generates a unique, diverse avatar for candidates using DiceBear.
 * Avatar appearance is based on gender, with background color tinted by political spectrum.
 * Falls back to initials if the API fails.
 */
export function CandidateAvatar({
  candidateId,
  displayName,
  gender,
  spectrumPosition = 0,
  size = 64,
  style,
}: CandidateAvatarProps) {
  const theme = useTheme();
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Get initials from display name for fallback
  const initials = useMemo(() => {
    if (!displayName) return '?';
    return displayName
      .split(' ')
      .map((word) => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }, [displayName]);

  // Calculate background color based on spectrum position
  const backgroundColor = useMemo(() => {
    // Normalize spectrum from -100..100 to 0..1
    const normalized = (spectrumPosition + 100) / 200;

    // Progressive (left): Blue hues
    // Moderate (center): Purple hues
    // Conservative (right): Red hues

    if (normalized < 0.35) {
      // Progressive - blue tones
      const intensity = 1 - (normalized / 0.35);
      const r = Math.round(100 + (1 - intensity) * 80);
      const g = Math.round(140 + (1 - intensity) * 60);
      const b = Math.round(200 + intensity * 55);
      return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    } else if (normalized > 0.65) {
      // Conservative - red tones
      const intensity = (normalized - 0.65) / 0.35;
      const r = Math.round(200 + intensity * 55);
      const g = Math.round(100 + (1 - intensity) * 80);
      const b = Math.round(100 + (1 - intensity) * 80);
      return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    } else {
      // Moderate - purple tones
      const position = (normalized - 0.35) / 0.3;
      const r = Math.round(160 + position * 40);
      const g = Math.round(120 + Math.sin(position * Math.PI) * 30);
      const b = Math.round(180 + Math.sin(position * Math.PI) * 20);
      return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    }
  }, [spectrumPosition]);

  // Background color without # for DiceBear API
  const backgroundColorHex = backgroundColor.replace('#', '');

  // Create a deterministic seed from candidate ID for consistent avatars
  const seed = useMemo(() => {
    return encodeURIComponent(candidateId);
  }, [candidateId]);

  // Generate a deterministic index from the seed for selecting options
  const seedHash = useMemo(() => {
    let hash = 0;
    for (let i = 0; i < candidateId.length; i++) {
      const char = candidateId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }, [candidateId]);

  // Select gender-appropriate hairstyle deterministically
  const hairstyle = useMemo(() => {
    if (gender === 'female') {
      return FEMALE_HAIRSTYLES[seedHash % FEMALE_HAIRSTYLES.length];
    } else if (gender === 'male') {
      return MALE_HAIRSTYLES[seedHash % MALE_HAIRSTYLES.length];
    } else if (gender === 'non-binary') {
      // Mix of styles for non-binary
      const allStyles = [...FEMALE_HAIRSTYLES, ...MALE_HAIRSTYLES];
      return allStyles[seedHash % allStyles.length];
    } else {
      // If gender not specified, use neutral styles
      return NEUTRAL_HAIRSTYLES[seedHash % NEUTRAL_HAIRSTYLES.length];
    }
  }, [gender, seedHash]);

  // Select facial hair for male candidates (deterministic, not all males have facial hair)
  const facialHair = useMemo(() => {
    if (gender === 'male') {
      // About 40% of male avatars get facial hair based on seed
      if (seedHash % 5 < 2) {
        return MALE_FACIAL_HAIR[seedHash % MALE_FACIAL_HAIR.length];
      }
    }
    return 'blank'; // No facial hair
  }, [gender, seedHash]);

  // DiceBear avataaars style with gender-specific options (using PNG for better React Native compatibility)
  const avatarUrl = useMemo(() => {
    const baseUrl = 'https://api.dicebear.com/7.x/avataaars/png';
    const params = new URLSearchParams({
      seed: seed,
      backgroundColor: backgroundColorHex,
      backgroundType: 'solid',
      top: hairstyle,
      facialHair: facialHair,
      size: String(Math.round(size * 2)), // 2x for retina
    });
    return `${baseUrl}?${params.toString()}`;
  }, [seed, backgroundColorHex, hairstyle, facialHair, size]);

  // Render initials as fallback
  const renderFallback = () => (
    <View
      style={StyleSheet.flatten([
        styles.container,
        styles.fallback,
        { width: size, height: size, borderRadius: size / 2, backgroundColor },
        style,
      ])}
    >
      <Text style={StyleSheet.flatten([styles.initials, { fontSize: size * 0.4 }])}>
        {initials}
      </Text>
    </View>
  );

  // Show fallback if there was an error
  if (hasError) {
    return renderFallback();
  }

  return (
    <View style={StyleSheet.flatten([styles.container, { width: size, height: size, borderRadius: size / 2, backgroundColor }, style])}>
      {/* Show initials as placeholder while loading */}
      {isLoading && (
        <View style={StyleSheet.flatten([styles.placeholder, { width: size, height: size }])}>
          <Text style={StyleSheet.flatten([styles.initials, { fontSize: size * 0.4 }])}>
            {initials}
          </Text>
        </View>
      )}
      <Image
        source={{ uri: avatarUrl }}
        style={StyleSheet.flatten([styles.avatar, { width: size, height: size, borderRadius: size / 2 }])}
        onLoad={() => setIsLoading(false)}
        onError={() => {
          setHasError(true);
          setIsLoading(false);
        }}
      />
    </View>
  );
}

/**
 * Helper to calculate average spectrum position from candidate's top issues
 */
export function calculateAverageSpectrum(topIssues: { spectrumPosition: number }[]): number {
  if (!topIssues || topIssues.length === 0) return 0;

  const sum = topIssues.reduce((acc, issue) => acc + issue.spectrumPosition, 0);
  return sum / topIssues.length;
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatar: {
    position: 'absolute',
  },
  placeholder: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fallback: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  initials: {
    color: 'white',
    fontWeight: 'bold',
  },
});
