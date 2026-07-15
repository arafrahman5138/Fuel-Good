/**
 * HealthContext — dedicated settings screen for self-reported health
 * conditions that personalize metabolic scoring targets.
 *
 * Previously the "Health Context" settings row deep-linked into the 3-step
 * Body & Goals wizard on the Track tab (disorienting; and the wizard never
 * collected hypertension / lactation / IBD / ED-recovery even though the
 * backend supports bespoke targets for them). This screen collects all of
 * them and PATCHes /api/metabolic/profile.
 */
import React, { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ScreenContainer } from '../../../components/ScreenContainer';
import { AppScreenHeader } from '../../../components/AppScreenHeader';
import { Button } from '../../../components/Button';
import { useTheme } from '../../../hooks/useTheme';
import { useMetabolicBudgetStore } from '../../../stores/metabolicBudgetStore';
import { metabolicApi } from '../../../services/api';
import { BorderRadius, FontSize, Spacing } from '../../../constants/Colors';

/** Profile fields this screen manages. The store's MetabolicProfile type
 *  predates the Batch-2 safety flags, so we read them via this extension. */
interface HealthContextFields {
  hypertension?: boolean | null;
  systolic_mmhg?: number | null;
  diastolic_mmhg?: number | null;
  insulin_resistant?: boolean | null;
  prediabetes?: boolean | null;
  type_2_diabetes?: boolean | null;
  lactating?: boolean | null;
  months_postpartum?: number | null;
  ibd_active_flare?: boolean | null;
  eating_disorder_recovery?: boolean | null;
}

function ToggleRow({
  label,
  value,
  onToggle,
  theme,
}: {
  label: string;
  value: boolean;
  onToggle: (v: boolean) => void;
  theme: any;
}) {
  return (
    <TouchableOpacity
      onPress={() => onToggle(!value)}
      activeOpacity={0.7}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={label}
      style={[
        styles.toggleRow,
        { borderColor: theme.border, backgroundColor: value ? theme.primary + '12' : theme.surfaceElevated },
      ]}
    >
      <Text style={[styles.toggleLabel, { color: theme.text }]}>{label}</Text>
      <View style={[styles.toggleSwitch, { backgroundColor: value ? theme.primary : theme.surfaceHighlight }]}>
        <View style={[styles.toggleKnob, { transform: [{ translateX: value ? 16 : 0 }] }]} />
      </View>
    </TouchableOpacity>
  );
}

function NumberField({
  label,
  unit,
  value,
  onChange,
  placeholder,
  theme,
}: {
  label: string;
  unit: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  theme: any;
}) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>{label}</Text>
      <View style={[styles.inputRow, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
        <TextInput
          style={[styles.input, { color: theme.text }]}
          placeholder={placeholder}
          placeholderTextColor={theme.textTertiary}
          keyboardType="numeric"
          value={value}
          onChangeText={onChange}
        />
        <Text style={[styles.unit, { color: theme.textTertiary }]}>{unit}</Text>
      </View>
    </View>
  );
}

export default function HealthContextScreen() {
  const theme = useTheme();
  const profile = useMetabolicBudgetStore((s) => s.profile);
  const fetchProfile = useMetabolicBudgetStore((s) => s.fetchProfile);
  const fetchBudget = useMetabolicBudgetStore((s) => s.fetchBudget);

  const [hypertension, setHypertension] = useState(false);
  const [systolic, setSystolic] = useState('');
  const [diastolic, setDiastolic] = useState('');
  const [insulinResistant, setInsulinResistant] = useState(false);
  const [prediabetes, setPrediabetes] = useState(false);
  const [type2Diabetes, setType2Diabetes] = useState(false);
  const [lactating, setLactating] = useState(false);
  const [monthsPostpartum, setMonthsPostpartum] = useState('');
  const [ibdActiveFlare, setIbdActiveFlare] = useState(false);
  const [edRecovery, setEdRecovery] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedNote, setSavedNote] = useState<string | null>(null);
  /** hypertension state at last hydrate/save — used for the "why your targets changed" note */
  const [baselineHypertension, setBaselineHypertension] = useState(false);

  // Prefill from the saved profile (fetch on mount; hydrate whenever it lands)
  useEffect(() => {
    fetchProfile();
  }, []);

  useEffect(() => {
    if (!profile) return;
    const p = profile as HealthContextFields;
    setHypertension(!!p.hypertension);
    setBaselineHypertension(!!p.hypertension);
    setSystolic(p.systolic_mmhg != null ? String(p.systolic_mmhg) : '');
    setDiastolic(p.diastolic_mmhg != null ? String(p.diastolic_mmhg) : '');
    setInsulinResistant(!!p.insulin_resistant);
    setPrediabetes(!!p.prediabetes);
    setType2Diabetes(!!p.type_2_diabetes);
    setLactating(!!p.lactating);
    setMonthsPostpartum(p.months_postpartum != null ? String(p.months_postpartum) : '');
    setIbdActiveFlare(!!p.ibd_active_flare);
    setEdRecovery(!!p.eating_disorder_recovery);
  }, [profile]);

  const handleT2DToggle = (on: boolean) => {
    setType2Diabetes(on);
    if (on) setInsulinResistant(true);
  };

  const parseIntOrNull = (v: string): number | null => {
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : null;
  };

  const save = async () => {
    setSaving(true);
    setSavedNote(null);
    try {
      const payload: Record<string, any> = {
        hypertension,
        systolic_mmhg: hypertension ? parseIntOrNull(systolic) : null,
        diastolic_mmhg: hypertension ? parseIntOrNull(diastolic) : null,
        insulin_resistant: insulinResistant,
        prediabetes,
        type_2_diabetes: type2Diabetes,
        lactating,
        months_postpartum: lactating ? parseIntOrNull(monthsPostpartum) : null,
        ibd_active_flare: ibdActiveFlare,
        eating_disorder_recovery: edRecovery,
      };
      await metabolicApi.patchProfile(payload);
      // Refresh targets + profile so the rest of the app picks up new budgets.
      await Promise.all([fetchProfile(), fetchBudget()]);

      // One-line "why your targets changed" note
      if (hypertension && !baselineHypertension) {
        setSavedNote('Sodium target set to 1,500 mg for blood-pressure support.');
      } else if (!hypertension && baselineHypertension) {
        setSavedNote('Blood-pressure support removed — sodium target back to standard.');
      } else {
        setSavedNote('Saved — your scoring targets now reflect these conditions.');
      }
      setBaselineHypertension(hypertension);
    } catch (err: any) {
      Alert.alert('Update failed', err?.message || 'Could not save your health context.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScreenContainer safeArea={false} padded={false}>
      <AppScreenHeader title="Health Context" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            These conditions adjust your scoring thresholds and nutrient targets.
          </Text>

          {/* ── Blood pressure ── */}
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Blood Pressure</Text>
          <ToggleRow
            label="I have high blood pressure (hypertension)"
            value={hypertension}
            onToggle={setHypertension}
            theme={theme}
          />
          {hypertension && (
            <View style={styles.bpRow}>
              <NumberField
                label="Systolic (optional)"
                unit="mmHg"
                value={systolic}
                onChange={setSystolic}
                placeholder="130"
                theme={theme}
              />
              <NumberField
                label="Diastolic (optional)"
                unit="mmHg"
                value={diastolic}
                onChange={setDiastolic}
                placeholder="85"
                theme={theme}
              />
            </View>
          )}

          {/* ── Metabolic health ── */}
          <Text style={[styles.sectionTitle, { color: theme.text, marginTop: Spacing.lg }]}>
            Metabolic Health
          </Text>
          <ToggleRow
            label="I have insulin resistance"
            value={insulinResistant}
            onToggle={setInsulinResistant}
            theme={theme}
          />
          <ToggleRow
            label="I have prediabetes"
            value={prediabetes}
            onToggle={setPrediabetes}
            theme={theme}
          />
          <ToggleRow
            label="I have Type 2 diabetes"
            value={type2Diabetes}
            onToggle={handleT2DToggle}
            theme={theme}
          />

          {/* ── Life stage ── */}
          <Text style={[styles.sectionTitle, { color: theme.text, marginTop: Spacing.lg }]}>
            Life Stage
          </Text>
          <ToggleRow
            label="Currently breastfeeding"
            value={lactating}
            onToggle={setLactating}
            theme={theme}
          />
          {lactating && (
            <View style={styles.bpRow}>
              <NumberField
                label="Months postpartum (optional)"
                unit="months"
                value={monthsPostpartum}
                onChange={setMonthsPostpartum}
                placeholder="6"
                theme={theme}
              />
            </View>
          )}

          {/* ── Digestive & recovery ── */}
          <Text style={[styles.sectionTitle, { color: theme.text, marginTop: Spacing.lg }]}>
            Digestive & Recovery
          </Text>
          <ToggleRow
            label="IBD active flare"
            value={ibdActiveFlare}
            onToggle={setIbdActiveFlare}
            theme={theme}
          />
          <ToggleRow
            label="Eating disorder recovery"
            value={edRecovery}
            onToggle={setEdRecovery}
            theme={theme}
          />

          <Text style={[styles.disclaimer, { color: theme.textTertiary }]}>
            Self-reported — used only to personalize scoring. Not medical advice.
          </Text>

          {savedNote && (
            <View style={[styles.noteRow, { backgroundColor: theme.primary + '12' }]}>
              <Ionicons name="checkmark-circle" size={16} color={theme.primary} />
              <Text style={[styles.noteText, { color: theme.primary }]}>{savedNote}</Text>
            </View>
          )}

          <View style={styles.actions}>
            <Button title="Done" variant="ghost" onPress={() => router.back()} disabled={saving} />
            <Button title="Save" onPress={save} loading={saving} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xxxl,
    paddingHorizontal: Spacing.xl,
  },
  subtitle: {
    fontSize: FontSize.sm,
    lineHeight: 20,
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: Spacing.sm,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: 8,
  },
  toggleLabel: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    flex: 1,
    marginRight: Spacing.sm,
  },
  toggleSwitch: {
    width: 40,
    height: 24,
    borderRadius: 12,
    padding: 2,
  },
  toggleKnob: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#fff',
  },
  bpRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.sm,
  },
  fieldLabel: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    marginBottom: 4,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    height: 44,
  },
  input: {
    flex: 1,
    fontSize: FontSize.md,
    fontWeight: '600',
  },
  unit: {
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
  disclaimer: {
    fontSize: FontSize.xs,
    fontWeight: '500',
    fontStyle: 'italic',
    marginTop: Spacing.lg,
    lineHeight: 18,
  },
  noteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginTop: Spacing.md,
  },
  noteText: {
    flex: 1,
    fontSize: FontSize.sm,
    fontWeight: '600',
    lineHeight: 18,
  },
  actions: {
    marginTop: Spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
