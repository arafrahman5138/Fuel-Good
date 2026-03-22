import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ScreenContainer } from '../components/ScreenContainer';
import { useTheme } from '../hooks/useTheme';
import { useAuthStore } from '../stores/authStore';
import { useThemeStore } from '../stores/themeStore';
import { useMetabolicBudgetStore } from '../stores/metabolicBudgetStore';
import { billingService } from '../services/billing';
import { authApi } from '../services/api';
import type { MetabolicProfile } from '../stores/metabolicBudgetStore';
import { BorderRadius, FontSize, Layout, Spacing } from '../constants/Colors';
import { APP_ENV, APP_STORE_MANAGE_SUBSCRIPTIONS_URL, APP_VERSION, PRIVACY_POLICY_URL, SUPPORT_EMAIL, SUPPORT_URL, TERMS_URL } from '../constants/Config';

export default function SettingsScreen() {
  const theme = useTheme();
  const { user, logout } = useAuthStore();
  const { mode, setMode } = useThemeStore();
  const budget = useMetabolicBudgetStore((s) => s.budget);
  const fetchBudget = useMetabolicBudgetStore((s) => s.fetchBudget);
  const updateBudget = useMetabolicBudgetStore((s) => s.updateBudget);
  const profile = useMetabolicBudgetStore((s) => s.profile);
  const fetchProfile = useMetabolicBudgetStore((s) => s.fetchProfile);
  const [showBudgetEditor, setShowBudgetEditor] = useState(false);
  const [proteinW, setProteinW] = useState(0.4);
  const [fiberW, setFiberW] = useState(0.3);
  const [sugarW, setSugarW] = useState(0.3);

  const openExternalLink = async (url: string, fallback?: string) => {
    if (!url) {
      Alert.alert('Unavailable', fallback || 'This link is not configured for this build yet.');
      return;
    }
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('Unavailable', fallback || 'We could not open that link right now.');
    }
  };

  const contactSupport = async () => {
    try {
      await Linking.openURL(`mailto:${SUPPORT_EMAIL}`);
    } catch {
      Alert.alert('Support', `Email us at ${SUPPORT_EMAIL}`);
    }
  };

  const manageSubscription = async () => {
    try {
      if (billingService.isConfiguredForBuild()) {
        await billingService.presentCustomerCenter();
        return;
      }
      const url = user?.entitlement?.manage_url || await billingService.getManageSubscriptionsUrl();
      await Linking.openURL(url || APP_STORE_MANAGE_SUBSCRIPTIONS_URL);
    } catch {
      Alert.alert('Unavailable', 'We could not open App Store subscription management right now.');
    }
  };

  useEffect(() => {
    fetchBudget();
    fetchProfile();
  }, []);

  useEffect(() => {
    if (budget) {
      setProteinW(budget.weight_protein);
      setFiberW(budget.weight_fiber);
      setSugarW(budget.weight_sugar);
    }
  }, [budget]);

  const saveBudgetWeights = async () => {
    // Normalize to sum to 1.0
    const total = proteinW + fiberW + sugarW;
    const pw = proteinW / total;
    const fw = fiberW / total;
    const sw = sugarW / total;
    await updateBudget({
      weight_protein: Math.round(pw * 100) / 100,
      weight_fiber: Math.round(fw * 100) / 100,
      weight_sugar: Math.round(sw * 100) / 100,
    });
    setShowBudgetEditor(false);
  };

  const themeOptions: { id: 'system' | 'light' | 'dark'; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { id: 'system', label: 'System', icon: 'phone-portrait' },
    { id: 'light', label: 'Light', icon: 'sunny' },
    { id: 'dark', label: 'Dark', icon: 'moon' },
  ];

  return (
    <ScreenContainer safeArea={false} padded={false}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* ── Appearance ──────────────────────────────────────────── */}
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Appearance</Text>
        <View style={[styles.themeRow, { backgroundColor: theme.surfaceElevated, borderRadius: BorderRadius.md }]}>
          {themeOptions.map((opt) => (
            <TouchableOpacity
              key={opt.id}
              onPress={() => setMode(opt.id)}
              activeOpacity={0.7}
              style={[
                styles.themeOption,
                mode === opt.id && { backgroundColor: theme.primary },
              ]}
            >
              <Ionicons
                name={opt.icon}
                size={16}
                color={mode === opt.id ? '#FFFFFF' : theme.textSecondary}
              />
              <Text
                style={[
                  styles.themeOptionText,
                  { color: mode === opt.id ? '#FFFFFF' : theme.textSecondary },
                ]}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Energy Budget ─────────────────────────────────────── */}
        <Text style={[styles.sectionTitle, { color: theme.text, marginTop: Spacing.xxl }]}>
          Energy Budget
        </Text>

        <View style={{ backgroundColor: theme.surfaceElevated, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: theme.border, overflow: 'hidden' }}>
          <TouchableOpacity
            activeOpacity={0.75}
            style={[styles.settingsRow, { borderBottomColor: theme.border, borderBottomWidth: showBudgetEditor ? 1 : 0 }]}
            onPress={() => setShowBudgetEditor(!showBudgetEditor)}
          >
            <View style={[styles.settingsIcon, { backgroundColor: 'rgba(245,158,11,0.12)' }]}>
              <Ionicons name="flash" size={18} color="#F59E0B" />
            </View>
            <View style={styles.settingsInfo}>
              <Text style={[styles.settingsLabel, { color: theme.text }]}>Guardrail Weights</Text>
              <Text style={[styles.settingsDesc, { color: theme.textTertiary }]} numberOfLines={1}>
                Customize how your MES is calculated
              </Text>
            </View>
            <Ionicons name={showBudgetEditor ? 'chevron-up' : 'chevron-down'} size={18} color={theme.textTertiary} />
          </TouchableOpacity>

          {showBudgetEditor && (
            <View style={[styles.budgetEditor, { backgroundColor: theme.surfaceElevated, borderColor: theme.border, borderWidth: 0, borderRadius: 0 }]}>
              {[
                { label: 'Protein', color: '#22C55E', value: proteinW, set: setProteinW },
                { label: 'Fiber', color: '#3B82F6', value: fiberW, set: setFiberW },
                { label: 'Sugar (penalty)', color: '#F59E0B', value: sugarW, set: setSugarW },
              ].map((item) => (
                <View key={item.label}>
                  <View style={styles.sliderRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: item.color }} />
                      <Text style={[styles.sliderLabel, { color: theme.text }]}>{item.label}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <TouchableOpacity
                        onPress={() => item.set(Math.max(0.1, Math.round((item.value - 0.05) * 100) / 100))}
                        style={[styles.stepperBtn, { backgroundColor: theme.surfaceHighlight }]}
                      >
                        <Ionicons name="remove" size={16} color={theme.text} />
                      </TouchableOpacity>
                      <Text style={[styles.sliderValue, { color: item.color, minWidth: 36, textAlign: 'center' }]}>{Math.round(item.value * 100)}%</Text>
                      <TouchableOpacity
                        onPress={() => item.set(Math.min(0.8, Math.round((item.value + 0.05) * 100) / 100))}
                        style={[styles.stepperBtn, { backgroundColor: theme.surfaceHighlight }]}
                      >
                        <Ionicons name="add" size={16} color={theme.text} />
                      </TouchableOpacity>
                    </View>
                  </View>
                  {/* Visual bar */}
                  <View style={{ height: 6, backgroundColor: theme.surfaceHighlight, borderRadius: 3, marginTop: 6, overflow: 'hidden' }}>
                    <View style={{ height: '100%', width: `${Math.round(item.value * 100)}%`, backgroundColor: item.color, borderRadius: 3 }} />
                  </View>
                </View>
              ))}

              <Text style={{ color: theme.textTertiary, fontSize: FontSize.xs, marginTop: Spacing.md, textAlign: 'center' }}>
                Weights auto-normalize to 100%. Higher weight = more impact on your score.
              </Text>

              <TouchableOpacity
                onPress={saveBudgetWeights}
                style={{ backgroundColor: theme.primary, paddingVertical: Spacing.sm + 2, borderRadius: BorderRadius.full, marginTop: Spacing.md, alignItems: 'center' }}
              >
                <Text style={{ color: '#fff', fontSize: FontSize.sm, fontWeight: '700' }}>Save Weights</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* ── Metabolic Profile ────────────────────────────────────── */}
        <Text style={[styles.sectionTitle, { color: theme.text, marginTop: Spacing.xxl }]}>
          Metabolic Profile
        </Text>

        <View style={{ backgroundColor: theme.surfaceElevated, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: theme.border, overflow: 'hidden' }}>
          {!profile?.onboarding_step_completed ? (
            <TouchableOpacity
              activeOpacity={0.75}
              style={[styles.settingsRow, { borderBottomWidth: 0 }]}
              onPress={() => router.push('/metabolic-onboarding')}
            >
              <View style={[styles.settingsIcon, { backgroundColor: 'rgba(139,92,246,0.12)' }]}>
                <Ionicons name="person-add" size={18} color="#8B5CF6" />
              </View>
              <View style={styles.settingsInfo}>
                <Text style={[styles.settingsLabel, { color: theme.text }]}>Set Up Profile</Text>
                <Text style={[styles.settingsDesc, { color: theme.textTertiary }]} numberOfLines={1}>
                  Personalize your metabolic scoring
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.textTertiary} />
            </TouchableOpacity>
          ) : (
            <>
              {/* Body & Activity summary */}
              <TouchableOpacity
                activeOpacity={0.75}
                style={[styles.settingsRow, { borderBottomColor: theme.border }]}
                onPress={() => router.push('/metabolic-onboarding')}
              >
                <View style={[styles.settingsIcon, { backgroundColor: 'rgba(139,92,246,0.12)' }]}>
                  <Ionicons name="body" size={18} color="#8B5CF6" />
                </View>
                <View style={styles.settingsInfo}>
                  <Text style={[styles.settingsLabel, { color: theme.text }]}>Body & Activity</Text>
                  <Text style={[styles.settingsDesc, { color: theme.textTertiary }]} numberOfLines={1}>
                    {profile.weight_lb ? `${profile.weight_lb} lbs` : ''}
                    {profile.height_ft ? ` · ${profile.height_ft}′${profile.height_in ?? 0}″` : ''}
                    {profile.activity_level ? ` · ${profile.activity_level}` : ''}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={theme.textTertiary} />
              </TouchableOpacity>

              {/* Body Composition */}
              <TouchableOpacity
                activeOpacity={0.75}
                style={[styles.settingsRow, { borderBottomColor: theme.border }]}
                onPress={() => router.push('/metabolic-onboarding')}
              >
                <View style={[styles.settingsIcon, { backgroundColor: 'rgba(34,197,94,0.12)' }]}>
                  <Ionicons name="fitness" size={18} color="#22C55E" />
                </View>
                <View style={styles.settingsInfo}>
                  <Text style={[styles.settingsLabel, { color: theme.text }]}>Body Composition</Text>
                  <Text style={[styles.settingsDesc, { color: theme.textTertiary }]} numberOfLines={1}>
                    {profile.body_fat_pct ? `${profile.body_fat_pct}% body fat` : 'Not set — default ISM'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={theme.textTertiary} />
              </TouchableOpacity>

              {/* Health Profile */}
              <TouchableOpacity
                activeOpacity={0.75}
                style={[styles.settingsRow, { borderBottomWidth: 0 }]}
                onPress={() => router.push('/metabolic-onboarding')}
              >
                <View style={[styles.settingsIcon, { backgroundColor: 'rgba(239,68,68,0.12)' }]}>
                  <Ionicons name="heart" size={18} color="#EF4444" />
                </View>
                <View style={styles.settingsInfo}>
                  <Text style={[styles.settingsLabel, { color: theme.text }]}>Health Context</Text>
                  <Text style={[styles.settingsDesc, { color: theme.textTertiary }]} numberOfLines={1}>
                    {[
                      profile.insulin_resistant && 'IR',
                      profile.prediabetes && 'Prediabetes',
                      profile.type_2_diabetes && 'T2D',
                    ].filter(Boolean).join(', ') || 'No conditions set'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={theme.textTertiary} />
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* ── Preferences ─────────────────────────────────────────── */}
        <Text style={[styles.sectionTitle, { color: theme.text, marginTop: Spacing.xxl }]}>
          Preferences
        </Text>

        <View style={{ backgroundColor: theme.surfaceElevated, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: theme.border, overflow: 'hidden', marginBottom: Spacing.xs }}>
          <TouchableOpacity
            activeOpacity={0.75}
            style={[styles.settingsRow, { borderBottomColor: theme.border }]}
            onPress={() => router.push('/notification-settings')}
          >
            <View style={[styles.settingsIcon, { backgroundColor: 'rgba(59,130,246,0.12)' }]}>
              <Ionicons name="notifications" size={18} color="#3B82F6" />
            </View>
            <View style={styles.settingsInfo}>
              <Text style={[styles.settingsLabel, { color: theme.text }]}>Push Notifications</Text>
              <Text style={[styles.settingsDesc, { color: theme.textTertiary }]} numberOfLines={1}>
                Control meal reminders, streak saves, and Healthify follow-ups.
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.textTertiary} />
          </TouchableOpacity>
        </View>

        <Text style={[styles.sectionTitle, { color: theme.text, marginTop: Spacing.xxl }]}>
          Legal & Support
        </Text>

        <View style={{ backgroundColor: theme.surfaceElevated, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: theme.border, overflow: 'hidden' }}>
          <TouchableOpacity
            activeOpacity={0.75}
            style={[styles.settingsRow, { borderBottomColor: theme.border }]}
            onPress={manageSubscription}
          >
            <View style={[styles.settingsIcon, { backgroundColor: 'rgba(20,184,166,0.12)' }]}>
              <Ionicons name="card" size={18} color="#0F766E" />
            </View>
            <View style={styles.settingsInfo}>
              <Text style={[styles.settingsLabel, { color: theme.text }]}>Manage Subscription</Text>
              <Text style={[styles.settingsDesc, { color: theme.textTertiary }]} numberOfLines={1}>
                {billingService.isConfiguredForBuild()
                  ? 'Open RevenueCat Customer Center'
                  : user?.entitlement?.subscription_state === 'trialing'
                    ? 'Trial active'
                    : 'Open App Store subscription settings'}
              </Text>
            </View>
            <Ionicons name="open-outline" size={18} color={theme.textTertiary} />
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.75}
            style={[styles.settingsRow, { borderBottomColor: theme.border }]}
            onPress={() => openExternalLink(PRIVACY_POLICY_URL, 'Privacy policy URL has not been configured for this build.')}
          >
            <View style={[styles.settingsIcon, { backgroundColor: 'rgba(37,99,235,0.12)' }]}>
              <Ionicons name="document-text" size={18} color="#2563EB" />
            </View>
            <View style={styles.settingsInfo}>
              <Text style={[styles.settingsLabel, { color: theme.text }]}>Privacy Policy</Text>
              <Text style={[styles.settingsDesc, { color: theme.textTertiary }]} numberOfLines={1}>
                Review how Fuel Good handles account, photo, and diagnostics data.
              </Text>
            </View>
            <Ionicons name="open-outline" size={18} color={theme.textTertiary} />
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.75}
            style={[styles.settingsRow, { borderBottomColor: theme.border }]}
            onPress={() => openExternalLink(TERMS_URL, 'Terms of service URL has not been configured for this build.')}
          >
            <View style={[styles.settingsIcon, { backgroundColor: 'rgba(34,197,94,0.12)' }]}>
              <Ionicons name="shield-checkmark" size={18} color="#16A34A" />
            </View>
            <View style={styles.settingsInfo}>
              <Text style={[styles.settingsLabel, { color: theme.text }]}>Terms of Service</Text>
              <Text style={[styles.settingsDesc, { color: theme.textTertiary }]} numberOfLines={1}>
                Review wellness-only product terms and acceptable use.
              </Text>
            </View>
            <Ionicons name="open-outline" size={18} color={theme.textTertiary} />
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.75}
            style={[styles.settingsRow, { borderBottomColor: theme.border }]}
            onPress={contactSupport}
          >
            <View style={[styles.settingsIcon, { backgroundColor: 'rgba(245,158,11,0.12)' }]}>
              <Ionicons name="mail" size={18} color="#D97706" />
            </View>
            <View style={styles.settingsInfo}>
              <Text style={[styles.settingsLabel, { color: theme.text }]}>Support</Text>
              <Text style={[styles.settingsDesc, { color: theme.textTertiary }]} numberOfLines={1}>
                {SUPPORT_EMAIL}
              </Text>
            </View>
            <Ionicons name="open-outline" size={18} color={theme.textTertiary} />
          </TouchableOpacity>

          {SUPPORT_URL ? (
            <TouchableOpacity
              activeOpacity={0.75}
              style={[styles.settingsRow, { borderBottomWidth: 0 }]}
              onPress={() => openExternalLink(SUPPORT_URL)}
            >
              <View style={[styles.settingsIcon, { backgroundColor: 'rgba(168,85,247,0.12)' }]}>
                <Ionicons name="help-circle" size={18} color="#A855F7" />
              </View>
              <View style={styles.settingsInfo}>
                <Text style={[styles.settingsLabel, { color: theme.text }]}>Support Center</Text>
                <Text style={[styles.settingsDesc, { color: theme.textTertiary }]} numberOfLines={1}>
                  Open the public support and status page.
                </Text>
              </View>
              <Ionicons name="open-outline" size={18} color={theme.textTertiary} />
            </TouchableOpacity>
          ) : null}
        </View>

        <Text style={[styles.sectionTitle, { color: theme.text, marginTop: Spacing.xxl }]}>
          Build Info
        </Text>
        <View style={[styles.infoCard, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
          <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Environment</Text>
          <Text style={[styles.infoValue, { color: theme.text }]}>{APP_ENV}</Text>
          <Text style={[styles.infoLabel, { color: theme.textSecondary, marginTop: Spacing.sm }]}>Version</Text>
          <Text style={[styles.infoValue, { color: theme.text }]}>{APP_VERSION}</Text>
        </View>

        <View style={{ backgroundColor: theme.surfaceElevated, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: theme.border, overflow: 'hidden' }}>
          <TouchableOpacity
            activeOpacity={0.75}
            style={[styles.settingsRow, { borderBottomColor: theme.border }]}
            onPress={() => router.push('/saved')}
          >
            <View style={[styles.settingsIcon, { backgroundColor: theme.primaryMuted }]}>
              <Ionicons name="bookmark" size={18} color={theme.primary} />
            </View>
            <View style={styles.settingsInfo}>
              <Text style={[styles.settingsLabel, { color: theme.text }]}>Saved Recipes</Text>
              <Text style={[styles.settingsDesc, { color: theme.textTertiary }]} numberOfLines={1}>
                View all recipes you bookmarked
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.textTertiary} />
          </TouchableOpacity>

          {[
          {
            icon: 'nutrition' as const,
            label: 'Dietary Preferences',
            desc: user?.dietary_preferences?.join(', ') || 'Not set',
            section: 'dietary',
          },
          {
            icon: 'flame' as const,
            label: 'Flavor Profile',
            desc: user?.flavor_preferences?.join(', ') || 'Not set',
            section: 'flavor',
          },
          {
            icon: 'alert-circle' as const,
            label: 'Allergies',
            desc: user?.allergies?.join(', ') || 'None',
            section: 'allergies',
          },
          {
            icon: 'close-circle' as const,
            label: 'Disliked Ingredients',
            desc: user?.disliked_ingredients?.join(', ') || 'None',
            section: 'disliked',
          },
          {
            icon: 'restaurant' as const,
            label: 'Liked Proteins',
            desc: user?.protein_preferences?.liked?.join(', ') || 'Not set',
            section: 'liked_proteins',
          },
          {
            icon: 'remove-circle' as const,
            label: 'Proteins to Avoid',
            desc: user?.protein_preferences?.disliked?.join(', ') || 'None',
            section: 'disliked_proteins',
          },
          {
            icon: 'people' as const,
            label: 'Household Size',
            desc: `${user?.household_size || 1} person(s)`,
            section: 'household',
          },
        ].map((item, index, arr) => (
          <TouchableOpacity
            key={index}
            activeOpacity={0.7}
            style={[styles.settingsRow, { borderBottomColor: theme.border, borderBottomWidth: index === arr.length - 1 ? 0 : 1 }]}
            onPress={() => router.push({ pathname: '/preferences', params: { section: item.section } })}
          >
            <View style={[styles.settingsIcon, { backgroundColor: theme.primaryMuted }]}>
              <Ionicons name={item.icon} size={18} color={theme.primary} />
            </View>
            <View style={styles.settingsInfo}>
              <Text style={[styles.settingsLabel, { color: theme.text }]}>{item.label}</Text>
              <Text style={[styles.settingsDesc, { color: theme.textTertiary }]} numberOfLines={1}>
                {item.desc}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.textTertiary} />
          </TouchableOpacity>
        ))}
        </View>

        {/* ── Sign Out ────────────────────────────────────────────── */}
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => {
            Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Sign Out',
                style: 'destructive',
                onPress: () => {
                  logout();
                  router.replace('/(auth)/login');
                },
              },
            ]);
          }}
          style={[styles.signOutBtn, { backgroundColor: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.20)' }]}
        >
          <Ionicons name="log-out-outline" size={18} color="#EF4444" />
          <Text style={[styles.signOutText, { color: '#EF4444' }]}>Sign Out</Text>
        </TouchableOpacity>

        {/* ── Delete Account ────────────────────────────────────── */}
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => {
            Alert.alert(
              'Delete Account',
              'This will permanently delete your account and all your data. This action cannot be undone.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete Account',
                  style: 'destructive',
                  onPress: () => {
                    Alert.alert(
                      'Are you absolutely sure?',
                      'All your meal plans, saved recipes, scan history, and preferences will be permanently deleted.',
                      [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Yes, Delete Everything',
                          style: 'destructive',
                          onPress: async () => {
                            try {
                              await authApi.deleteAccount();
                              logout();
                              router.replace('/(auth)/login');
                            } catch (err: any) {
                              Alert.alert('Error', err?.message || 'Failed to delete account. Please contact support.');
                            }
                          },
                        },
                      ],
                    );
                  },
                },
              ],
            );
          }}
          style={[styles.signOutBtn, { backgroundColor: theme.errorMuted, borderColor: theme.error + '25', marginTop: Spacing.sm }]}
        >
          <Ionicons name="trash-outline" size={18} color={theme.error} />
          <Text style={[styles.signOutText, { color: theme.error }]}>Delete Account</Text>
        </TouchableOpacity>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingTop: Spacing.xxxl,
    paddingBottom: Layout.scrollBottomPadding,
    paddingHorizontal: Spacing.xl,
  },
  sectionTitle: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    marginBottom: Spacing.md,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  themeRow: {
    flexDirection: 'row',
    padding: 4,
  },
  themeOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: Spacing.sm + 2,
    borderRadius: BorderRadius.sm,
  },
  themeOptionText: {
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderBottomWidth: 1,
    gap: Spacing.md,
  },
  settingsIcon: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsInfo: {
    flex: 1,
  },
  settingsLabel: {
    fontSize: FontSize.md,
    fontWeight: '600',
  },
  settingsDesc: {
    fontSize: FontSize.sm,
    marginTop: 1,
  },
  infoCard: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
  },
  infoLabel: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  infoValue: {
    fontSize: FontSize.md,
    fontWeight: '700',
    marginTop: 2,
  },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.xxl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  signOutText: {
    fontSize: FontSize.md,
    fontWeight: '700',
  },
  budgetEditor: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    padding: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  sliderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  sliderLabel: {
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  sliderValue: {
    fontSize: FontSize.sm,
    fontWeight: '800',
  },
  stepperBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
