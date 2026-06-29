import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';

import { Screen } from '@/components/Screen';
import { Hexagon, HexTile } from '@/components/Hexagon';
import { PrimaryButton } from '@/components/PrimaryButton';
import { colors, fonts, radii, shadows, spacing, type } from '@/theme/tokens';
import { AsyncVisitedRepository } from '@/adapters/storage/VisitedRepository.async';
import { loadStats } from '@/services/exploreStats';
import { TOTAL_LAND_CELLS } from '@/data/singaporeLandCells';
import { LANDMARKS } from '@/features/poi/landmarks';
import { countCollected } from '@/features/poi/collectedLandmarks';

type Row = {
  label: string;
  value: string;
  tint: number;
  shape: 'hex' | 'circle' | 'diamond';
};

export default function StatsScreen() {
  const router = useRouter();
  const repo = useMemo(() => new AsyncVisitedRepository(), []);
  const [data, setData] = useState({ areas: 0, distanceM: 0, dayStreak: 0, collected: 0 });

  // Reload real, on-device data every time the screen comes into focus, so it
  // reflects whatever was explored on the map before navigating here.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        const [cells, stats] = await Promise.all([repo.load(), loadStats()]);
        if (active) {
          setData({
            areas: cells.length,
            distanceM: stats.distanceM,
            dayStreak: stats.dayStreak,
            collected: countCollected(LANDMARKS, cells),
          });
        }
      })();
      return () => {
        active = false;
      };
    }, [repo]),
  );

  const pct = Math.min(100, (data.areas / TOTAL_LAND_CELLS) * 100);
  // Two decimals to match the map's "explored" badge exactly.
  const pctLabel = pct.toFixed(2);
  const distKm = (data.distanceM / 1000).toFixed(1);

  const rows: Row[] = [
    { label: 'Areas colored', value: String(data.areas), tint: 0, shape: 'hex' },
    { label: 'Distance walked', value: `${distKm} km`, tint: 1, shape: 'circle' },
    { label: 'Collections', value: `${data.collected} / ${LANDMARKS.length}`, tint: 2, shape: 'diamond' },
    { label: 'Day streak', value: `${data.dayStreak} days`, tint: 3, shape: 'circle' },
  ];

  return (
    <Screen colors={colors.statsGradient}>
      <View style={styles.root}>
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Back to map"
            style={styles.back}
          >
            <Text style={styles.backGlyph}>‹</Text>
          </Pressable>
          <Text style={type.statsTitle}>Your Exploration</Text>
        </View>

        <View style={styles.hero}>
          <Hexagon
            size={196}
            ratio={214 / 196}
            pct={pct}
            inset={18}
            track={colors.hexTrackStrong}
          />
          <View style={styles.heroCenter} pointerEvents="none">
            <Text style={type.bigPct}>{pctLabel}%</Text>
            <Text style={styles.heroLabel}>EXPLORED</Text>
          </View>
        </View>

        <View style={styles.card}>
          {rows.map((row, i) => (
            <View key={row.label} style={[styles.row, i < rows.length - 1 && styles.rowDivider]}>
              <View style={styles.rowIcon}>
                <HexTile size={40} ratio={44 / 40} color={colors.statTints[row.tint].bg} />
                <View style={styles.rowGlyphWrap} pointerEvents="none">
                  <RowGlyph shape={row.shape} color={colors.statTints[row.tint].fg} />
                </View>
              </View>
              <Text style={styles.rowLabel}>{row.label}</Text>
              <Text style={styles.rowValue}>{row.value}</Text>
            </View>
          ))}
        </View>

        <View style={styles.cta}>
          <PrimaryButton label="Back to Map" onPress={() => router.back()} />
        </View>
      </View>
    </Screen>
  );
}

function RowGlyph({ shape, color }: { shape: Row['shape']; color: string }) {
  if (shape === 'circle') return <View style={{ width: 13, height: 13, borderRadius: 999, backgroundColor: color }} />;
  if (shape === 'diamond')
    return <View style={{ width: 13, height: 13, borderRadius: 3, backgroundColor: color, transform: [{ rotate: '45deg' }] }} />;
  return <HexTile size={13} color={color} />;
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: spacing.lg + 4 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: spacing.sm },
  back: {
    width: 42,
    height: 42,
    borderRadius: radii.sm,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.card,
  },
  backGlyph: { fontSize: 24, lineHeight: 26, color: colors.blueDeep, fontFamily: fonts.bodyExtra },
  hero: { width: 196, height: 214, alignSelf: 'center', marginTop: 40 },
  heroCenter: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  heroLabel: { color: colors.label, fontSize: 13, fontFamily: fonts.bodyExtra, letterSpacing: 0.3, marginTop: 2 },
  card: {
    backgroundColor: colors.white,
    borderRadius: radii.xl,
    paddingHorizontal: spacing.lg,
    paddingVertical: 6,
    marginTop: 32,
    ...shadows.card,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 12 },
  rowDivider: { borderBottomWidth: 1.5, borderBottomColor: colors.cardDivider },
  rowIcon: { width: 40, height: 44, alignItems: 'center', justifyContent: 'center' },
  rowGlyphWrap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { flex: 1, fontFamily: fonts.bodyExtra, color: colors.ink, fontSize: 15 },
  rowValue: { fontFamily: fonts.display, color: colors.ink, fontSize: 17 },
  cta: { marginTop: 'auto', marginBottom: 28 },
});
