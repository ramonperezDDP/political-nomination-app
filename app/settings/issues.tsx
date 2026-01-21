import React, { useState, useMemo, useEffect } from 'react';
import { StyleSheet, View, ScrollView, Pressable } from 'react-native';
import { Text, useTheme, Chip, Searchbar } from 'react-native-paper';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { useAuthStore, useUserStore, useConfigStore } from '@/stores';
import { PrimaryButton, Card, LoadingOverlay } from '@/components/ui';

export default function ManageIssuesScreen() {
  const theme = useTheme();
  const { user } = useAuthStore();
  const { updateSelectedIssues, isLoading } = useUserStore();
  const { issues } = useConfigStore();

  const [selectedIssues, setSelectedIssues] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);
  const [hasChanges, setHasChanges] = useState(false);

  // Load existing selected issues when screen mounts
  useEffect(() => {
    if (user?.selectedIssues) {
      setSelectedIssues(user.selectedIssues);
    }
  }, [user?.selectedIssues]);

  // Group issues by category
  const issuesByCategory = useMemo(() => {
    const categories = new Map<string, typeof issues>();

    issues.forEach((issue) => {
      const existing = categories.get(issue.category) || [];
      categories.set(issue.category, [...existing, issue]);
    });

    return categories;
  }, [issues]);

  // Filter issues by search
  const filteredCategories = useMemo(() => {
    if (!searchQuery) return issuesByCategory;

    const filtered = new Map<string, typeof issues>();
    const query = searchQuery.toLowerCase();

    issuesByCategory.forEach((categoryIssues, category) => {
      const matchingIssues = categoryIssues.filter(
        (issue) =>
          issue.name.toLowerCase().includes(query) ||
          issue.description.toLowerCase().includes(query)
      );
      if (matchingIssues.length > 0) {
        filtered.set(category, matchingIssues);
      }
    });

    return filtered;
  }, [issuesByCategory, searchQuery]);

  const toggleIssue = (issueId: string) => {
    setSelectedIssues((prev) => {
      let newSelection;
      if (prev.includes(issueId)) {
        newSelection = prev.filter((id) => id !== issueId);
      } else if (prev.length >= 7) {
        return prev;
      } else {
        newSelection = [...prev, issueId];
      }
      setHasChanges(true);
      return newSelection;
    });
  };

  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) =>
      prev.includes(category)
        ? prev.filter((c) => c !== category)
        : [...prev, category]
    );
  };

  const handleSave = async () => {
    if (!user?.id) return;

    const success = await updateSelectedIssues(user.id, selectedIssues);
    if (success) {
      router.back();
    }
  };

  const isValid = selectedIssues.length >= 4 && selectedIssues.length <= 7;

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
          Choose 4-7 issues that matter most to you. We'll use these to match you with candidates.
        </Text>

        <View style={styles.counter}>
          <Text
            variant="titleMedium"
            style={{
              color: isValid ? theme.colors.primary : theme.colors.outline,
            }}
          >
            {selectedIssues.length} / 7 selected
          </Text>
          {selectedIssues.length < 4 && (
            <Text
              variant="bodySmall"
              style={{ color: theme.colors.outline, marginLeft: 8 }}
            >
              (minimum 4)
            </Text>
          )}
        </View>

        <Searchbar
          placeholder="Search issues..."
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={styles.searchbar}
        />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {Array.from(filteredCategories.entries()).map(([category, categoryIssues]) => (
          <View key={category} style={styles.categorySection}>
            <Pressable
              onPress={() => toggleCategory(category)}
              style={styles.categoryHeader}
            >
              <Text variant="titleMedium" style={styles.categoryTitle}>
                {category}
              </Text>
              <MaterialCommunityIcons
                name={expandedCategories.includes(category) ? 'chevron-up' : 'chevron-down'}
                size={24}
                color={theme.colors.onSurface}
              />
            </Pressable>

            {(expandedCategories.includes(category) || searchQuery) && (
              <View style={styles.issueGrid}>
                {categoryIssues.map((issue) => {
                  const isSelected = selectedIssues.includes(issue.id);
                  const isDisabled = !isSelected && selectedIssues.length >= 7;

                  return (
                    <Pressable
                      key={issue.id}
                      onPress={() => !isDisabled && toggleIssue(issue.id)}
                      style={[
                        styles.issueCard,
                        {
                          backgroundColor: isSelected
                            ? theme.colors.primaryContainer
                            : theme.colors.surface,
                          borderColor: isSelected
                            ? theme.colors.primary
                            : theme.colors.outlineVariant,
                          opacity: isDisabled ? 0.5 : 1,
                        },
                      ]}
                    >
                      <View style={styles.issueContent}>
                        <MaterialCommunityIcons
                          name={(issue.icon as any) || 'checkbox-blank-circle-outline'}
                          size={24}
                          color={
                            isSelected
                              ? theme.colors.primary
                              : theme.colors.outline
                          }
                        />
                        <View style={styles.issueText}>
                          <Text
                            variant="titleSmall"
                            style={{
                              color: isSelected
                                ? theme.colors.onPrimaryContainer
                                : theme.colors.onSurface,
                            }}
                          >
                            {issue.name}
                          </Text>
                          <Text
                            variant="bodySmall"
                            numberOfLines={2}
                            style={{
                              color: isSelected
                                ? theme.colors.onPrimaryContainer
                                : theme.colors.outline,
                            }}
                          >
                            {issue.description}
                          </Text>
                        </View>
                        {isSelected && (
                          <MaterialCommunityIcons
                            name="check-circle"
                            size={20}
                            color={theme.colors.primary}
                          />
                        )}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        {selectedIssues.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.selectedChips}
          >
            {selectedIssues.map((issueId) => {
              const issue = issues.find((i) => i.id === issueId);
              return (
                <Chip
                  key={issueId}
                  onClose={() => toggleIssue(issueId)}
                  style={styles.chip}
                >
                  {issue?.name || issueId}
                </Chip>
              );
            })}
          </ScrollView>
        )}

        <PrimaryButton
          onPress={handleSave}
          disabled={!isValid || !hasChanges}
          style={styles.saveButton}
        >
          Save Changes
        </PrimaryButton>
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
    marginBottom: 16,
  },
  searchbar: {
    elevation: 0,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  categorySection: {
    marginBottom: 16,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  categoryTitle: {
    fontWeight: '600',
  },
  issueGrid: {
    gap: 12,
  },
  issueCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
  },
  issueContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  issueText: {
    flex: 1,
    marginHorizontal: 12,
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
  saveButton: {
    width: '100%',
  },
});
