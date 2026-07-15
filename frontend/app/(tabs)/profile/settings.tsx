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
import { ScreenContainer } from '../../../components/ScreenContainer';
import { AppScreenHeader } from '../../../components/AppScreenHeader';
import { SettingsRow } from '../../../components/ui/SettingsRow';
import { DangerButton } from '../../../components/ui/DangerButton';
import { useTheme } from '../../../hooks/useTheme';
import { useAuthStore } from '../../../stores/authStore';
import { useThemeStore } from '../../../stores/themeStore';
import { useMetabolicBudgetStore } from '../../../stores/metabolicBudgetStore';
import { billingService } from '../../../services/billing';
import { authApi } from '../../../services/api';
import { pluralize } from '../../../utils/format';
import { BorderRadius, FontSize, Layout, Spacing } from '../../../constants/Colors';
import { APP_STORE_MANAGE_SUBSCRIPTIONS_URL, APP_VERSION, PRIVACY_POLICY_URL, SUPPORT_EMAIL, SUPPORT_URL, TERMS_URL } from '../../../constants/Config';

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

  const [isSavingWeights, setIsSavingWeights] = useState(false);
  const saveBudgetWeights = async () => {
    const total = proteinW + fiberW + sugarW;
    const pw = proteinW / total;
    const fw = fiberW / total;
    const sw = sugarW / total;
    setIsSavingWeights(true);
    try {
      await updateBudget({
        weight_protein: Math.round(pw * 100) / 100,
        weight_fiber: Math.round(fw * 100) / 100,
        weight_sugar: Math.round(sw * 100) / 100,
      });
      setShowBudgetEditor(false);
    } catch {
      Alert.alert('Error', 'Failed to save weights. Please try again.');
    } finally {
      setIsSavingWeights(false);
    }
  };

  const themeOptions: { id: 'system' | 'light' | 'dark'; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { id: 'system', label: 'System', icon: 'phone-portrait' },
    { id: 'light', label: 'Light', icon: 'sunny' },
    { id: 'dark', label: 'Dark', icon: 'moon' },
  ];

  /**
   * Icon-tile tone grammar (tint = MEANING, not decoration):
   *   brand   → Food & Diet rows (core real-food pillar)
   *   info    → Notifications
   *   premium → Metabolic profile/body rows + Manage Subscription (paid pillar)
   *   warn    → clinically-sensitive or scoring-caution rows (Health Context,
   *             Guardrail Weights) — deliberately NOT danger; nothing is broken
   *   neutral → Support, Privacy, Terms (housekeeping)
   *
   * Trailing grammar: 'chevron' = in-app drill-in, 'external' = leaves the
   * app (mailto, web, RevenueCat/App Store), 'expand' = in-place accordion.
   */
  const foodDietRows: {
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    desc: string;
    onPress: () => void;
  }[] = [
    {
      icon: 'bookmark',
      label: 'Saved Recipes',
      desc: 'View all recipes you bookmarked',
      onPress: () => router.push('/(tabs)/meals/saved'),
    },
    ...([
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
        desc: (user?.protein_preferences?.liked?.length ? user.protein_preferences.liked.join(', ') : null) || 'Not set',
        section: 'liked_proteins',
      },
      {
        icon: 'remove-circle' as const,
        label: 'Proteins to Avoid',
        desc: (user?.protein_preferences?.disliked?.length ? user.protein_preferences.disliked.join(', ') : null) || 'None',
        section: 'disliked_proteins',
      },
      {
        icon: 'people' as const,
        label: 'Household Size',
        desc: pluralize(user?.household_size || 1, 'person', 'people'),
        section: 'household',
      },
    ].map((item) => ({
      icon: item.icon,
      label: item.label,
      desc: item.desc,
      onPress: () => router.push({ pathname: '/(tabs)/profile/preferences', params: { section: item.section } }),
    }))),
  ];

  const divider = <View style={{ height: 1, backgroundColor: theme.border }} />;

  return (
    <ScreenContainer safeArea={false} padded={false}>
      <AppScreenHeader title="Settings" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* ══════════════════════════════════════════════════════
            1. APPEARANCE
           ══════════════════════════════════════════════════════ */}
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

        {/* ══════════════════════════════════════════════════════
            2. FOOD & DIET
           ══════════════════════════════════════════════════════ */}
        <Text style={[styles.sectionTitle, { color: theme.text, marginTop: Spacing.xxl }]}>
          Food & Diet
        </Text>

        <View style={[styles.card, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
          {foodDietRows.map((item, index) => (
            <React.Fragment key={item.label}>
              {index > 0 && divider}
              <SettingsRow
                icon={item.icon}
                iconTone="brand"
                label={item.label}
                desc={item.desc}
                onPress={item.onPress}
              />
            </React.Fragment>
          ))}
        </View>

        {/* ══════════════════════════════════════════════════════
            3. NOTIFICATIONS
           ══════════════════════════════════════════════════════ */}
        <Text style={[styles.sectionTitle, { color: theme.text, marginTop: Spacing.xxl }]}>
          Notifications
        </Text>

        <View style={[styles.card, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
          <SettingsRow
            icon="notifications"
            iconTone="info"
            label="Push Notifications"
            desc="Meal reminders, streak saves, and follow-ups"
            onPress={() => router.push('/(tabs)/profile/notification-settings')}
          />
        </View>

        {/* ══════════════════════════════════════════════════════
            4. HEALTH & SCORING
           ══════════════════════════════════════════════════════ */}
        <Text style={[styles.sectionTitle, { color: theme.text, marginTop: Spacing.xxl }]}>
          Health & Scoring
        </Text>

        {/* Metabolic Profile */}
        <View style={[styles.card, { backgroundColor: theme.surfaceElevated, borderColor: theme.border, marginBottom: Spacing.md }]}>
          {!profile?.onboarding_step_completed ? (
            <SettingsRow
              icon="person-add"
              iconTone="premium"
              label="Set Up Profile"
              desc="Personalize your metabolic scoring"
              onPress={() => router.push('/(tabs)/chronometer/metabolic-onboarding')}
            />
          ) : (
            <>
              <SettingsRow
                icon="body"
                iconTone="premium"
                label="Body & Activity"
                desc={[
                  profile.weight_lb ? `${profile.weight_lb} lbs` : '',
                  profile.height_ft ? ` · ${profile.height_ft}'${profile.height_in ?? 0}"` : '',
                  profile.activity_level ? ` · ${profile.activity_level}` : '',
                ].join('')}
                onPress={() => router.push('/(tabs)/chronometer/metabolic-onboarding')}
              />
              {divider}
              {/* Pass-5 F11: was "Not set — default ISM". The acronym was undefined
                  anywhere visible in the app, so new users saw jargon. Expanded
                  to the full term so the meaning is guessable in context. */}
              <SettingsRow
                icon="fitness"
                iconTone="premium"
                label="Body Composition"
                desc={profile.body_fat_pct ? `${profile.body_fat_pct}% body fat` : 'Not set — default Insulin Sensitivity Multiplier'}
                onPress={() => router.push('/(tabs)/chronometer/metabolic-onboarding')}
              />
              {divider}
              <SettingsRow
                icon="heart"
                iconTone="warn"
                label="Health Context"
                desc={[
                  (profile as any).hypertension && 'Hypertension',
                  profile.insulin_resistant && 'Insulin resistance',
                  profile.prediabetes && 'Prediabetes',
                  profile.type_2_diabetes && 'Type 2 diabetes',
                  (profile as any).lactating && 'Breastfeeding',
                  (profile as any).ibd_active_flare && 'IBD flare',
                  (profile as any).eating_disorder_recovery && 'ED recovery',
                ].filter(Boolean).join(', ') || 'No conditions set'}
                onPress={() => router.push('/(tabs)/profile/health-context')}
              />
            </>
          )}
        </View>

        {/* Energy Budget */}
        <View style={[styles.card, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
          <SettingsRow
            icon="flash"
            iconTone="warn"
            label="Guardrail Weights"
            desc="Customize how your MES is calculated"
            trailing="expand"
            expanded={showBudgetEditor}
            onPress={() => setShowBudgetEditor(!showBudgetEditor)}
          />

          {showBudgetEditor && (
            <>
              {divider}
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
                          accessibilityRole="button"
                          accessibilityLabel={`Decrease ${item.label} weight`}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Ionicons name="remove" size={16} color={theme.text} />
                        </TouchableOpacity>
                        <Text style={[styles.sliderValue, { color: item.color, minWidth: 36, textAlign: 'center' }]}>{Math.round(item.value * 100)}%</Text>
                        <TouchableOpacity
                          onPress={() => item.set(Math.min(0.8, Math.round((item.value + 0.05) * 100) / 100))}
                          style={[styles.stepperBtn, { backgroundColor: theme.surfaceHighlight }]}
                          accessibilityRole="button"
                          accessibilityLabel={`Increase ${item.label} weight`}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Ionicons name="add" size={16} color={theme.text} />
                        </TouchableOpacity>
                      </View>
                    </View>
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
            </>
          )}
        </View>

        {/* ══════════════════════════════════════════════════════
            5. SUBSCRIPTION & SUPPORT
           ══════════════════════════════════════════════════════ */}
        <Text style={[styles.sectionTitle, { color: theme.text, marginTop: Spacing.xxl }]}>
          Subscription & Support
        </Text>

        <View style={[styles.card, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
          <SettingsRow
            icon="card"
            iconTone="premium"
            label="Manage Subscription"
            desc={
              billingService.isConfiguredForBuild()
                ? 'Manage, restore, or cancel anytime'
                : user?.entitlement?.subscription_state === 'trialing'
                  ? 'Trial active'
                  : 'Open App Store subscription settings'
            }
            trailing="external"
            onPress={manageSubscription}
          />
          {divider}
          <SettingsRow
            icon="mail"
            iconTone="neutral"
            label="Support"
            desc={SUPPORT_EMAIL}
            trailing="external"
            onPress={contactSupport}
          />
          {SUPPORT_URL ? (
            <>
              {divider}
              <SettingsRow
                icon="help-circle"
                iconTone="neutral"
                label="Support Center"
                desc="Open the public support and status page"
                trailing="external"
                onPress={() => openExternalLink(SUPPORT_URL)}
              />
            </>
          ) : null}
          {divider}
          <SettingsRow
            icon="document-text"
            iconTone="neutral"
            label="Privacy Policy"
            trailing="external"
            onPress={() => openExternalLink(PRIVACY_POLICY_URL, 'Privacy policy URL has not been configured for this build.')}
          />
          {divider}
          <SettingsRow
            icon="shield-checkmark"
            iconTone="neutral"
            label="Terms of Service"
            trailing="external"
            onPress={() => openExternalLink(TERMS_URL, 'Terms of service URL has not been configured for this build.')}
          />
        </View>

        {/* ══════════════════════════════════════════════════════
            6. ACCOUNT (Danger Zone)
           ══════════════════════════════════════════════════════ */}
        <Text style={[styles.sectionTitle, { color: theme.text, marginTop: Spacing.xxl }]}>
          Account
        </Text>

        {/* Sign Out is reversible — neutral/ghost, never red. */}
        <TouchableOpacity
          activeOpacity={0.7}
          accessibilityRole="button"
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
          style={[styles.signOutBtn, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}
        >
          <Ionicons name="log-out-outline" size={18} color={theme.textSecondary} />
          <Text style={[styles.signOutText, { color: theme.textSecondary }]}>Sign Out</Text>
        </TouchableOpacity>

        <View style={{ marginTop: Spacing.sm }}>
          <DangerButton
            label="Delete Account"
            icon="trash-outline"
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
                                const detail = err?.message || 'Unknown error';
                                Alert.alert(
                                  "We couldn't delete your account",
                                  `${detail}\n\nYour account was not deleted. Email ${SUPPORT_EMAIL} and we'll handle it.`,
                                  [
                                    {
                                      text: 'Email support',
                                      onPress: () =>
                                        Linking.openURL(
                                          `mailto:${SUPPORT_EMAIL}?subject=Account%20deletion%20request`,
                                        ).catch(() => {}),
                                    },
                                    { text: 'OK', style: 'cancel' },
                                  ],
                                );
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
          />
        </View>

        {/* Footer */}
        <Text style={[styles.versionFooter, { color: theme.textTertiary }]}>
          Version {APP_VERSION}
        </Text>
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
  card: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  signOutText: {
    fontSize: FontSize.md,
    fontWeight: '700',
  },
  versionFooter: {
    fontSize: FontSize.sm,
    textAlign: 'center',
    marginTop: Spacing.xxl,
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
