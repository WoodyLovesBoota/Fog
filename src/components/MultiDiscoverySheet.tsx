import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

import { colors, fonts, shadows, spacing } from '@/theme/tokens';
import { CATEGORY_META, type Landmark } from '@/features/poi/landmarks';
import { beaconEmoji } from '@/features/poi/landmarkGeo';

const SCREEN_H = Dimensions.get('window').height;

/**
 * Multi-discovery bottom sheet (Step 6.1).
 *
 * When a single fix collects TWO OR MORE landmarks at once (a dense area), the
 * one-at-a-time {@link import('./CollectModal').CollectModal} would force the
 * user to tap through a stack. Instead we surface the whole batch in one
 * scrollable FlatList — skim everything, then "Keep exploring" to dismiss.
 *
 * Display-only: collection, persistence, the pins and the counter are all
 * already done at discovery time (see `handleFix` in `app/map.tsx`). Closing
 * this is a pure dismiss; tapping a row opens that landmark's detail sheet.
 *
 * Anchors (already on the map) show a ✓ "checked in" badge; hidden landmarks a
 * ✨ "new" badge, so a mixed batch stays legible row by row.
 *
 * Animation mirrors `LandmarkSheet`: the backdrop fades while the sheet slides
 * up independently, and the last batch stays mounted through the slide-down so
 * the exit animation still has content.
 */
export function MultiDiscoverySheet({
  items,
  onSelect,
  onClose,
}: {
  /** The batch to show. Empty hides (and animates) the sheet out. */
  items: Landmark[];
  /** Tap a row → open that landmark's detail (caller also dismisses the sheet). */
  onSelect: (landmark: Landmark) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const anim = useRef(new Animated.Value(0)).current; // 0 = hidden, 1 = shown
  // Kept mounted through the slide-down so the exit animation still has rows.
  const [shown, setShown] = useState<Landmark[]>([]);

  const open = items.length > 0;

  useEffect(() => {
    if (open) {
      setShown(items);
      Animated.timing(anim, {
        toValue: 1,
        duration: 300,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(anim, {
        toValue: 0,
        duration: 220,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setShown([]);
      });
    }
  }, [open, items, anim]);

  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [SCREEN_H, 0] });

  return (
    <Modal visible={shown.length > 0} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      {/* Backdrop: opacity only — does NOT ride up with the sheet. */}
      <Animated.View style={[styles.backdrop, { opacity: anim }]}>
        <Pressable style={styles.fill} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" />
      </Animated.View>

      <View style={styles.wrap} pointerEvents="box-none">
        <Animated.View
          style={[styles.sheet, { paddingBottom: insets.bottom + spacing.md, transform: [{ translateY }] }]}
        >
          <View style={styles.handle} />
          <Text style={styles.title}>{shown.length} landmarks discovered!</Text>
          <Text style={styles.subtitle}>You passed several spots at once · +{shown.length} ✦</Text>

          <FlatList
            data={shown}
            keyExtractor={(item) => item.id}
            style={styles.list}
            showsVerticalScrollIndicator={false}
            ItemSeparatorComponent={() => <View style={styles.sep} />}
            renderItem={({ item }) => <Row landmark={item} onPress={() => onSelect(item)} />}
          />

          <Pressable onPress={onClose} style={styles.cta} accessibilityRole="button">
            <LinearGradient colors={colors.primaryButton} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={styles.ctaInner}>
              <Text style={styles.ctaText}>Keep exploring</Text>
            </LinearGradient>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

function Row({ landmark, onPress }: { landmark: Landmark; onPress: () => void }) {
  const meta = CATEGORY_META[landmark.category];
  return (
    <Pressable style={styles.row} onPress={onPress} accessibilityRole="button">
      <View style={[styles.thumb, { backgroundColor: meta.tintA }]}>
        <Text style={styles.thumbEmoji}>{beaconEmoji(landmark)}</Text>
      </View>
      <View style={styles.rowText}>
        <View style={styles.rowTop}>
          <Text style={styles.name} numberOfLines={1}>
            {landmark.name}
          </Text>
          <View style={[styles.badge, landmark.isAnchor ? styles.badgeAnchor : styles.badgeNew]}>
            <Text style={[styles.badgeGlyph, { color: landmark.isAnchor ? '#3FA176' : meta.color }]}>
              {landmark.isAnchor ? '✓' : '✨'}
            </Text>
          </View>
        </View>
        <Text style={[styles.cat, { color: meta.color }]} numberOfLines={1}>
          {meta.label}
          {landmark.area ? ` · ${landmark.area}` : ''}
        </Text>
        {landmark.description ? (
          <Text style={styles.desc} numberOfLines={2}>
            {landmark.description}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(28,30,70,0.36)' },
  wrap: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 34,
    borderTopRightRadius: 34,
    paddingTop: 12,
    paddingHorizontal: 22,
    maxHeight: '82%',
    ...shadows.floating,
  },
  handle: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: '#DCDAEC' },

  title: { fontFamily: fonts.display, fontSize: 24, color: colors.ink, marginTop: 16 },
  subtitle: { fontFamily: fonts.bodyExtra, fontSize: 13.5, color: colors.inkMuted, marginTop: 5 },

  // flexShrink lets the list yield to the title/CTA and scroll once the sheet
  // hits maxHeight; flexGrow:0 keeps a short batch from stretching the sheet.
  list: { flexGrow: 0, flexShrink: 1, marginTop: 16 },
  sep: { height: 1, backgroundColor: '#F0EFF8' },

  row: { flexDirection: 'row', alignItems: 'center', gap: 13, paddingVertical: 12 },
  thumb: { width: 54, height: 54, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  thumbEmoji: { fontSize: 26 },
  rowText: { flex: 1, gap: 4 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { flex: 1, fontFamily: fonts.display, fontSize: 18, color: colors.ink, lineHeight: 21 },
  badge: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  badgeAnchor: { backgroundColor: '#E6F6EE' },
  badgeNew: { backgroundColor: '#F1ECFB' },
  badgeGlyph: { fontFamily: fonts.bodyExtra, fontSize: 12 },
  cat: { fontFamily: fonts.bodyExtra, fontSize: 13 },
  desc: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: '#6E7099' },

  cta: { paddingTop: 16 },
  ctaInner: { borderRadius: 26, paddingVertical: 16, alignItems: 'center', ...shadows.button },
  ctaText: { fontFamily: fonts.displayMedium, fontSize: 18, color: colors.white },
});
