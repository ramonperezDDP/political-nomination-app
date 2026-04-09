import React, { useState, useEffect, useRef, useCallback } from 'react';
import { StyleSheet, View, Pressable, Modal, ScrollView, Animated, Platform, ActivityIndicator } from 'react-native';
import { Text, Portal, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Svg, { Path, G, Text as SvgText } from 'react-native-svg';

import { getCandidatesForFeed, inferGenderFromName } from '@/services/firebase/firestore';
import { CandidateAvatar, calculateAverageSpectrum } from '@/components/ui';
import type { Candidate, User } from '@/types';

interface Zone {
  id: string;
  label: string;
  path: string;
  center: { x: number; y: number };
}

const PA01_ZONES: Zone[] = [
  { id: 'pa01-north', label: 'North', path: 'M50,10 L150,10 L150,80 L50,80 Z', center: { x: 100, y: 45 } },
  { id: 'pa01-central', label: 'Central', path: 'M50,80 L150,80 L150,150 L50,150 Z', center: { x: 100, y: 115 } },
  { id: 'pa01-south', label: 'South', path: 'M50,150 L150,150 L150,220 L50,220 Z', center: { x: 100, y: 185 } },
];

const PA02_ZONES: Zone[] = [
  { id: 'pa02-west', label: 'West Philly', path: 'M10,50 L90,50 L90,180 L10,180 Z', center: { x: 50, y: 115 } },
  { id: 'pa02-center', label: 'Center City', path: 'M90,50 L170,50 L170,180 L90,180 Z', center: { x: 130, y: 115 } },
  { id: 'pa02-northeast', label: 'Northeast', path: 'M170,10 L250,10 L250,120 L170,120 Z', center: { x: 210, y: 65 } },
  { id: 'pa02-south', label: 'South Philly', path: 'M90,180 L200,180 L200,240 L90,240 Z', center: { x: 145, y: 210 } },
];

const DISTRICT_ZONES: Record<string, Zone[]> = {
  'PA-01': PA01_ZONES,
  'PA-02': PA02_ZONES,
};

interface FilterByAreaSheetProps {
  visible: boolean;
  onDismiss: () => void;
  district: string;
}

export default function FilterByAreaSheet({ visible, onDismiss, district }: FilterByAreaSheetProps) {
  const theme = useTheme();
  const slideAnim = useRef(new Animated.Value(400)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;

  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<Array<{ candidate: Candidate; user: User | null }>>([]);
  const [candidatesLoaded, setCandidatesLoaded] = useState(false);

  const zones = DISTRICT_ZONES[district] || PA01_ZONES;

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

  // Load candidates once when sheet opens
  useEffect(() => {
    if (!visible || candidatesLoaded) return;
    let cancelled = false;
    const load = async () => {
      const data = await getCandidatesForFeed(district);
      if (!cancelled) {
        setCandidates(data);
        setCandidatesLoaded(true);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [visible, district, candidatesLoaded]);

  // Reset when sheet closes
  useEffect(() => {
    if (!visible) {
      setSelectedZoneId(null);
      setCandidatesLoaded(false);
    }
  }, [visible]);

  const handleDismiss = useCallback(() => {
    setSelectedZoneId(null);
    onDismiss();
  }, [onDismiss]);

  const handleCandidatePress = (candidateId: string) => {
    handleDismiss();
    router.push(`/(main)/(feed)/candidate/${candidateId}` as any);
  };

  const matchingCandidates = selectedZoneId
    ? candidates.filter(({ candidate }) => candidate.zone === selectedZoneId)
    : [];

  const selectedZone = zones.find((z) => z.id === selectedZoneId);

  const isWeb = Platform.OS === 'web';

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
          Filter by Area — {district}
        </Text>

        <ScrollView style={styles.scrollContent} bounces={false}>
          {/* SVG Map */}
          <View style={styles.mapContainer}>
            <Svg width="100%" height={200} viewBox="0 0 260 260">
              {zones.map((zone) => {
                const isSelected = selectedZoneId === zone.id;
                return (
                  <G key={zone.id}>
                    <Path
                      d={zone.path}
                      fill={isSelected ? theme.colors.primaryContainer : '#e8e8e8'}
                      stroke={isSelected ? theme.colors.primary : '#999'}
                      strokeWidth={isSelected ? 2.5 : 1}
                      onPress={() => setSelectedZoneId(zone.id)}
                    />
                    <SvgText
                      x={zone.center.x}
                      y={zone.center.y}
                      textAnchor="middle"
                      fontSize={11}
                      fill={isSelected ? theme.colors.primary : '#555'}
                      fontWeight={isSelected ? 'bold' : 'normal'}
                    >
                      {zone.label}
                    </SvgText>
                  </G>
                );
              })}
            </Svg>
          </View>

          {/* Candidates list */}
          {selectedZoneId && (
            <View style={styles.resultsSection}>
              <Text variant="titleSmall" style={[styles.resultsTitle, { color: theme.colors.onSurface }]}>
                {selectedZone?.label}
              </Text>
              {!candidatesLoaded ? (
                <ActivityIndicator size="small" color={theme.colors.primary} style={{ padding: 12 }} />
              ) : matchingCandidates.length === 0 ? (
                <Text variant="bodySmall" style={[styles.noResults, { color: theme.colors.outline }]}>
                  No candidates in this area
                </Text>
              ) : (
                <>
                  <Text variant="labelSmall" style={[styles.resultsLabel, { color: theme.colors.outline }]}>
                    {matchingCandidates.length} candidate{matchingCandidates.length !== 1 ? 's' : ''}
                  </Text>
                  {matchingCandidates.map(({ candidate, user: candidateUser }) => (
                    <Pressable
                      key={candidate.id}
                      onPress={() => handleCandidatePress(candidate.id)}
                      style={[styles.candidateRow, { backgroundColor: theme.colors.surfaceVariant }]}
                    >
                      <CandidateAvatar
                        candidateId={candidate.id}
                        displayName={candidateUser?.displayName || 'Candidate'}
                        gender={candidateUser?.gender || inferGenderFromName(candidateUser?.displayName || '')}
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
    marginBottom: 12,
  },
  scrollContent: {
    flexGrow: 0,
  },
  mapContainer: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 8,
    marginBottom: 16,
  },
  resultsSection: {
    marginBottom: 8,
  },
  resultsTitle: {
    fontWeight: 'bold',
    marginBottom: 4,
  },
  resultsLabel: {
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
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
    marginBottom: 4,
    borderRadius: 8,
  },
  candidateName: {
    flex: 1,
    marginLeft: 10,
    fontWeight: '500',
  },
});
