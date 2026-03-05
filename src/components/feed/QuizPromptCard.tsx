import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Button } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

interface QuizPromptCardProps {
  height: number;
}

export default function QuizPromptCard({ height }: QuizPromptCardProps) {
  const router = useRouter();

  return (
    <View style={[styles.container, { height }]}>
      <MaterialCommunityIcons name="clipboard-list-outline" size={64} color="rgba(255,255,255,0.6)" />
      <Text style={styles.title}>Discover Your Matches</Text>
      <Text style={styles.subtitle}>
        Take a quick policy quiz to see how candidates align with your values.
      </Text>
      <Button
        mode="contained"
        onPress={() => router.push('/quiz')}
        style={styles.button}
        labelStyle={styles.buttonLabel}
      >
        Take Quiz
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1a1a2e',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  title: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 24,
    textAlign: 'center',
  },
  subtitle: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 22,
  },
  button: {
    marginTop: 32,
    paddingHorizontal: 16,
  },
  buttonLabel: {
    fontSize: 16,
  },
});
