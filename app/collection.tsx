import { useCallback, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';

import { Screen } from '@/components/Screen';
import { LandmarkSheet } from '@/components/LandmarkSheet';
import { LockIcon } from '@/components/icons';
import { colors, fonts, shadows, spacing } from '@/theme/tokens';
import { loadCollected } from '@/adapters/storage/collectedRepo';
import { getCurrentPosition } from '@/services/location';
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
 */
export default function CollectionScreen() {
  const router = useRouter();
  const [items, setItems] = useState<LandmarkWithStatus[]>([]);
  const [selected, setSelected] = useState<Landmark | null>(null);
  const [selectedDistanceM, setSelectedDistanceM] = useState<number | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        const ids = await loadCollected();
        if (active) setItems(annotateLandmarks(LANDMARKS, ids));
      })();
      return () => {
        active = false;
      };
    }, []),
  );

  const openDetail = useCallback((lm: Landmark) => {
    setSelected(lm);
    setSelectedDistanceM(null);
    getCurrentPosition()
      .then((pos) => setSelectedDistanceM(haversineMeters(pos.lat, pos.lng, lm.lat, lm.lng)))
      .catch((e) => console.warn('distance fix failed', e));
  }, []);

  const collected = items.filter((l) => l.collected);
  const locked = items.filter((l) => !l.collected);

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
          <Text style={styles.title}>Collection</Text>
        </View>

        <Text style={styles.count}>
          {collected.length} / {items.length} collected
        </Text>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {collected.length > 0 && <Text style={styles.section}>Collected</Text>}
          {collected.map((l) => (
            <CollectedCard key={l.id} landmark={l} onPress={() => openDetail(l)} />
          ))}

          <Text style={styles.section}>Not yet found</Text>
          {locked.map((l) => (
            <LockedCard key={l.id} landmark={l} />
          ))}
        </ScrollView>
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

function CollectedCard({ landmark, onPress }: { landmark: Landmark; onPress: () => void }) {
  const meta = CATEGORY_META[landmark.category];
  return (
    <Pressable style={styles.card} onPress={onPress} accessibilityRole="button">
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
}

function LockedCard({ landmark }: { landmark: Landmark }) {
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
}

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
