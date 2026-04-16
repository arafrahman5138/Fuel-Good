import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { Button } from '../../components/Button';
import { BorderRadius, FontSize, Spacing } from '../../constants/Colors';
import { useTheme } from '../../hooks/useTheme';
import { authApi } from '../../services/api';

export default function ForgotPasswordScreen() {
  const theme = useTheme();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [devCode, setDevCode] = useState('');

  const handleRequestReset = async () => {
    setError('');
    setMessage('');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Enter a valid email address');
      return;
    }

    setLoading(true);
    try {
      const result = await authApi.requestPasswordReset({ email });
      setMessage(result.message);
      if (result.reset_code) {
        setDevCode(result.reset_code);
        setCode(result.reset_code);
      }
    } catch (err: any) {
      setError(err.message || 'Unable to request password reset');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    setError('');
    setMessage('');
    if (!/^\d{6,8}$/.test(code.trim())) {
      setError('Enter the reset code from your email');
      return;
    }
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (!/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      setError('Password must contain uppercase, lowercase, and a number');
      return;
    }

    setLoading(true);
    try {
      const result = await authApi.resetPassword({
        email: email.trim(),
        code: code.trim(),
        new_password: newPassword,
      });
      setMessage(result.message);
      setNewPassword('');
    } catch (err: any) {
      setError(err.message || 'Unable to reset password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.content}>
            <Text style={[styles.title, { color: theme.text }]}>Reset Password</Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              Request a reset code, then enter it here with your new password.
            </Text>

            {error ? (
              <View style={[styles.notice, { backgroundColor: theme.errorMuted }]}>
                <Text style={[styles.noticeText, { color: theme.error }]}>{error}</Text>
              </View>
            ) : null}

            {message ? (
              <View style={[styles.notice, { backgroundColor: theme.surfaceElevated, borderColor: theme.border, borderWidth: 1 }]}>
                <Text style={[styles.noticeText, { color: theme.text }]}>{message}</Text>
              </View>
            ) : null}

            <View style={styles.group}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>Email</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.surfaceElevated, color: theme.text, borderColor: theme.border }]}
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor={theme.textTertiary}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <Button
              title="Request Reset"
              onPress={handleRequestReset}
              loading={loading}
              fullWidth
              size="lg"
            />

            {devCode ? (
              <View style={styles.group}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>Dev Reset Code</Text>
                <Text selectable style={[styles.tokenBox, { color: theme.text, backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
                  {devCode}
                </Text>
              </View>
            ) : null}

            <View style={styles.group}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>Reset Code</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.surfaceElevated, color: theme.text, borderColor: theme.border }]}
                value={code}
                onChangeText={(value) => setCode(value.replace(/\D/g, '').slice(0, 8))}
                placeholder="12345678"
                placeholderTextColor={theme.textTertiary}
                keyboardType="number-pad"
              />
            </View>

            <View style={styles.group}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>New Password</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.surfaceElevated, color: theme.text, borderColor: theme.border }]}
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="At least 8 characters"
                placeholderTextColor={theme.textTertiary}
                secureTextEntry
              />
            </View>

            <Button
              title="Save New Password"
              onPress={handleResetPassword}
              loading={loading}
              fullWidth
              size="lg"
            />

            <TouchableOpacity onPress={() => router.back()} style={styles.backLink}>
              <Text style={[styles.backText, { color: theme.primary }]}>Back to sign in</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.huge,
  },
  content: {
    gap: Spacing.md,
  },
  title: {
    fontSize: FontSize.xxl,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: FontSize.sm,
    lineHeight: 20,
    marginBottom: Spacing.sm,
  },
  group: {
    gap: Spacing.sm,
  },
  label: {
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    fontSize: FontSize.md,
  },
  notice: {
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
  },
  noticeText: {
    fontSize: FontSize.sm,
    lineHeight: 20,
  },
  tokenBox: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: FontSize.xs,
  },
  backLink: {
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  backText: {
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
});
