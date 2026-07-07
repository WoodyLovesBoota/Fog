import { memo, useCallback, useMemo, useRef, useState } from 'react';
import { FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';

import { Screen } from '@/components/Screen';
import { LandmarkSheet } from '@/components/LandmarkSheet';
import { LockIcon } from '@/components/icons';
import { colors, fonts, press, shadows, spacing } from '@/theme/tokens';
import { loadCollected } from '@/adapters/storage/collectedRepo';
import { getCurrentPosition, getLastKnownPosition } from '@/services/location';
import { haversineMeters } from '@/core/exploration/distance';
import { CATEGORY_META, LANDMARKS, type Landmark } from '@/features/poi/landmarks';
import { annotateLandmarks, type LandmarkWithStatus } from '@/features/poi/collectedLandmarks';

/**
 * Collection screen (design handoff).
 *
 * Collected landmarks (discovered within range) show as full cards with a ✓; the
 * rest are locked "???" cards. Tapping a collected card opens the same detail
 * sheet the map uses, with the live distance resolved on open. Re-reads the
 * collected set on focus so a discovery made on the map shows up here.
 *
 * Rendered as ONE virtualized FlatList (section headers are just rows): with
 * ~100 landmarks, an eager ScrollView would mount every card during the push
 * transition and jank the slide-in; virtualization keeps the initial mount to a
 * screenful.
 */

/** Last collected ids seen by this screen, kept module-level so re-entering
    paints the real list on the very first frame instead of flashing empty
    while AsyncStorage loads. `null` until the first successful load. */
let lastCollectedIds: string[] | null = null;

/** One flat list feeds the whole screen: header rows + landmark rows. */
type ListRow =
  | { kind: 'header'; key: string; title: string }
  | { kind: 'landmark'; key: string; landmark: LandmarkWithStatus };

export default function CollectionScreen() {
  const router = useRouter();
  const [items, setItems] = useState<LandmarkWithStatus[]>(() =>
    lastCollectedIds ? annotateLandmarks(LANDMARKS, lastCollectedIds) : [],
  );
  const [selected, setSelected] = useState<Landmark | null>(null);
  const [selectedDistanceM, setSelectedDistanceM] = useState<number | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        const ids = await loadCollected();
        lastCollectedIds = ids;
        if (active) setItems(annotateLandmarks(LANDMARKS, ids));
      })();
      return () => {
        active = false;
      };
    }, []),
  );

  // Cached fix first (instant number), fresh fix refines; the target ref drops
  // a late fix that belongs to a previously-opened landmark.
  const distanceTargetRef = useRef<string | null>(null);
  const openDetail = useCallback((lm: Landmark) => {
    setSelected(lm);
    setSelectedDistanceM(null);
    distanceTargetRef.current = lm.id;
    const setIfCurrent = (lat: number, lng: number) => {
      if (distanceTargetRef.current !== lm.id) return;
      setSelectedDistanceM(haversineMeters(lat, lng, lm.lat, lm.lng));
    };
    void (async () => {
      const last = await getLastKnownPosition();
      if (last) setIfCurrent(last.lat, last.lng);
      try {
        const pos = await getCurrentPosition();
        setIfCurrent(pos.lat, pos.lng);
      } catch (e) {
        console.warn('distance fix failed', e);
      }
    })();
  }, []);

  const collectedCount = useMemo(() => items.filter((l) => l.collected).length, [items]);

  const rows = useMemo<ListRow[]>(() => {
    const collected = items.filter((l) => l.collected);
    const locked = items.filter((l) => !l.collected);
    const out: ListRow[] = [];
    if (collected.length > 0) {
      out.push({ kind: 'header', key: 'h-collected', title: 'Collected' });
      collected.forEach((l) => out.push({ kind: 'landmark', key: l.id, landmark: l }));
    }
    out.push({ kind: 'header', key: 'h-locked', title: 'Not yet found' });
    locked.forEach((l) => out.push({ kind: 'landmark', key: l.id, landmark: l }));
    return out;
  }, [items]);

  const renderRow = useCallback(
    ({ item }: { item: ListRow }) => {
      if (item.kind === 'header') return <Text style={styles.section}>{item.title}</Text>;
      return item.landmark.collected ? (
        <CollectedCard landmark={item.landmark} onPress={openDetail} />
      ) : (
        <LockedCard landmark={item.landmark} />
      );
    },
    [openDetail],
  );

  return (
    <Screen colors={colors.statsGradient}>
      <View style={styles.root}>
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Back to map"
            style={({ pressed }) => [styles.back, pressed && press.chip]}
          >
            <Text style={styles.backGlyph}>‹</Text>
          </Pressable>
          <Text style={styles.title}>Collection</Text>
        </View>

        <Text style={styles.count}>
          {collectedCount} / {LANDMARKS.length} collected
        </Text>

        {/* Batch/window tuning: cards are ~85px tall, so 10-per-batch fills a
            screen per pass and a 7-screen window comfortably covers fast flings
            without keeping all ~100 rows mounted. */}
        <FlatList
          data={rows}
          keyExtractor={(row) => row.key}
          renderItem={renderRow}
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          initialNumToRender={12}
          maxToRenderPerBatch={10}
          windowSize={7}
        />
      </View>

      <LandmarkSheet
        landmark={selected}
        distanceM={selectedDistanceM}
        collected
        onClose={() => setSelected(null)}
      />
    </Screen>
  );
}

const CollectedCard = memo(function CollectedCard({
  landmark,
  onPress,
}: {
  landmark: Landmark;
  onPress: (lm: Landmark) => void;
}) {
  const meta = CATEGORY_META[landmark.category];
  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && press.row]}
      onPress={() => onPress(landmark)}
      accessibilityRole="button"
    >
      {landmark.image ? (
        <Image source={landmark.image} style={styles.thumb} resizeMode="cover" />
      ) : (
        <View style={[styles.thumb, { backgroundColor: meta.tintA }]}>
          <View style={[styles.pin, { backgroundColor: meta.color }]}>
            <View style={styles.pinDot} />
          </View>
        </View>
      )}
      <View style={styles.cardText}>
        <Text style={styles.cardName} numberOfLines={1}>
          {landmark.name}
        </Text>
        <Text style={[styles.cardCat, { color: meta.color }]}>{meta.label}</Text>
      </View>
      <View style={styles.check}>
        <Text style={styles.checkGlyph}>✓</Text>
      </View>
    </Pressable>
  );
});

const LockedCard = memo(function LockedCard({ landmark }: { landmark: Landmark }) {
  const meta = CATEGORY_META[landmark.category];
  return (
    <View style={[styles.card, styles.cardLocked]}>
      <View style={[styles.thumb, styles.thumbLocked, { backgroundColor: meta.tintA }]}>
        <LockIcon color="#AEACC6" size={26} />
      </View>
      <View style={styles.cardText}>
        <Text style={styles.cardNameLocked}>???</Text>
        <Text style={[styles.cardCat, { color: meta.color, opacity: 0.82 }]}>{meta.label}</Text>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 24 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: spacing.sm },
  back: {
    width: 46,
    height: 46,
    borderRadius: 15,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.card,
  },
  backGlyph: { fontSize: 22, lineHeight: 24, color: colors.blueDeep, fontFamily: fonts.bodyExtra },
  title: { fontFamily: fonts.display, fontSize: 28, color: colors.ink },
  count: { fontFamily: fonts.bodyExtra, fontSize: 16, color: colors.inkMuted, marginTop: 14, marginLeft: 2 },

  scroll: { flex: 1, marginTop: 14 },
  scrollContent: { paddingBottom: 30 },
  section: { fontFamily: fonts.bodyExtra, fontSize: 15, color: colors.inkMuted, marginTop: 10, marginBottom: 14 },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.white,
    borderRadius: 22,
    padding: 13,
    marginBottom: 12,
    ...shadows.card,
  },
  // Locked cards are flat per the handoff: translucent fill, NO shadow (the
  // collected cards are the only ones that float).
  cardLocked: { backgroundColor: 'rgba(255,255,255,0.5)', shadowOpacity: 0, elevation: 0 },
  thumb: { width: 60, height: 60, borderRadius: 18, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  thumbLocked: { opacity: 0.7 },
  pin: {
    width: 26,
    height: 26,
    borderTopLeftRadius: 13,
    borderTopRightRadius: 13,
    borderBottomRightRadius: 13,
    borderBottomLeftRadius: 0,
    transform: [{ rotate: '-45deg' }],
    borderWidth: 2.5,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#28285A',
    shadowOpacity: 0.22,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  pinDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.white },

  cardText: { flex: 1, gap: 5 },
  cardName: { fontFamily: fonts.display, fontSize: 20, color: colors.ink, lineHeight: 22 },
  cardNameLocked: { fontFamily: fonts.display, fontSize: 20, color: '#C0BFD4', letterSpacing: 2, lineHeight: 22 },
  cardCat: { fontFamily: fonts.bodyExtra, fontSize: 14 },
  check: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#E6F6EE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkGlyph: { fontFamily: fonts.bodyExtra, fontSize: 14, color: '#3FA176' },
});
