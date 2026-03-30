import React from 'react';
import { View, Pressable, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface AlignmentCircleProps {
  score: number | null;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
}

function getAlignmentColor(score: number): string {
  if (score >= 61) return '#4caf50';
  if (score >= 31) return '#ffc107';
  return '#ff9800';
}

export default function AlignmentCircle({ score, style, onPress }: AlignmentCircleProps) {
  const Wrapper = onPress ? Pressable : View;
  const wrapperProps = onPress ? { onPress } : {};

  if (score === null) {
    return (
      <Wrapper {...wrapperProps} style={[styles.circle, { borderColor: 'rgba(255,255,255,0.4)' }, style] as any}>
        <Text style={[styles.scoreText, { color: 'rgba(255,255,255,0.6)' }]}>?</Text>
      </Wrapper>
    );
  }

  const roundedScore = Math.round(score);
  const color = getAlignmentColor(roundedScore);
  const isPerfect = roundedScore === 100;

  if (isPerfect) {
    return (
      <Wrapper {...wrapperProps} style={[styles.perfectContainer, style] as any}>
        <MaterialCommunityIcons name="check-circle" size={20} color="#00e676" />
        <Text style={styles.perfectText}>Perfectly{'\n'}Aligned</Text>
      </Wrapper>
    );
  }

  return (
    <Wrapper {...wrapperProps} style={[styles.circle, { borderColor: color }, style] as any}>
      <Text style={[styles.scoreText, { color }]}>{roundedScore}%</Text>
    </Wrapper>
  );
}

const styles = StyleSheet.create({
  circle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 3,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  scoreText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  perfectContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  perfectText: {
    color: '#00e676',
    fontSize: 11,
    fontWeight: 'bold',
    lineHeight: 13,
  },
});
