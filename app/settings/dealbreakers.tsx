import React, { useState, useEffect } from 'react';
import { StyleSheet, View, ScrollView, Pressable } from 'react-native';
import { Text, useTheme, Chip } from 'react-native-paper';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { useAuthStore, useUserStore } from '@/stores';
import { PrimaryButton, SecondaryButton, Card, LoadingOverlay } from '@/components/ui';

// Common dealbreaker positions that users might want to filter on
const DEALBREAKER_OPTIONS = [
  {
    id: 'abortion_access',
    name: 'Abortion Access',
    description: 'Supports unrestricted access to abortion services',
  },
  {
    id: 'abortion_restrictions',
    name: 'Abortion Restrictions',
    description: 'Supports restrictions or bans on abortion',
  },
  {
    id: 'gun_control',
    name: 'Gun Control',
    description: 'Supports stricter gun control measures',
  },
  {
    id: 'gun_rights',
    name: 'Gun Rights',
    description: 'Opposes additional gun control measures',
  },
  {
    id: 'climate_action',
    name: 'Climate Action',
    description: 'Supports aggressive climate change policies',
  },
  {
    id: 'fossil_fuels',
    name: 'Fossil Fuel Support',
    description: 'Supports continued fossil fuel development',
  },
  {
    id: 'immigration_restrictive',
    name: 'Immigration Restrictions',
    description: 'Supports stricter immigration enforcement',
  },
  {
    id: 'immigration_permissive',
    name: 'Immigration Reform',
    description: 'Supports pathway to citizenship',
  },
  {
    id: 'universal_healthcare',
    name: 'Universal Healthcare',
    description: 'Supports government-run healthcare system',
  },
  {
    id: 'private_healthcare',
    name: 'Private Healthcare',
    description: 'Supports market-based healthcare solutions',
  },
  {
    id: 'lgbtq_rights',
    name: 'LGBTQ+ Rights',
    description: 'Supports LGBTQ+ protections and rights',
  },
  {
    id: 'religious_liberty',
    name: 'Religious Liberty',
    description: 'Prioritizes religious exemptions',
  },
];

export default function ManageDealbreakersScreen() {
  const theme = useTheme();
  const { user } = useAuthStore();
  const { updateDealbreakers, isLoading } = useUserStore();

  // Initialize with user's existing dealbreakers
  const [selectedDealbreakers, setSelectedDealbreakers] = useState<string[]>([]);
  const [hasChanges, setHasChanges] = useState(false);

  // Load existing dealbreakers when screen mounts
  useEffect(() => {
    if (user?.dealbreakers) {
      setSelectedDealbreakers(user.dealbreakers);
    }
  }, [user?.dealbreakers]);

  const toggleDealbreaker = (dealbreakerId: string) => {
    setSelectedDealbreakers((prev) => {
      let newSelection;
      if (prev.includes(dealbreakerId)) {
        newSelection = prev.filter((id) => id !== dealbreakerId);
      } else if (prev.length >= 3) {
        return prev;
      } else {
        newSelection = [...prev, dealbreakerId];
      }
      setHasChanges(true);
      return newSelection;
    });
  };

  const handleSave = async () => {
    if (!user?.id) return;

    const success = await updateDealbreakers(user.id, selectedDealbreakers);
    if (success) {
      router.back();
    }
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={['bottom']}
    >
      <LoadingOverlay visible={isLoading} message="Saving..." />

      <View style={styles.header}>
        <Text
          variant="bodyMedium"
          style={[styles.subtitle, { color: theme.colors.outline }]}
        >
          Select up to 3 positions that would automatically disqualify a candidate for you. Candidates with these positions will be clearly marked in your feed.
        </Text>

        <View style={styles.counter}>
          <MaterialCommunityIcons
            name="alert-circle-outline"
            size={20}
            color={theme.colors.error}
          />
          <Text
            variant="titleMedium"
            style={{ color: theme.colors.error, marginLeft: 8 }}
          >
            {selectedDealbreakers.length} / 3 selected
          </Text>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.optionsGrid}>
          {DEALBREAKER_OPTIONS.map((option) => {
            const isSelected = selectedDealbreakers.includes(option.id);
            const isDisabled = !isSelected && selectedDealbreakers.length >= 3;

            return (
              <Pressable
                key={option.id}
                onPress={() => !isDisabled && toggleDealbreaker(option.id)}
                style={[
                  styles.optionCard,
                  {
                    backgroundColor: isSelected
                      ? theme.colors.errorContainer
                      : theme.colors.surface,
                    borderColor: isSelected
                      ? theme.colors.error
                      : theme.colors.outlineVariant,
                    opacity: isDisabled ? 0.5 : 1,
                  },
                ]}
              >
                <View style={styles.optionContent}>
                  <View style={styles.optionHeader}>
                    <Text
                      variant="titleSmall"
                      style={{
                        color: isSelected
                          ? theme.colors.onErrorContainer
                          : theme.colors.onSurface,
                        flex: 1,
                      }}
                    >
                      {option.name}
                    </Text>
                    {isSelected && (
                      <MaterialCommunityIcons
                        name="close-circle"
                        size={20}
                        color={theme.colors.error}
                      />
                    )}
                  </View>
                  <Text
                    variant="bodySmall"
                    style={{
                      color: isSelected
                        ? theme.colors.onErrorContainer
                        : theme.colors.outline,
                      marginTop: 4,
                    }}
                  >
                    {option.description}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        <Card style={styles.infoCard}>
          <View style={styles.infoContent}>
            <MaterialCommunityIcons
              name="information-outline"
              size={24}
              color={theme.colors.primary}
            />
            <View style={styles.infoText}>
              <Text variant="titleSmall">How Dealbreakers Work</Text>
              <Text
                variant="bodySmall"
                style={{ color: theme.colors.outline, marginTop: 4 }}
              >
                Candidates holding dealbreaker positions will still appear in your feed, but they'll be clearly marked so you can make informed decisions.
              </Text>
            </View>
          </View>
        </Card>
      </ScrollView>

      <View style={styles.footer}>
        {selectedDealbreakers.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.selectedChips}
          >
            {selectedDealbreakers.map((dealbreakerId) => {
              const option = DEALBREAKER_OPTIONS.find((o) => o.id === dealbreakerId);
              return (
                <Chip
                  key={dealbreakerId}
                  onClose={() => toggleDealbreaker(dealbreakerId)}
                  style={[styles.chip, { backgroundColor: theme.colors.errorContainer }]}
                  textStyle={{ color: theme.colors.onErrorContainer }}
                >
                  {option?.name || dealbreakerId}
                </Chip>
              );
            })}
          </ScrollView>
        )}

        <View style={styles.buttonRow}>
          <SecondaryButton
            onPress={() => router.back()}
            style={styles.cancelButton}
          >
            Cancel
          </SecondaryButton>
          <PrimaryButton
            onPress={handleSave}
            loading={isLoading}
            disabled={!hasChanges}
            style={styles.saveButton}
          >
            Save Changes
          </PrimaryButton>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 24,
    paddingBottom: 16,
  },
  subtitle: {
    marginBottom: 16,
  },
  counter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingTop: 0,
  },
  optionsGrid: {
    gap: 12,
  },
  optionCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
  },
  optionContent: {},
  optionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoCard: {
    marginTop: 24,
  },
  infoContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  infoText: {
    flex: 1,
    marginLeft: 12,
  },
  footer: {
    padding: 24,
    paddingTop: 16,
  },
  selectedChips: {
    marginBottom: 16,
  },
  chip: {
    marginRight: 8,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
  },
  saveButton: {
    flex: 1,
  },
});
