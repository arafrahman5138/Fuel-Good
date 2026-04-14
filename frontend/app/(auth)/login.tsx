import React, { useState, useEffect, useRef } from 'react';
import {
  Animated,
  View,
  Text,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  Alert,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useTheme } from '../../hooks/useTheme';
import { useThemeStore } from '../../stores/themeStore';
import { Button } from '../../components/Button';
import { BorderRadius, FontSize, Spacing } from '../../constants/Colors';
import { Shadows } from '../../constants/Shadows';
import { hasActivePremiumAccess, useAuthStore } from '../../stores/authStore';
import { authApi } from '../../services/api';
import { APP_NAME, GOOGLE_CLIENT_ID, GOOGLE_IOS_CLIENT_ID, IS_GOOGLE_AUTH_CONFIGURED } from '../../constants/Config';

WebBrowser.maybeCompleteAuthSession();

const redirectUri = AuthSession.makeRedirectUri({
  scheme: 'fuelgood',
  path: 'auth',
});

function getPostLoginRoute(profile: any): string {
  const needsOnboarding =
    !profile?.flavor_preferences?.length || !profile?.dietary_preferences?.length;

  if (needsOnboarding) {
    return '/(auth)/onboarding';
  }

  if (hasActivePremiumAccess(profile?.entitlement)) {
    return '/(tabs)';
  }

  return '/subscribe';
}

export default function LoginScreen() {
  const theme = useTheme();
  const isDark = theme.background === '#0A0A0F';
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string; name?: string }>({});
  const { setTokens, setUser } = useAuthStore();

  // Error shake animation
  const errorShake = useRef(new Animated.Value(0)).current;
  const errorOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (error) {
      errorOpacity.setValue(0);
      errorShake.setValue(0);
      Animated.parallel([
        Animated.timing(errorOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.sequence([
          Animated.timing(errorShake, { toValue: 10, duration: 50, useNativeDriver: true }),
          Animated.timing(errorShake, { toValue: -10, duration: 50, useNativeDriver: true }),
          Animated.timing(errorShake, { toValue: 6, duration: 50, useNativeDriver: true }),
          Animated.timing(errorShake, { toValue: 0, duration: 50, useNativeDriver: true }),
        ]),
      ]).start();
    }
  }, [error]);

  // Google OAuth configuration
  const [googleRequest, googleResponse, googlePromptAsync] = AuthSession.useAuthRequest(
    {
      clientId: Platform.OS === 'ios' ? GOOGLE_IOS_CLIENT_ID : GOOGLE_CLIENT_ID,
      redirectUri,
      scopes: ['profile', 'email'],
      responseType: AuthSession.ResponseType.Token,
    },
    { authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth' }
  );

  // Handle Google OAuth response
  React.useEffect(() => {
    if (googleResponse?.type === 'success') {
      const { access_token } = googleResponse.params;
      handleGoogleAuth(access_token);
    }
  }, [googleResponse]);

  const handleGoogleAuth = async (accessToken: string) => {
    setLoading(true);
    try {
      // Fetch user info from Google
      const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const userInfo = await userInfoResponse.json();

      // Send to backend
      const result = await authApi.socialAuth({
        provider: 'google',
        token: accessToken,
        name: userInfo.name,
        email: userInfo.email,
      });

      setTokens(result.access_token, result.refresh_token);
      const profile = await authApi.getProfile();
      setUser(profile);
    } catch (err: any) {
      setError(err.message || 'Google sign-in failed');
    } finally {
      setLoading(false);
    }
  };

  const handleAppleAuth = async () => {
    setLoading(true);
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      // Apple provides name and email on first sign-in only
      const firstName = credential.fullName?.givenName || '';
      const lastName = credential.fullName?.familyName || '';
      const name = `${firstName} ${lastName}`.trim() || 'Apple User';

      // Send to backend
      const result = await authApi.socialAuth({
        provider: 'apple',
        token: credential.identityToken || '',
        name,
        email: credential.email || undefined,
        provider_subject: credential.user,
      });

      setTokens(result.access_token, result.refresh_token);
      const profile = await authApi.getProfile();
      setUser(profile);
    } catch (err: any) {
      if (err.code === 'ERR_CANCELED') {
        // User canceled the sign-in flow
        setLoading(false);
        return;
      }
      setError(err.message || 'Apple sign-in failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    setError('');
    const errors: { email?: string; password?: string; name?: string } = {};
    if (isRegister && !name.trim()) errors.name = 'Name is required';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Enter a valid email address';
    if (password.length < 8) {
      errors.password = 'Password must be at least 8 characters';
    } else if (isRegister && (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password))) {
      errors.password = 'Password must contain uppercase, lowercase, and a number';
    }
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setLoading(true);
    try {
      let result;
      if (isRegister) {
        result = await authApi.register({ email, password, name });
      } else {
        result = await authApi.login({ email, password });
      }
      setTokens(result.access_token, result.refresh_token);
      const profile = await authApi.getProfile();
      setUser(profile);
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleSocialAuth = async (provider: string) => {
    if (provider === 'google') {
      // Check if Google OAuth is configured
      const clientId = Platform.OS === 'ios' ? GOOGLE_IOS_CLIENT_ID : GOOGLE_CLIENT_ID;
      if (!IS_GOOGLE_AUTH_CONFIGURED || !clientId) {
        Alert.alert(
          'OAuth Not Configured',
          'Google OAuth credentials are not configured. Set EXPO_PUBLIC_GOOGLE_CLIENT_ID and EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID before shipping this build.',
          [{ text: 'OK' }]
        );
        return;
      }
      googlePromptAsync().catch(() => {
        setError('Google sign-in failed');
      });
    } else if (provider === 'apple') {
      // Check if running on iOS
      if (Platform.OS !== 'ios') {
        Alert.alert(
          'Not Available',
          'Apple Sign-In is only available on iOS devices.',
          [{ text: 'OK' }]
        );
        return;
      }
      await handleAppleAuth();
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
        <View style={styles.heroSection}>
          <View style={[styles.heroGradientWrapper, Shadows.interactive(isDark)]}>
            <LinearGradient
              colors={['#22C55E', '#059669', '#0891B2'] as const}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.heroGradient}
            >
              <Image
                source={require('../../assets/images/icon-white-transparent.png')}
                style={styles.heroLogo}
                resizeMode="contain"
              />
            </LinearGradient>
          </View>
          <Text style={[styles.appName, { color: theme.text }]}>{APP_NAME}</Text>
          <Text style={[styles.tagline, { color: theme.textSecondary }]}>
            Eat real. Feel amazing.
          </Text>
        </View>

        <View style={styles.formSection}>
          <Text style={[styles.formTitle, { color: theme.text }]}>
            {isRegister ? 'Create Account' : 'Welcome Back'}
          </Text>

          {error ? (
            <Animated.View
              style={[
                styles.errorBox,
                {
                  backgroundColor: theme.errorMuted,
                  opacity: errorOpacity,
                  transform: [{ translateX: errorShake }],
                },
              ]}
            >
              <Text style={[styles.errorText, { color: theme.error }]}>{error}</Text>
            </Animated.View>
          ) : null}

          {isRegister && (
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Full Name</Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.surfaceElevated,
                    color: theme.text,
                    borderColor: focusedField === 'name' ? theme.primary : theme.border,
                    borderWidth: focusedField === 'name' ? 1.5 : 1,
                  },
                ]}
                value={name}
                onChangeText={(v) => { setName(v); setFieldErrors((p) => ({ ...p, name: undefined })); }}
                onFocus={() => setFocusedField('name')}
                onBlur={() => setFocusedField(null)}
                placeholder="Your name"
                placeholderTextColor={theme.textTertiary}
                autoCapitalize="words"
              />
              {fieldErrors.name && <Text style={[styles.fieldError, { color: theme.error }]}>{fieldErrors.name}</Text>}
            </View>
          )}

          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Email</Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: theme.surfaceElevated,
                  color: theme.text,
                  borderColor: focusedField === 'email' ? theme.primary : theme.border,
                  borderWidth: focusedField === 'email' ? 1.5 : 1,
                },
              ]}
              value={email}
              onChangeText={(v) => { setEmail(v); setFieldErrors((p) => ({ ...p, email: undefined })); }}
              onFocus={() => setFocusedField('email')}
              onBlur={() => setFocusedField(null)}
              placeholder="you@example.com"
              placeholderTextColor={theme.textTertiary}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            {fieldErrors.email && <Text style={[styles.fieldError, { color: theme.error }]}>{fieldErrors.email}</Text>}
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Password</Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: theme.surfaceElevated,
                  color: theme.text,
                  borderColor: focusedField === 'password' ? theme.primary : theme.border,
                  borderWidth: focusedField === 'password' ? 1.5 : 1,
                },
              ]}
              value={password}
              onChangeText={(v) => { setPassword(v); setFieldErrors((p) => ({ ...p, password: undefined })); }}
              onFocus={() => setFocusedField('password')}
              onBlur={() => setFocusedField(null)}
              placeholder="Enter password"
              placeholderTextColor={theme.textTertiary}
              secureTextEntry
            />
            {fieldErrors.password && <Text style={[styles.fieldError, { color: theme.error }]}>{fieldErrors.password}</Text>}
          </View>

          {!isRegister ? (
            <TouchableOpacity onPress={() => router.push('/(auth)/forgot-password')} style={styles.forgotLink}>
              <Text style={[styles.forgotText, { color: theme.primary }]}>Forgot password?</Text>
            </TouchableOpacity>
          ) : null}

          <Button
            title={isRegister ? 'Create Account' : 'Sign In'}
            onPress={handleSubmit}
            loading={loading}
            fullWidth
            size="lg"
            style={{ marginTop: Spacing.md }}
          />

          <View style={styles.divider}>
            <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
            <Text style={[styles.dividerText, { color: theme.textTertiary }]}>or continue with</Text>
            <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
          </View>

          <View style={styles.socialRow}>
            <TouchableOpacity
              style={[
                styles.socialButton,
                {
                  backgroundColor: theme.surfaceElevated,
                  borderColor: theme.border,
                  opacity: IS_GOOGLE_AUTH_CONFIGURED ? 1 : 0.5,
                  ...Shadows.sm(isDark),
                },
              ]}
              onPress={() => handleSocialAuth('google')}
              disabled={!IS_GOOGLE_AUTH_CONFIGURED}
              activeOpacity={0.7}
            >
              <Ionicons name="logo-google" size={20} color={theme.text} />
              <Text style={[styles.socialText, { color: theme.text }]}>Google</Text>
            </TouchableOpacity>
            {Platform.OS === 'ios' && (
              <TouchableOpacity
                style={[styles.socialButton, { backgroundColor: theme.surfaceElevated, borderColor: theme.border, ...Shadows.sm(isDark) }]}
                onPress={() => handleSocialAuth('apple')}
                activeOpacity={0.7}
              >
                <Ionicons name="logo-apple" size={20} color={theme.text} />
                <Text style={[styles.socialText, { color: theme.text }]}>Apple</Text>
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity onPress={() => { setIsRegister(!isRegister); setError(''); setFieldErrors({}); setPassword(''); }} style={styles.toggleAuth}>
            <Text style={[styles.toggleText, { color: theme.textSecondary }]}>
              {isRegister ? 'Already have an account? ' : "Don't have an account? "}
              <Text style={{ color: theme.primary, fontWeight: '700' }}>
                {isRegister ? 'Sign In' : 'Sign Up'}
              </Text>
            </Text>
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
    paddingVertical: Spacing.xxxl,
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: Spacing.huge,
  },
  heroGradientWrapper: {
    width: 88,
    height: 88,
    borderRadius: 22,
    overflow: 'hidden',
    marginBottom: Spacing.lg,
  },
  heroGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroLogo: {
    width: 50,
    height: 50,
  },
  appName: {
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: -1.2,
  },
  tagline: {
    fontSize: FontSize.xs,
    marginTop: Spacing.sm,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  formSection: {
    gap: Spacing.md,
  },
  formTitle: {
    fontSize: FontSize.xxl,
    fontWeight: '700',
    marginBottom: Spacing.sm,
  },
  errorBox: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  errorText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  fieldError: {
    fontSize: FontSize.xs,
    fontWeight: '500',
    marginTop: 2,
  },
  inputGroup: {
    gap: Spacing.xs + 2,
  },
  forgotLink: {
    alignSelf: 'flex-end',
    marginTop: -4,
  },
  forgotText: {
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  inputLabel: {
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  input: {
    height: 52,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    paddingHorizontal: Spacing.lg,
    fontSize: FontSize.md,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginVertical: Spacing.lg,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    fontSize: FontSize.xs,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  socialRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  socialButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    height: 56,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  socialText: {
    fontSize: FontSize.md,
    fontWeight: '600',
  },
  toggleAuth: {
    alignItems: 'center',
    paddingVertical: Spacing.lg,
  },
  toggleText: {
    fontSize: FontSize.md,
  },
});
