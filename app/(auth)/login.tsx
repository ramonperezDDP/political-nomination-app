import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
} from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { Link, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { useAuthStore } from '@/stores';
import {
  PrimaryButton,
  TextButton,
  EmailInput,
  PasswordInput,
  LoadingOverlay,
} from '@/components/ui';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function LoginScreen() {
  const theme = useTheme();
  const { signIn, isLoading, error, clearError } = useAuthStore();
  const [showForgotPassword, setShowForgotPassword] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (data: LoginFormData) => {
    clearError();
    const success = await signIn(data.email, data.password);
    if (success) {
      router.replace('/(tabs)');
    }
  };

  // Web login — uses Paper components directly to avoid SafeAreaView/KeyboardAvoidingView style issues
  if (Platform.OS === 'web') {
    const { TextInput, Button, HelperText, ActivityIndicator } = require('react-native-paper');
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        {isLoading && (
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', zIndex: 10 }}>
            <ActivityIndicator size="large" color="#fff" />
            <Text style={{ color: '#fff', marginTop: 12 }}>Signing in...</Text>
          </View>
        )}
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24, maxWidth: 400, alignSelf: 'center', width: '100%' }}>
          <View style={{ alignItems: 'center', marginBottom: 40 }}>
            <Image
              source={require('../../assets/amsp-logo.png')}
              style={{ width: 200, height: 80, marginBottom: 24 }}
              resizeMode="contain"
            />
            <Text variant="headlineMedium" style={{ fontWeight: 'bold', marginBottom: 8 }}>
              Welcome Back
            </Text>
            <Text variant="bodyLarge" style={{ color: theme.colors.outline }}>
              Sign in to continue
            </Text>
          </View>

          <View style={{ marginBottom: 24 }}>
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
              Sign In
            </Button>
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center' }}>
            <Text variant="bodyMedium" style={{ color: theme.colors.outline }}>
              Don't have an account?{' '}
            </Text>
            <Link href="/(auth)/register" asChild>
              <Text
                variant="bodyMedium"
                style={{ fontWeight: '600', color: theme.colors.primary }}
              >
                Create Account
              </Text>
            </Link>
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <LoadingOverlay visible={isLoading} message="Signing in..." />

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
            <Image
              source={require('../../assets/amsp-logo.png')}
              style={styles.logoPlaceholder}
              resizeMode="contain"
            />
            <Text variant="headlineMedium" style={styles.title}>
              Welcome Back
            </Text>
            <Text
              variant="bodyLarge"
              style={[styles.subtitle, { color: theme.colors.outline }]}
            >
              Sign in to continue
            </Text>
          </View>

          <View style={styles.form}>
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

            {error && (
              <Text style={[styles.errorText, { color: theme.colors.error }]}>
                {error}
              </Text>
            )}

            <TextButton
              onPress={() => router.push('/(auth)/forgot-password')}
              style={styles.forgotButton}
            >
              Forgot Password?
            </TextButton>

            <PrimaryButton
              onPress={handleSubmit(onSubmit)}
              loading={isLoading}
              style={styles.submitButton}
              testID="login-button"
            >
              Sign In
            </PrimaryButton>
          </View>

          <View style={styles.footer}>
            <Text variant="bodyMedium" style={{ color: theme.colors.outline }}>
              Don't have an account?{' '}
            </Text>
            <Link href="/(auth)/register" asChild>
              <Text
                variant="bodyMedium"
                style={[styles.linkText, { color: theme.colors.primary }]}
              >
                Create Account
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
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoPlaceholder: {
    width: 200,
    height: 80,
    marginBottom: 24,
  },
  title: {
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    textAlign: 'center',
  },
  form: {
    marginBottom: 24,
  },
  errorText: {
    textAlign: 'center',
    marginBottom: 16,
  },
  forgotButton: {
    alignSelf: 'flex-end',
    marginBottom: 16,
  },
  submitButton: {
    marginTop: 8,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  linkText: {
    fontWeight: '600',
  },
});
