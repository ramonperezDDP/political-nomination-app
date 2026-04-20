import React, { useState, useEffect, useRef, useCallback } from 'react';
import { StyleSheet, View, Pressable, Modal, ScrollView, Animated, Platform, ActivityIndicator } from 'react-native';
import { Text, Portal, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { getActiveQuestions, getCandidatesForFeed, inferGenderFromName } from '@/services/firebase/firestore';
import { CandidateAvatar, calculateAverageSpectrum } from '@/components/ui';
import { useConfigStore, selectCurrentRoundId } from '@/stores';
import { getRoundCandidateLimit } from '@/utils/contestRounds';
import type { Question, Candidate, User } from '@/types';

interface CharacterSearchSheetProps {
  visible: boolean;
  onDismiss: () => void;
  district: string;
}

export default function CharacterSearchSheet({ visible, onDismiss, district }: CharacterSearchSheetProps) {
  const theme = useTheme();
  const slideAnim = useRef(new Animated.Value(400)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;

  const [questions, setQuestions] = useState<Question[]>([]);
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);
  const [selectedSpectrumValue, setSelectedSpectrumValue] = useState<number | null>(null);
  const [candidates, setCandidates] = useState<Array<{ candidate: Candidate; user: User | null }>>([]);
  const [matchingCandidates, setMatchingCandidates] = useState<Array<{ candidate: Candidate; user: User | null }>>([]);
  const currentRoundId = useConfigStore(selectCurrentRoundId);
  const [loading, setLoading] = useState(false);
  const [candidatesLoaded, setCandidatesLoaded] = useState(false);

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

  // Load questions when sheet opens
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    const load = async () => {
      const fetched = await getActiveQuestions(district);
      if (!cancelled) setQuestions(fetched);
    };
    load();
    return () => { cancelled = true; };
  }, [visible, district]);

  // Load candidates once when sheet opens
  useEffect(() => {
    if (!visible || candidatesLoaded) return;
    let cancelled = false;
    const load = async () => {
      const roundLimit = getRoundCandidateLimit(currentRoundId);
      const data = await getCandidatesForFeed(district, roundLimit);
      if (!cancelled) {
        setCandidates(data);
        setCandidatesLoaded(true);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [visible, district, candidatesLoaded, currentRoundId]);

  // Filter candidates when an option is selected
  useEffect(() => {
    if (selectedQuestionId === null || selectedSpectrumValue === null) {
      setMatchingCandidates([]);
      return;
    }

    // Find the selected option to determine which "side" it represents
    const question = questions.find((q) => q.id === selectedQuestionId);
    const selectedOption = question?.options?.find((o) => o.spectrumValue === selectedSpectrumValue);
    if (!selectedOption) { setMatchingCandidates([]); return; }

    // Find closest option for each candidate and match if same option
    const matches = candidates.filter(({ user: candidateUser }) => {
      if (!candidateUser?.questionnaireResponses) return false;
      const response = candidateUser.questionnaireResponses.find(
        (r) => r.questionId === selectedQuestionId
      );
      if (!response) return false;
      const candidateVal = Number(response.answer);
      // Match if candidate's answer is closest to the same option the user picked
      const options = question?.options || [];
      let closestOption = options[0];
      let closestDist = Math.abs(candidateVal - (closestOption?.spectrumValue ?? 0));
      for (const opt of options) {
        const dist = Math.abs(candidateVal - opt.spectrumValue);
        if (dist < closestDist) {
          closestDist = dist;
          closestOption = opt;
        }
      }
      return closestOption?.spectrumValue === selectedSpectrumValue;
    });

    setMatchingCandidates(matches);
  }, [selectedQuestionId, selectedSpectrumValue, candidates]);

  const handleDismiss = useCallback(() => {
    setSelectedQuestionId(null);
    setSelectedSpectrumValue(null);
    onDismiss();
  }, [onDismiss]);

  // Reset when sheet closes
  useEffect(() => {
    if (!visible) {
      setSelectedQuestionId(null);
      setSelectedSpectrumValue(null);
      setCandidatesLoaded(false);
    }
  }, [visible]);

  const handleQuestionPress = (questionId: string) => {
    if (selectedQuestionId === questionId) {
      setSelectedQuestionId(null);
      setSelectedSpectrumValue(null);
    } else {
      setSelectedQuestionId(questionId);
      setSelectedSpectrumValue(null);
    }
  };

  const handleOptionPress = (spectrumValue: number) => {
    setSelectedSpectrumValue(spectrumValue);
  };

  const handleCandidatePress = (candidateId: string) => {
    handleDismiss();
    router.push(`/(main)/(feed)/candidate/${candidateId}` as any);
  };

  const selectedQuestion = questions.find((q) => q.id === selectedQuestionId);

  const isWeb = Platform.OS === 'web';

  // Web: keep mounted during close animation
  const [webMounted, setWebMounted] = useState(false);
  const [webAnimating, setWebAnimating] = useState(false);
  useEffect(() => {
    if (!isWeb) return;
    if (visible) {
      setWebMounted(true);
      requestAnimationFrame(() => requestAnimationFrame(() => setWebAnimating(true)));
    } else {
      setWebAnimating(false);
      const timer = setTimeout(() => setWebMounted(false), 300);
      return () => clearTimeout(timer);
    }
  }, [visible, isWeb]);

  const sheetStyle = isWeb
    ? [styles.sheet, {
        backgroundColor: theme.colors.surface,
        transform: [{ translateY: webAnimating ? 0 : 400 }],
        transition: 'transform 0.3s ease-out',
        boxShadow: '0 -4px 20px rgba(0,0,0,0.15)',
      } as any]
    : [styles.sheet, { backgroundColor: theme.colors.surface, transform: [{ translateY: slideAnim }] }];

  const sheetContent = (
    <View style={isWeb ? styles.webBackdrop : styles.backdrop}>
      {isWeb ? (
        <Pressable style={StyleSheet.absoluteFill} onPress={handleDismiss} />
      ) : (
        <Animated.View style={[styles.backdropOverlay, { opacity: backdropAnim }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={handleDismiss} />
        </Animated.View>
      )}
      <Animated.View style={sheetStyle}>
        <View style={[styles.handle, { backgroundColor: theme.colors.outlineVariant }]} />

        <Text variant="titleMedium" style={styles.sheetTitle}>
          Filter by Policy
        </Text>

        <ScrollView style={styles.scrollContent} bounces={false}>
          {questions.map((question) => {
            const isExpanded = selectedQuestionId === question.id;
            return (
              <View key={question.id}>
                <Pressable
                  onPress={() => handleQuestionPress(question.id)}
                  style={[
                    styles.questionRow,
                    { borderBottomColor: theme.colors.outlineVariant },
                    isExpanded && { backgroundColor: theme.colors.surfaceVariant },
                  ]}
                >
                  <Text
                    variant="titleSmall"
                    style={{ flex: 1, fontWeight: isExpanded ? 'bold' : '500' }}
                  >
                    {question.text}
                  </Text>
                  <MaterialCommunityIcons
                    name={isExpanded ? 'chevron-up' : 'chevron-down'}
                    size={20}
                    color={theme.colors.outline}
                  />
                </Pressable>

                {isExpanded && question.options?.map((option) => {
                  const isSelected = selectedSpectrumValue === option.spectrumValue;
                  return (
                    <Pressable
                      key={option.id}
                      onPress={() => handleOptionPress(option.spectrumValue)}
                      style={[
                        styles.optionRow,
                        {
                          backgroundColor: isSelected
                            ? theme.colors.primaryContainer
                            : theme.colors.surface,
                          borderLeftColor: isSelected ? theme.colors.primary : 'transparent',
                        },
                      ]}
                    >
                      <View style={styles.optionContent}>
                        <Text
                          variant="labelLarge"
                          style={{ fontWeight: '600', color: theme.colors.onSurface }}
                        >
                          {option.shortLabel}
                        </Text>
                        <Text variant="bodySmall" style={{ color: theme.colors.outline }}>
                          {option.text}
                        </Text>
                      </View>
                      {isSelected && (
                        <MaterialCommunityIcons
                          name="check"
                          size={20}
                          color={theme.colors.primary}
                        />
                      )}
                    </Pressable>
                  );
                })}

                {/* Show matching candidates after selecting an option */}
                {isExpanded && selectedSpectrumValue !== null && (
                  <View style={[styles.resultsSection, { backgroundColor: theme.colors.surfaceVariant }]}>
                    {!candidatesLoaded ? (
                      <ActivityIndicator size="small" color={theme.colors.primary} style={{ padding: 12 }} />
                    ) : matchingCandidates.length === 0 ? (
                      <Text variant="bodySmall" style={[styles.noResults, { color: theme.colors.outline }]}>
                        No candidates match this position
                      </Text>
                    ) : (
                      <>
                        <Text variant="labelSmall" style={[styles.resultsLabel, { color: theme.colors.outline }]}>
                          {matchingCandidates.length} candidate{matchingCandidates.length !== 1 ? 's' : ''} match
                        </Text>
                        {matchingCandidates.map(({ candidate, user: candidateUser }) => (
                          <Pressable
                            key={candidate.id}
                            onPress={() => handleCandidatePress(candidate.id)}
                            style={[styles.candidateRow, { backgroundColor: theme.colors.surface }]}
                          >
                            <CandidateAvatar
                              candidateId={candidate.id}
                              displayName={candidateUser?.displayName || 'Candidate'}
                              gender={candidateUser?.gender || inferGenderFromName(candidateUser?.displayName || '')}
                              photoUrl={candidate.photoUrl || candidateUser?.photoUrl}
                              thumbnailUrl={candidate.thumbnailUrl}
                              spectrumPosition={calculateAverageSpectrum(candidate.topIssues || [])}
                              size={36}
                            />
                            <Text variant="bodyMedium" style={styles.candidateName}>
                              {candidateUser?.displayName || 'Candidate'}
                            </Text>
                            <MaterialCommunityIcons
                              name="chevron-right"
                              size={18}
                              color={theme.colors.outline}
                            />
                          </Pressable>
                        ))}
                      </>
                    )}
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>
      </Animated.View>
    </View>
  );

  if (isWeb) {
    if (!webMounted) return null;
    return <Portal>{sheetContent}</Portal>;
  }

  return (
    <Modal
      visible={visible}
      animationType="none"
      transparent={true}
      onRequestClose={handleDismiss}
    >
      {sheetContent}
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  webBackdrop: {
    position: 'absolute' as any,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'flex-end',
    zIndex: 9999,
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
    maxHeight: '90%',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetTitle: {
    fontWeight: 'bold',
  },
  subtitle: {
    marginBottom: 16,
  },
  scrollContent: {
    flexGrow: 0,
  },
  questionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderLeftWidth: 3,
    marginLeft: 8,
  },
  optionContent: {
    flex: 1,
  },
  resultsSection: {
    marginLeft: 8,
    borderRadius: 8,
    marginBottom: 8,
    overflow: 'hidden',
  },
  resultsLabel: {
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 6,
  },
  noResults: {
    padding: 12,
    textAlign: 'center',
  },
  candidateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginHorizontal: 4,
    marginBottom: 4,
    borderRadius: 8,
  },
  candidateName: {
    flex: 1,
    marginLeft: 10,
    fontWeight: '500',
  },
});
