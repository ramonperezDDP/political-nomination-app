import React from 'react';
import { StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { Button as PaperButton, useTheme } from 'react-native-paper';

interface ButtonProps {
  mode?: 'text' | 'outlined' | 'contained' | 'elevated' | 'contained-tonal';
  onPress: () => void;
  children: React.ReactNode;
  loading?: boolean;
  disabled?: boolean;
  icon?: string;
  style?: ViewStyle;
  labelStyle?: TextStyle;
  compact?: boolean;
  uppercase?: boolean;
  testID?: string;
}

export function Button({
  mode = 'contained',
  onPress,
  children,
  loading = false,
  disabled = false,
  icon,
  style,
  labelStyle,
  compact = false,
  uppercase = false,
  testID,
}: ButtonProps) {
  const theme = useTheme();

  return (
    <PaperButton
      mode={mode}
      onPress={onPress}
      loading={loading}
      disabled={disabled || loading}
      icon={icon}
      style={[styles.button, style]}
      labelStyle={[styles.label, labelStyle]}
      compact={compact}
      uppercase={uppercase}
      testID={testID}
    >
      {children}
    </PaperButton>
  );
}

export function PrimaryButton(props: Omit<ButtonProps, 'mode'>) {
  return <Button mode="contained" {...props} />;
}

export function SecondaryButton(props: Omit<ButtonProps, 'mode'>) {
  return <Button mode="outlined" {...props} />;
}

export function TextButton(props: Omit<ButtonProps, 'mode'>) {
  return <Button mode="text" {...props} />;
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 8,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
  },
});
