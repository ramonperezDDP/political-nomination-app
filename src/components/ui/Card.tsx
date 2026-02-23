import React from 'react';
import { StyleSheet, ViewStyle, Pressable, StyleProp, Platform } from 'react-native';
import { Card as PaperCard, useTheme } from 'react-native-paper';

interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  onPress?: () => void;
  elevation?: 0 | 1 | 2 | 3 | 4 | 5;
  testID?: string;
}

export function Card({
  children,
  style,
  contentStyle,
  onPress,
  elevation = 1,
  testID,
}: CardProps) {
  const theme = useTheme();

  const cardContent = (
    <PaperCard
      style={StyleSheet.flatten([
        styles.card,
        { backgroundColor: theme.colors.surface },
        style as ViewStyle,
      ])}
      contentStyle={contentStyle as ViewStyle}
      elevation={elevation}
      testID={testID}
    >
      <PaperCard.Content style={styles.content}>
        {children}
      </PaperCard.Content>
    </PaperCard>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}>
        {cardContent}
      </Pressable>
    );
  }

  return cardContent;
}

interface CardWithHeaderProps extends CardProps {
  title: string;
  subtitle?: string;
  leftIcon?: string;
  rightContent?: React.ReactNode;
}

export function CardWithHeader({
  title,
  subtitle,
  leftIcon,
  rightContent,
  children,
  style,
  contentStyle,
  elevation = 1,
  testID,
}: CardWithHeaderProps) {
  return (
    <PaperCard
      style={StyleSheet.flatten([styles.card, style as ViewStyle])}
      contentStyle={contentStyle as ViewStyle}
      elevation={elevation}
      testID={testID}
    >
      <PaperCard.Title
        title={title}
        subtitle={subtitle}
        left={leftIcon ? (props) => <PaperCard.Cover {...props} source={{ uri: leftIcon }} /> : undefined}
        right={rightContent ? () => rightContent : undefined}
      />
      <PaperCard.Content style={styles.content}>
        {children}
      </PaperCard.Content>
    </PaperCard>
  );
}

interface CardWithImageProps extends CardProps {
  imageUri: string;
  imageHeight?: number;
}

export function CardWithImage({
  imageUri,
  imageHeight = 200,
  children,
  style,
  contentStyle,
  elevation = 1,
  testID,
}: CardWithImageProps) {
  return (
    <PaperCard
      style={StyleSheet.flatten([styles.card, style as ViewStyle])}
      contentStyle={contentStyle as ViewStyle}
      elevation={elevation}
      testID={testID}
    >
      <PaperCard.Cover source={{ uri: imageUri }} style={{ height: imageHeight }} />
      <PaperCard.Content style={styles.content}>
        {children}
      </PaperCard.Content>
    </PaperCard>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    marginBottom: 12,
  },
  content: {
    paddingVertical: 12,
  },
});
