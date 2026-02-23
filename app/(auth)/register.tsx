import React from 'react';
import {
  StyleSheet,
  View,
  KeyboardAvoidingView as RNKeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';

const KeyboardAvoidingView = Platform.OS === 'web' ? View : RNKeyboardAvoidingView;
import { Text, useTheme, Checkbox } from 'react-native-paper';
import { Link, router } from 'expo-router';
import { SafeAreaView as NativeSafeAreaView } from 'react-native-safe-area-context';

const SafeAreaView = Platform.OS === 'web' ? View : NativeSafeAreaView;
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { useAuthStore } from '@/stores';
import {
  PrimaryButton,
  EmailInput,
  PasswordInput,
  Input,
  LoadingOverlay,
} from '@/components/ui';

const registerSchema = z
  .object({
    displayName: z
      .string()
      .min(2, 'Name must be at least 2 characters')
      .max(50, 'Name must be less than 50 characters'),
    email: z.string().email('Please enter a valid email address'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
        'Password must contain uppercase, lowercase, and a number'
      ),
    confirmPassword: z.string(),
    acceptTerms: z.boolean().refine((val) => val === true, {
      message: 'You must accept the terms and conditions',
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type RegisterFormData = z.infer<typeof registerSchema>;

export default function RegisterScreen() {
  const theme = useTheme();
  const { signUp, isLoading, error, clearError } = useAuthStore();

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      displayName: '',
      email: '',
      password: '',
      confirmPassword: '',
      acceptTerms: false,
    },
  });

  const onSubmit = async (data: RegisterFormData) => {
    clearError();
    const success = await signUp(data.email, data.password, data.displayName);
    if (success) {
      router.replace('/(auth)/verify-identity');
    }
  };

  // Web registration — uses Paper components directly to avoid style array issues
  if (Platform.OS === 'web') {
    const { TextInput, Button, HelperText, ActivityIndicator } = require('react-native-paper');
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        {isLoading && (
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', zIndex: 10 }}>
            <ActivityIndicator size="large" color="#fff" />
            <Text style={{ color: '#fff', marginTop: 12 }}>Creating account...</Text>
          </View>
        )}
        <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 24, maxWidth: 480, alignSelf: 'center', width: '100%' }}>
          <View style={{ marginBottom: 32 }}>
            <Text variant="headlineMedium" style={{ fontWeight: 'bold', marginBottom: 8 }}>
              Create Account
            </Text>
            <Text variant="bodyLarge" style={{ color: theme.colors.outline }}>
              Join the democratic process
            </Text>
          </View>

          <View style={{ marginBottom: 24 }}>
            <Controller
              control={control}
              name="displayName"
              render={({ field: { onChange, onBlur, value } }) => (
                <View style={{ marginBottom: 8 }}>
                  <TextInput
                    label="Full Name"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    mode="outlined"
                    autoCapitalize="words"
                    error={!!errors.displayName}
                  />
                  {errors.displayName && (
                    <HelperText type="error">{errors.displayName.message}</HelperText>
                  )}
                </View>
              )}
            />

            <Controller
              control={control}
              name="email"
              render={({ field: { onChange, onBlur, value } }) => (
                <View style={{ marginBottom: 8 }}>
                  <TextInput
                    label="Email"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    mode="outlined"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    error={!!errors.email}
                  />
                  {errors.email && (
                    <HelperText type="error">{errors.email.message}</HelperText>
                  )}
                </View>
              )}
            />

            <Controller
              control={control}
              name="password"
              render={({ field: { onChange, onBlur, value } }) => (
                <View style={{ marginBottom: 8 }}>
                  <TextInput
                    label="Password"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    mode="outlined"
                    secureTextEntry
                    error={!!errors.password}
                  />
                  {errors.password && (
                    <HelperText type="error">{errors.password.message}</HelperText>
                  )}
                </View>
              )}
            />

            <Controller
              control={control}
              name="confirmPassword"
              render={({ field: { onChange, onBlur, value } }) => (
                <View style={{ marginBottom: 8 }}>
                  <TextInput
                    label="Confirm Password"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    mode="outlined"
                    secureTextEntry
                    error={!!errors.confirmPassword}
                  />
                  {errors.confirmPassword && (
                    <HelperText type="error">{errors.confirmPassword.message}</HelperText>
                  )}
                </View>
              )}
            />

            <Controller
              control={control}
              name="acceptTerms"
              render={({ field: { onChange, value } }) => (
                <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 8 }}>
                  <Checkbox
                    status={value ? 'checked' : 'unchecked'}
                    onPress={() => onChange(!value)}
                  />
                  <Text
                    variant="bodyMedium"
                    style={{ flex: 1, marginLeft: 8 }}
                    onPress={() => onChange(!value)}
                  >
                    I agree to the Terms of Service and Privacy Policy
                  </Text>
                </View>
              )}
            />
            {errors.acceptTerms && (
              <Text style={{ color: theme.colors.error, marginBottom: 16 }}>
                {errors.acceptTerms.message}
              </Text>
            )}

            {error && (
              <Text style={{ textAlign: 'center', marginBottom: 16, color: theme.colors.error }}>
                {error}
              </Text>
            )}

            <Button
              mode="contained"
              onPress={handleSubmit(onSubmit)}
              loading={isLoading}
              style={{ marginTop: 16 }}
            >
              Create Account
            </Button>
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 16 }}>
            <Text variant="bodyMedium" style={{ color: theme.colors.outline }}>
              Already have an account?{' '}
            </Text>
            <Link href="/(auth)/login" asChild>
              <Text
                variant="bodyMedium"
                style={{ fontWeight: '600', color: theme.colors.primary }}
              >
                Sign In
              </Text>
            </Link>
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={['bottom']}
    >
      <LoadingOverlay visible={isLoading} message="Creating account..." />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <Text variant="headlineMedium" style={styles.title}>
              Create Account
            </Text>
            <Text
              variant="bodyLarge"
              style={[styles.subtitle, { color: theme.colors.outline }]}
            >
              Join the democratic process
            </Text>
          </View>

          <View style={styles.form}>
            <Controller
              control={control}
              name="displayName"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label="Full Name"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={errors.displayName?.message}
                  autoCapitalize="words"
                  autoComplete="name"
                  testID="name-input"
                />
              )}
            />

            <Controller
              control={control}
              name="email"
              render={({ field: { onChange, onBlur, value } }) => (
                <EmailInput
                  label="Email"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={errors.email?.message}
                  testID="email-input"
                />
              )}
            />

            <Controller
              control={control}
              name="password"
              render={({ field: { onChange, onBlur, value } }) => (
                <PasswordInput
                  label="Password"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={errors.password?.message}
                  testID="password-input"
                />
              )}
            />

            <Controller
              control={control}
              name="confirmPassword"
              render={({ field: { onChange, onBlur, value } }) => (
                <PasswordInput
                  label="Confirm Password"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={errors.confirmPassword?.message}
                  testID="confirm-password-input"
                />
              )}
            />

            <Controller
              control={control}
              name="acceptTerms"
              render={({ field: { onChange, value } }) => (
                <View style={styles.checkboxContainer}>
                  <Checkbox
                    status={value ? 'checked' : 'unchecked'}
                    onPress={() => onChange(!value)}
                  />
                  <Text
                    variant="bodyMedium"
                    style={styles.checkboxLabel}
                    onPress={() => onChange(!value)}
                  >
                    I agree to the{' '}
                    <Text style={{ color: theme.colors.primary }}>
                      Terms of Service
                    </Text>{' '}
                    and{' '}
                    <Text style={{ color: theme.colors.primary }}>
                      Privacy Policy
                    </Text>
                  </Text>
                </View>
              )}
            />
            {errors.acceptTerms && (
              <Text style={[styles.errorText, { color: theme.colors.error }]}>
                {errors.acceptTerms.message}
              </Text>
            )}

            {error && (
              <Text style={[styles.errorText, { color: theme.colors.error }]}>
                {error}
              </Text>
            )}

            <PrimaryButton
              onPress={handleSubmit(onSubmit)}
              loading={isLoading}
              style={styles.submitButton}
              testID="register-button"
            >
              Create Account
            </PrimaryButton>
          </View>

          <View style={styles.footer}>
            <Text variant="bodyMedium" style={{ color: theme.colors.outline }}>
              Already have an account?{' '}
            </Text>
            <Link href="/(auth)/login" asChild>
              <Text
                variant="bodyMedium"
                style={[styles.linkText, { color: theme.colors.primary }]}
              >
                Sign In
              </Text>
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
  },
  header: {
    marginBottom: 32,
  },
  title: {
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {},
  form: {
    marginBottom: 24,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 8,
  },
  checkboxLabel: {
    flex: 1,
    marginLeft: 8,
  },
  errorText: {
    marginBottom: 16,
  },
  submitButton: {
    marginTop: 16,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 'auto',
    paddingVertical: 16,
  },
  linkText: {
    fontWeight: '600',
  },
});
