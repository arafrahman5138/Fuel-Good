import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';

import { LinearGradient } from 'expo-linear-gradient';
import { AppScreenHeader } from '../../components/AppScreenHeader';
import { Card } from '../../components/GradientCard';
import { ChronometerSuccessModal } from '../../components/ChronometerSuccessModal';
import LogoHeader from '../../components/LogoHeader';
import { useTheme } from '../../hooks/useTheme';
import { BorderRadius, FontSize, Layout, Spacing } from '../../constants/Colors';
import { foodApi, nutritionApi } from '../../services/api';
import { useScaleReveal } from '../../hooks/useAnimations';


interface ServingOption {
  id: string;
  label: string;
  grams: number;
  nutrition: Record<string, number>;
}

interface FoodDetail {
  id: string;
  name: string;
  brand?: string | null;
  category?: string | null;
  source_kind?: string | null;
  default_serving_label?: string | null;
  default_serving_grams?: number | null;
  nutrition_per_serving: Record<string, number>;
  nutrition_per_100g: Record<string, number>;
  mes_ready_nutrition: Record<string, number>;
  micronutrients: Record<string, number>;
  serving_options: ServingOption[];
}

const MACRO_ROWS = [
  { key: 'calories', label: 'Calories', color: '#22C55E' },
  { key: 'protein_g', label: 'Protein', color: '#22C55E' },
  { key: 'carbs_g', label: 'Carbs', color: '#F59E0B' },
  { key: 'fat_g', label: 'Fat', color: '#EC4899' },
  { key: 'fiber_g', label: 'Fiber', color: '#8B5CF6' },
];

function formatValue(value: number, key: string) {
  const rounded = Number.isInteger(value) ? value : Number(value.toFixed(1));
  return key === 'calories' ? `${rounded}` : `${rounded}g`;
}

export default function FoodDetailScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [food, setFood] = useState<FoodDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [logging, setLogging] = useState(false);
  const [logSuccess, setLogSuccess] = useState(false);
  const { animatedStyle: checkmarkStyle } = useScaleReveal(logSuccess, 0.3, { speed: 18, bounciness: 12 });
  const [quantity, setQuantity] = useState('1');
  const [selectedServingId, setSelectedServingId] = useState<string>('default');
  const [successModal, setSuccessModal] = useState<{ visible: boolean; message: string }>({
    visible: false,
    message: '',
  });

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await foodApi.getDetail(id);
        setFood(data);
        setSelectedServingId(data?.serving_options?.[0]?.id || 'default');
      } catch (e: any) {
        setError(e?.message || 'Unable to load food details.');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const selectedServing = useMemo(() => {
    if (!food) return null;
    return food.serving_options?.find((item) => item.id === selectedServingId) || food.serving_options?.[0] || null;
  }, [food, selectedServingId]);

  const quantityValue = Math.max(0.1, Number(quantity || 1));

  const displayedNutrition = useMemo(() => {
    const base = selectedServing?.nutrition || food?.nutrition_per_serving || {};
    const scaled: Record<string, number> = {};
    Object.entries(base).forEach(([key, value]) => {
      scaled[key] = Number(value || 0) * quantityValue;
    });
    return scaled;
  }, [food?.nutrition_per_serving, quantityValue, selectedServing?.nutrition]);

  const micronutrients = useMemo(() => {
    return Object.entries(food?.micronutrients || {})
      .map(([name, value]) => ({ name, value: Number(value || 0) * quantityValue }))
      .filter((item) => item.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [food?.micronutrients, quantityValue]);

  const handleAdjustQuantity = (delta: number) => {
    const next = Math.max(0.1, Number((quantityValue + delta).toFixed(1)));
    setQuantity(`${next}`);
  };

  const handleLog = async () => {
    if (!food) return;
    setLogging(true);
    try {
      await nutritionApi.createLog({
        source_type: 'food_db',
        source_id: food.id,
        serving_option_id: selectedServing?.id,
        meal_type: 'meal',
        servings: quantityValue,
        quantity: 1,
      });
      setLogSuccess(true);
      setSuccessModal({
        visible: true,
        message: `"${food.name}" has been added to today's nutrition log.`,
      });
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to log food. Please try again.');
    } finally {
      setLogging(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>Loading food details...</Text>
        </View>
      </View>
    );
  }

  if (error || !food) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.center}>
          <Ionicons name="cloud-offline-outline" size={48} color={theme.textTertiary} />
          <Text style={[styles.errorTitle, { color: theme.text }]}>Something went wrong</Text>
          <Text style={[styles.errorText, { color: theme.textSecondary }]}>{error || 'Food not found.'}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <AppScreenHeader centerContent={<LogoHeader />} />
      <ChronometerSuccessModal
        visible={successModal.visible}
        message={successModal.message}
        onPrimary={() => {
          setSuccessModal({ visible: false, message: '' });
          router.navigate('/(tabs)/chronometer' as any);
        }}
        onSecondary={() => setSuccessModal({ visible: false, message: '' })}
      />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={[styles.title, { color: theme.text }]}>{food.name}</Text>
        <View style={styles.badges}>
          {!!food.category && (
            <View style={[styles.categoryChip, { backgroundColor: theme.primaryMuted }]}>
              <Text style={[styles.categoryChipText, { color: theme.primary }]}>{food.category}</Text>
            </View>
          )}
          {!!food.brand && (
            <View style={[styles.categoryChip, { backgroundColor: theme.accentMuted }]}>
              <Text style={[styles.categoryChipText, { color: theme.accent }]}>{food.brand}</Text>
            </View>
          )}
          {!!food.source_kind && (
            <View style={[styles.categoryChip, { backgroundColor: theme.infoMuted }]}>
              <Text style={[styles.categoryChipText, { color: theme.info }]}>{food.source_kind.replace(/_/g, ' ')}</Text>
            </View>
          )}
        </View>

        <Card style={styles.card}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Serving</Text>
          <View style={styles.servingWrap}>
            {(food.serving_options || []).map((option) => {
              const active = option.id === selectedServingId;
              return (
                <TouchableOpacity
                  key={option.id}
                  onPress={() => setSelectedServingId(option.id)}
                  activeOpacity={0.85}
                  style={[
                    styles.servingChip,
                    {
                      backgroundColor: active ? theme.primaryMuted : theme.surfaceElevated,
                      borderColor: active ? theme.primary : theme.border,
                    },
                  ]}
                >
                  <Text style={[styles.servingChipText, { color: active ? theme.primary : theme.textSecondary }]}>
                    {option.label}
                  </Text>
                  <Text style={[styles.servingChipSub, { color: theme.textTertiary }]}>{Math.round(option.grams)}g</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.quantityRow}>
            <Text style={[styles.quantityLabel, { color: theme.text }]}>Quantity</Text>
            <View style={styles.quantityControl}>
              <TouchableOpacity onPress={() => handleAdjustQuantity(-0.5)} style={[styles.quantityBtn, { backgroundColor: theme.surfaceElevated }]}>
                <Ionicons name="remove" size={18} color={theme.text} />
              </TouchableOpacity>
              <TextInput
                value={quantity}
                onChangeText={setQuantity}
                keyboardType="decimal-pad"
                style={[styles.quantityInput, { color: theme.text, borderColor: theme.border }]}
              />
              <TouchableOpacity onPress={() => handleAdjustQuantity(0.5)} style={[styles.quantityBtn, { backgroundColor: theme.surfaceElevated }]}>
                <Ionicons name="add" size={18} color={theme.text} />
              </TouchableOpacity>
            </View>
          </View>
        </Card>

        <Card style={styles.card}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Nutrition for this log</Text>
          <View style={styles.macroGrid}>
            {MACRO_ROWS.map((row) => (
              <View key={row.key} style={styles.macroItem}>
                <View style={[styles.macroDot, { backgroundColor: row.color + '20' }]}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: row.color }} />
                </View>
                <Text style={[styles.macroValue, { color: theme.text }]}>{formatValue(Number(displayedNutrition[row.key] || 0), row.key)}</Text>
                <Text style={[styles.macroLabel, { color: theme.textTertiary }]}>{row.label}</Text>
              </View>
            ))}
          </View>
        </Card>

        {micronutrients.length > 0 && (
          <Card style={styles.card}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Micronutrients</Text>
            {micronutrients.map((item, index) => (
              <View key={item.name} style={[styles.microRow, index % 2 === 1 && { backgroundColor: theme.surfaceHighlight }]}>
                <Text style={[styles.microName, { color: theme.text }]}>{item.name.replace(/_/g, ' ')}</Text>
                <Text style={[styles.microValue, { color: theme.textSecondary }]}>
                  {Number.isInteger(item.value) ? item.value : item.value.toFixed(1)}
                </Text>
              </View>
            ))}
          </Card>
        )}

        <Card style={styles.card}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>MES-ready nutrition</Text>
          <View style={styles.mesRow}>
            {['protein_g', 'fiber_g', 'carbs_g'].map((key) => (
              <View key={key} style={styles.mesItem}>
                <Text style={[styles.mesValue, { color: theme.primary }]}>
                  {formatValue(Number(food.mes_ready_nutrition[key] || 0), key)}
                </Text>
                <Text style={[styles.mesLabel, { color: theme.textSecondary }]}>{key.replace('_g', '').replace(/_/g, ' ')}</Text>
              </View>
            ))}
          </View>
        </Card>

        <View style={{ height: Layout.scrollBottomPadding }} />
      </ScrollView>

      <View style={[styles.logBar, { backgroundColor: theme.surface, borderTopColor: theme.border }]}>
        <TouchableOpacity
          onPress={handleLog}
          disabled={logging || logSuccess}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={logSuccess ? ['#22C55E', '#16A34A'] as const : ['#22C55E', '#059669'] as const}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.logBtn}
          >
            {logging ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : logSuccess ? (
              <>
                <Animated.View style={checkmarkStyle}>
                  <Ionicons name="checkmark-circle" size={18} color="#fff" />
                </Animated.View>
                <Text style={styles.logBtnText}>Logged!</Text>
              </>
            ) : (
              <>
                <Ionicons name="add-circle" size={18} color="#fff" />
                <Text style={styles.logBtnText}>Log to Chronometer</Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: Spacing.xl },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  loadingText: { marginTop: Spacing.md, fontSize: FontSize.md },
  errorTitle: { fontSize: FontSize.lg, fontWeight: '700', marginTop: Spacing.md },
  errorText: { fontSize: FontSize.md, marginTop: Spacing.xs, textAlign: 'center' },
  title: { fontSize: FontSize.xxxl, fontWeight: '800', letterSpacing: -0.5 },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
    marginBottom: Spacing.md,
  },
  categoryChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  categoryChipText: { fontSize: FontSize.sm, fontWeight: '700' },
  card: { marginBottom: Spacing.md },
  sectionTitle: { fontSize: FontSize.lg, fontWeight: '700', marginBottom: Spacing.md },
  servingWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  servingChip: {
    minWidth: '47%',
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  servingChipText: { fontSize: FontSize.sm, fontWeight: '700' },
  servingChipSub: { fontSize: FontSize.xs, marginTop: Spacing.xs },
  quantityRow: {
    marginTop: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  quantityLabel: { fontSize: FontSize.md, fontWeight: '700' },
  quantityControl: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  quantityBtn: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityInput: {
    minWidth: 72,
    height: 44,
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
    textAlign: 'center',
    fontSize: FontSize.md,
    fontWeight: '700',
    paddingHorizontal: Spacing.sm,
  },
  macroGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.lg },
  macroItem: { alignItems: 'center', minWidth: 70, gap: 2 },
  macroDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  macroValue: { fontSize: FontSize.xl, fontWeight: '800' },
  macroLabel: { fontSize: FontSize.xs, marginTop: Spacing.xs },
  microRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  microName: { fontSize: FontSize.md, flex: 1, textTransform: 'capitalize' },
  microValue: { fontSize: FontSize.md, fontWeight: '600', textAlign: 'right' },
  mesRow: { flexDirection: 'row', gap: Spacing.lg },
  mesItem: { flex: 1, alignItems: 'center', paddingVertical: Spacing.sm },
  mesValue: { fontSize: FontSize.lg, fontWeight: '800' },
  mesLabel: { fontSize: FontSize.xs, marginTop: Spacing.xs, textTransform: 'capitalize' },
  logBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: Spacing.md,
    paddingBottom: Spacing.xl + 8,
    borderTopWidth: 1,
  },
  logBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 50,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  logBtnText: { color: '#fff', fontSize: FontSize.md, fontWeight: '700' },
});
