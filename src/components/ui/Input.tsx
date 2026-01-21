import React, { useState } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { TextInput, HelperText, useTheme } from 'react-native-paper';

interface InputProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  error?: string;
  secureTextEntry?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  autoComplete?:
    | 'email'
    | 'password'
    | 'username'
    | 'name'
    | 'tel'
    | 'off';
  keyboardType?:
    | 'default'
    | 'email-address'
    | 'numeric'
    | 'phone-pad'
    | 'decimal-pad';
  multiline?: boolean;
  numberOfLines?: number;
  maxLength?: number;
  disabled?: boolean;
  left?: React.ReactNode;
  right?: React.ReactNode;
  style?: ViewStyle;
  testID?: string;
  onBlur?: () => void;
  onFocus?: () => void;
}

export function Input({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  secureTextEntry = false,
  autoCapitalize = 'none',
  autoComplete = 'off',
  keyboardType = 'default',
  multiline = false,
  numberOfLines = 1,
  maxLength,
  disabled = false,
  left,
  right,
  style,
  testID,
  onBlur,
  onFocus,
}: InputProps) {
  const theme = useTheme();
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  const passwordToggle = secureTextEntry ? (
    <TextInput.Icon
      icon={isPasswordVisible ? 'eye-off' : 'eye'}
      onPress={() => setIsPasswordVisible(!isPasswordVisible)}
    />
  ) : null;

  return (
    <View style={[styles.container, style]}>
      <TextInput
        label={label}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        error={!!error}
        secureTextEntry={secureTextEntry && !isPasswordVisible}
        autoCapitalize={autoCapitalize}
        autoComplete={autoComplete}
        keyboardType={keyboardType}
        multiline={multiline}
        numberOfLines={numberOfLines}
        maxLength={maxLength}
        disabled={disabled}
        left={left}
        right={right || passwordToggle}
        mode="outlined"
        style={styles.input}
        testID={testID}
        onBlur={onBlur}
        onFocus={onFocus}
      />
      {error && (
        <HelperText type="error" visible={!!error}>
          {error}
        </HelperText>
      )}
    </View>
  );
}

export function EmailInput(props: Omit<InputProps, 'autoComplete' | 'keyboardType' | 'autoCapitalize'>) {
  return (
    <Input
      {...props}
      autoComplete="email"
      keyboardType="email-address"
      autoCapitalize="none"
      left={<TextInput.Icon icon="email" />}
    />
  );
}

export function PasswordInput(props: Omit<InputProps, 'secureTextEntry'>) {
  return (
    <Input
      {...props}
      secureTextEntry
      left={<TextInput.Icon icon="lock" />}
    />
  );
}

export function SearchInput(props: InputProps) {
  return (
    <Input
      {...props}
      left={<TextInput.Icon icon="magnify" />}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 8,
  },
  input: {
    backgroundColor: 'transparent',
  },
});
