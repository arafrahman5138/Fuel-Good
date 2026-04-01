import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';

import { ScreenContainer } from '../../../components/ScreenContainer';
import { BorderRadius, FontSize, Spacing } from '../../../constants/Colors';
import { useTheme } from '../../../hooks/useTheme';
import { notificationsApi } from '../../../services/api';

type NotificationCategoryKey =
  | 'plan'
  | 'cook'
  | 'grocery'
  | 'streak'
  | 'quest'
  | 'reactivation'
  | 'healthify';

interface NotificationPreferences {
  push_enabled: boolean;
  timezone: string;
  quiet_hours_start: string;
  quiet_hours_end: string;
  preferred_meal_window_start: string;
  preferred_meal_window_end: string;
  max_notifications_per_day: number;
  max_notifications_per_week: number;
  categories: Record<string, boolean>;
}

const CATEGORY_META: Array<{ key: NotificationCategoryKey; label: string; description: string }> = [
  { key: 'plan', label: 'Meal planning', description: 'About once a week when your current week is still unplanned.' },
  { key: 'cook', label: 'Cook reminders', description: 'Up to twice a week when tonight’s dinner is already chosen.' },
  { key: 'grocery', label: 'Grocery follow-through', description: 'Once per plan if you still have not turned it into a list.' },
  { key: 'streak', label: 'Streak protection', description: 'Up to twice a week, only when today can still be saved.' },
  { key: 'quest', label: 'Quest progress', description: 'At most weekly when you are one action away from finishing.' },
  { key: 'reactivation', label: 'Reactivation', description: 'Only after a few inactive days, not as daily win-back spam.' },
  { key: 'healthify', label: 'Healthify follow-up', description: 'About once every few days if a useful recipe thread was left unfinished.' },
];

const QUIET_HOUR_OPTIONS = ['20:30', '21:00', '21:30', '22:00', '22:30'];
const QUIET_END_OPTIONS = ['06:30', '07:00', '07:30', '08:00', '08:30'];
const MEAL_WINDOW_OPTIONS = ['16:30', '17:00', '17:30', '18:00', '18:30', '19:00', '19:30'];

export default function NotificationSettingsScreen() {
  const theme = useTheme();
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    notificationsApi.getPreferences().then(setPrefs).catch(() => {
      Alert.alert('Notifications', 'Unable to load notification settings right now.');
    });
  }, []);

  const patchPreferences = async (patch: Partial<NotificationPreferences>) => {
    if (!prefs) return;
    const next = { ...prefs, ...patch };
    setPrefs(next);
    setSaving(true);
    try {
      const result = await notificationsApi.updatePreferences(patch);
      setPrefs(result);
    } catch (err: any) {
      setPrefs(prefs);
      Alert.alert('Notifications', err?.message || 'Unable to save notification settings.');
    } finally {
      setSaving(false);
    }
  };

  const updateCategory = async (key: NotificationCategoryKey, value: boolean) => {
    if (!prefs) return;
    await patchPreferences({
      categories: {
        ...prefs.categories,
        [key]: value,
      },
    });
  };

  const cycleOption = async (
    key: 'quiet_hours_start' | 'quiet_hours_end' | 'preferred_meal_window_start' | 'preferred_meal_window_end',
    options: string[],
  ) => {
    if (!prefs) return;
    const current = prefs[key];
    const currentIndex = options.indexOf(current);
    const nextValue = options[(currentIndex + 1) % options.length];
    await patchPreferences({ [key]: nextValue } as Partial<NotificationPreferences>);
  };

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={[styles.hero, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
          <Text style={[styles.title, { color: theme.text }]}>Push notifications</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            Keep notifications specific, useful, and timed around meals.
          </Text>
        </View>

        {prefs ? (
          <>
            <View style={[styles.card, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.rowTitle, { color: theme.text }]}>Enable push notifications</Text>
                  <Text style={[styles.rowDescription, { color: theme.textSecondary }]}>Master switch for all push sends.</Text>
                </View>
                <Switch value={prefs.push_enabled} onValueChange={(value) => patchPreferences({ push_enabled: value })} />
              </View>
            </View>

            <View style={[styles.card, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Categories</Text>
              {CATEGORY_META.map((item) => (
                <View key={item.key} style={styles.row}>
                  <View style={{ flex: 1, paddingRight: Spacing.md }}>
                    <Text style={[styles.rowTitle, { color: theme.text }]}>{item.label}</Text>
                    <Text style={[styles.rowDescription, { color: theme.textSecondary }]}>{item.description}</Text>
                  </View>
                  <Switch
                    value={Boolean(prefs.categories?.[item.key])}
                    onValueChange={(value) => updateCategory(item.key, value)}
                  />
                </View>
              ))}
            </View>

            <View style={[styles.card, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Timing</Text>
              <TouchableOpacity style={styles.timeRow} onPress={() => cycleOption('quiet_hours_start', QUIET_HOUR_OPTIONS)}>
                <Text style={[styles.rowTitle, { color: theme.text }]} numberOfLines={1}>Quiet hours start</Text>
                <Text style={[styles.timeValue, { color: theme.primary }]}>{prefs.quiet_hours_start}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.timeRow} onPress={() => cycleOption('quiet_hours_end', QUIET_END_OPTIONS)}>
                <Text style={[styles.rowTitle, { color: theme.text }]} numberOfLines={1}>Quiet hours end</Text>
                <Text style={[styles.timeValue, { color: theme.primary }]}>{prefs.quiet_hours_end}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.timeRow} onPress={() => cycleOption('preferred_meal_window_start', MEAL_WINDOW_OPTIONS)}>
                <Text style={[styles.rowTitle, { color: theme.text }]} numberOfLines={1}>Meal reminder start</Text>
                <Text style={[styles.timeValue, { color: theme.primary }]}>{prefs.preferred_meal_window_start}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.timeRow} onPress={() => cycleOption('preferred_meal_window_end', MEAL_WINDOW_OPTIONS)}>
                <Text style={[styles.rowTitle, { color: theme.text }]} numberOfLines={1}>Meal reminder end</Text>
                <Text style={[styles.timeValue, { color: theme.primary }]}>{prefs.preferred_meal_window_end}</Text>
              </TouchableOpacity>
            </View>

            <Text style={[styles.footer, { color: theme.textTertiary }]}>
              {saving ? 'Saving changes...' : 'Launch defaults stay restrained: no more than one push in 12 hours and roughly three per week for active users.'}
            </Text>
          </>
        ) : null}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scroll: {
    padding: Spacing.lg,
    gap: Spacing.lg,
  },
  hero: {
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    gap: Spacing.xs,
  },
  title: {
    fontSize: FontSize.xl,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: FontSize.sm,
    lineHeight: 20,
  },
  card: {
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  sectionTitle: {
    fontSize: FontSize.md,
    fontWeight: '800',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  rowTitle: {
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  rowDescription: {
    fontSize: FontSize.xs,
    marginTop: 2,
    lineHeight: 16,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  timeValue: {
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  footer: {
    fontSize: FontSize.xs,
    textAlign: 'center',
  },
});
