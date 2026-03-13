import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { AppScreenHeader } from '../../components/AppScreenHeader';
import { ScreenContainer } from '../../components/ScreenContainer';
import { Card } from '../../components/GradientCard';
import { useTheme } from '../../hooks/useTheme';
import { useEntranceAnimation } from '../../hooks/useAnimations';
import { foodApi } from '../../services/api';
import { BorderRadius, FontSize, Spacing } from '../../constants/Colors';
import { Shadows } from '../../constants/Shadows';

type FoodItem = {
  id: string;
  name: string;
  brand?: string | null;
  category?: string | null;
  source_kind?: string | null;
  default_serving_label?: string | null;
  nutrition_preview?: {
    calories?: number;
    protein_g?: number;
    carbs_g?: number;
    fat_g?: number;
    fiber_g?: number;
  };
};

export default function FoodSearchScreen() {
  const theme = useTheme();
  const params = useLocalSearchParams<{ q?: string }>();
  const [query, setQuery] = useState(params.q || '');
  const [results, setResults] = useState<FoodItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadingRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  const canSearch = useMemo(() => query.trim().length >= 2, [query]);
  const listEntrance = useEntranceAnimation(100);

  const runSearch = useCallback(async (pageNum = 1, append = false) => {
    if (query.trim().length < 2 || loadingRef.current) return;
    // Cancel any in-flight request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    loadingRef.current = true;
    setLoading(true);
    setError('');
    try {
      const data = await foodApi.search(query.trim(), pageNum);
      if (controller.signal.aborted) return;
      const foods = Array.isArray(data?.foods) ? data.foods : Array.isArray(data) ? data : [];
      setResults((prev) => (append ? [...prev, ...foods] : foods));
      setPage(pageNum);
      setHasMore(foods.length >= 20);
    } catch (e: any) {
      if (controller.signal.aborted) return;
      setError(e?.message || 'Failed to search foods.');
      if (!append) setResults([]);
    } finally {
      if (!controller.signal.aborted) {
        loadingRef.current = false;
        setLoading(false);
      }
    }
  }, [query]);

  // Debounced auto-search on query change
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 2) return;
    debounceRef.current = setTimeout(() => {
      runSearch(1, false);
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, runSearch]);

  const loadMore = () => {
    if (!loading && hasMore) {
      runSearch(page + 1, true);
    }
  };

  return (
    <ScreenContainer safeArea={false} padded={false}>
      <AppScreenHeader
        centerContent={
          <View style={[styles.headerCapsule, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={[styles.headerDot, { backgroundColor: theme.primary }]} />
            <Text style={[styles.headerCapsuleText, { color: theme.text }]}>Food Database</Text>
          </View>
        }
      />
      <View style={styles.contentPadding}>
        <View style={styles.header}>
        <Text style={[styles.title, { color: theme.text }]}>Food Database</Text>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>Search whole and packaged foods instantly</Text>
        </View>

        <View style={[styles.searchRow, { borderColor: theme.border, backgroundColor: theme.surfaceElevated, ...Shadows.sm(theme.background === '#0A0A0F') }]}>
        <Ionicons name="search" size={18} color={theme.textTertiary} />
        <TextInput
          style={[styles.input, { color: theme.text }]}
          value={query}
          onChangeText={setQuery}
          placeholder="Search: chicken breast, avocado, greek yogurt..."
          placeholderTextColor={theme.textTertiary}
          returnKeyType="search"
          onSubmitEditing={() => runSearch(1, false)}
        />
        <TouchableOpacity
          onPress={() => runSearch(1, false)}
          disabled={!canSearch || loading}
          style={[styles.searchBtn, { backgroundColor: canSearch ? theme.primary : theme.surfaceHighlight }]}
        >
          <Ionicons name="arrow-forward" size={16} color={canSearch ? '#fff' : theme.textTertiary} />
        </TouchableOpacity>
        </View>

        {error ? <Text style={[styles.error, { color: theme.error }]}>{error}</Text> : null}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="small" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>Searching foods...</Text>
        </View>
      ) : (
        <Animated.View style={[{ flex: 1 }, listEntrance.style]}>
        <FlatList
          data={results}
          keyExtractor={(item, idx) => String(item.id || idx)}
          contentContainerStyle={{ paddingTop: Spacing.md, paddingBottom: Spacing.huge, paddingHorizontal: Spacing.xl }}
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          initialNumToRender={12}
          maxToRenderPerBatch={8}
          windowSize={5}
          removeClippedSubviews
          ListEmptyComponent={
            <Card padding={Spacing.lg}>
              <View style={{ alignItems: 'center', marginBottom: Spacing.md }}>
                <Ionicons name="search-outline" size={48} color={theme.textTertiary} />
              </View>
              <Text style={[styles.emptyTitle, { color: theme.text, textAlign: 'center' }]}>No results yet</Text>
              <Text style={[styles.emptySub, { color: theme.textSecondary, textAlign: 'center' }]}>Search any ingredient or food to view details and nutrition.</Text>
            </Card>
          }
          renderItem={({ item }) => {
            const id = String(item.id || '');
            return (
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => id && router.push(`/food/${id}`)}
                style={{ borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border, paddingVertical: Spacing.md, paddingHorizontal: Spacing.sm }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md }}>
                  <View style={{ width: 40, height: 40, borderRadius: BorderRadius.md, backgroundColor: theme.primaryMuted, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="leaf-outline" size={18} color={theme.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.itemTitle, { color: theme.text }]} numberOfLines={2}>
                      {item.name || 'Unnamed food'}
                    </Text>
                    <View style={styles.metaRow}>
                      {!!item.brand && (
                        <Text style={[styles.meta, { color: theme.textTertiary }]} numberOfLines={1}>
                          {item.brand}
                        </Text>
                      )}
                      {!!item.category && (
                        <Text style={[styles.meta, { color: theme.textTertiary }]}>{item.category}</Text>
                      )}
                      {!!item.default_serving_label && (
                        <Text style={[styles.meta, { color: theme.textTertiary }]}>{item.default_serving_label}</Text>
                      )}
                    </View>
                  </View>
                  {typeof item.nutrition_preview?.calories === 'number' && (
                    <View style={{ backgroundColor: theme.primaryMuted, paddingHorizontal: 8, paddingVertical: 3, borderRadius: BorderRadius.full }}>
                      <Text style={{ color: theme.primary, fontSize: FontSize.xs, fontWeight: '700' }}>
                        {Math.round(Number(item.nutrition_preview?.calories || 0))} cal
                      </Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          }}
        />
        </Animated.View>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  contentPadding: {
    paddingHorizontal: Spacing.xl,
  },
  header: {
    marginTop: Spacing.xs,
    marginBottom: Spacing.md,
  },
  headerCapsule: {
    minWidth: 170,
    minHeight: 42,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  headerDot: {
    width: 8,
    height: 8,
    borderRadius: BorderRadius.full,
  },
  headerCapsuleText: {
    fontSize: FontSize.md,
    fontWeight: '700',
  },
  title: {
    fontSize: FontSize.xxl,
    fontWeight: '800',
  },
  subtitle: {
    marginTop: 2,
    fontSize: FontSize.sm,
  },
  searchRow: {
    borderWidth: 1,
    borderRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.md,
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  input: {
    flex: 1,
    fontSize: FontSize.md,
  },
  searchBtn: {
    width: 34,
    height: 34,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  error: {
    marginTop: Spacing.sm,
    fontSize: FontSize.sm,
  },
  center: {
    alignItems: 'center',
    marginTop: Spacing.xl,
    gap: Spacing.sm,
  },
  loadingText: {
    fontSize: FontSize.sm,
  },
  emptyTitle: {
    fontSize: FontSize.md,
    fontWeight: '700',
    marginBottom: Spacing.xs,
  },
  emptySub: {
    fontSize: FontSize.sm,
    lineHeight: 20,
  },
  itemTitle: {
    fontSize: FontSize.md,
    fontWeight: '700',
  },
  metaRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  meta: {
    fontSize: FontSize.xs,
    maxWidth: 180,
  },
});
