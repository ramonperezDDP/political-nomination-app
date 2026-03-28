import React, { useEffect, useRef } from 'react';
import { StyleSheet, View, Pressable, Modal, ScrollView, Animated } from 'react-native';
import { Text, useTheme, RadioButton } from 'react-native-paper';

import type { Question } from '@/types';

interface QuizBottomSheetProps {
  visible: boolean;
  question: Question | null;
  currentAnswer?: number;
  onAnswer: (spectrumValue: number) => void;
  onClear?: () => void;
  onDismiss: () => void;
  saving: boolean;
  error?: string | null;
  autoDismissOnAnswer?: boolean;
}

export default function QuizBottomSheet({
  visible,
  question,
  currentAnswer,
  onAnswer,
  onClear,
  onDismiss,
  saving,
  error,
}: QuizBottomSheetProps) {
  const theme = useTheme();
  const slideAnim = useRef(new Animated.Value(400)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(backdropAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, damping: 20, stiffness: 200, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(backdropAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 400, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  if (!question) return null;

  const handleOptionPress = (spectrumValue: number) => {
    if (saving) return;
    onAnswer(spectrumValue);
  };

  return (
    <Modal
      visible={visible}
      animationType="none"
      transparent={true}
      onRequestClose={onDismiss}
    >
      <View style={styles.backdrop}>
        <Animated.View style={[styles.backdropOverlay, { opacity: backdropAnim }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onDismiss} />
        </Animated.View>
        <Animated.View
          style={[styles.sheet, { backgroundColor: theme.colors.surface, transform: [{ translateY: slideAnim }] }]}
        >
          <View style={[styles.handle, { backgroundColor: theme.colors.outlineVariant }]} />

          <Text
            variant="titleMedium"
            style={[styles.questionText, { color: theme.colors.onSurface }]}
          >
            {question.text}
          </Text>

          {error ? (
            <Text variant="bodySmall" style={styles.errorText}>
              {error}
            </Text>
          ) : null}

          <ScrollView style={styles.optionsScroll} bounces={false}>
            {question.options?.map((option) => {
              const isSelected = currentAnswer === option.spectrumValue;
              return (
                <Pressable
                  key={option.id}
                  onPress={() => handleOptionPress(option.spectrumValue)}
                  disabled={saving}
                  style={[
                    styles.optionCard,
                    {
                      backgroundColor: isSelected
                        ? theme.colors.primaryContainer
                        : theme.colors.surfaceVariant,
                      borderColor: isSelected ? theme.colors.primary : 'transparent',
                      opacity: saving && !isSelected ? 0.5 : 1,
                    },
                  ]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSelected }}
                  accessibilityLabel={`${option.shortLabel}: ${option.text}`}
                >
                  <RadioButton
                    value={String(option.spectrumValue)}
                    status={isSelected ? 'checked' : 'unchecked'}
                    onPress={() => handleOptionPress(option.spectrumValue)}
                    disabled={saving}
                  />
                  <View style={styles.optionContent}>
                    <Text
                      variant="labelLarge"
                      style={[styles.optionLabel, { color: theme.colors.onSurface }]}
                    >
                      {option.shortLabel}
                    </Text>
                    <Text
                      variant="bodySmall"
                      style={{ color: theme.colors.onSurfaceVariant }}
                    >
                      {option.text}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>

          {currentAnswer !== undefined && onClear && (
            <Pressable
              onPress={() => { if (!saving) onClear(); }}
              disabled={saving}
              style={[styles.clearButton, { opacity: saving ? 0.5 : 1 }]}
            >
              <Text variant="labelMedium" style={{ color: theme.colors.error }}>
                Clear answer
              </Text>
            </Pressable>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdropOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingBottom: 32,
    paddingTop: 12,
    maxHeight: '80%',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  questionText: {
    fontWeight: '600',
    marginBottom: 16,
  },
  errorText: {
    color: '#D32F2F',
    marginBottom: 12,
  },
  optionsScroll: {
    flexGrow: 0,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    borderRadius: 8,
    borderWidth: 2,
    marginBottom: 8,
  },
  optionContent: {
    flex: 1,
    marginLeft: 4,
  },
  optionLabel: {
    fontWeight: 'bold',
    marginBottom: 2,
  },
  clearButton: {
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 4,
  },
});
