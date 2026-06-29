import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Image,
  Modal,
  Pressable,
  ScrollView,
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
 * Landmark detail bottom sheet (design handoff).
 *
 * Everything shown is read from the `Landmark` record: hero photo (`image`),
 * category, name, blurb (`description`) and the info rows
 * (`hours`/`area`/`tip`). Distance is resolved live by the caller.
 *
 * Animation: the backdrop fades in via opacity while the sheet slides up
 * independently — so the dim doesn't ride up with the sheet. The last landmark
 * stays mounted through the slide-down so the close animation has content.
 */
export function LandmarkSheet({
  landmark,
  distanceM,
  collected,
  onClose,
}: {
  landmark: Landmark | null;
  /** Great-circle distance user→landmark in meters; null while resolving/unavailable. */
  distanceM: number | null;
  /** Whether this landmark's cell has been uncovered. */
  collected: boolean;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const anim = useRef(new Animated.Value(0)).current; // 0 = hidden, 1 = shown
  // Kept mounted through the slide-down so the exit animation still has content.
  const [shown, setShown] = useState<Landmark | null>(null);

  useEffect(() => {
    if (landmark) {
      setShown(landmark);
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
        if (finished) setShown(null);
      });
    }
  }, [landmark, anim]);

  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [SCREEN_H, 0] });

  return (
    <Modal visible={shown != null} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      {/* Backdrop: opacity only — does NOT ride up with the sheet. */}
      <Animated.View style={[styles.backdrop, { opacity: anim }]}>
        <Pressable style={styles.fill} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" />
      </Animated.View>

      <View style={styles.wrap} pointerEvents="box-none">
        <Animated.View
          style={[styles.sheet, { paddingBottom: insets.bottom + spacing.sm, transform: [{ translateY }] }]}
        >
          <View style={styles.handle} />
          {shown && (
            <Body landmark={shown} distanceM={distanceM} collected={collected} onClose={onClose} />
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

function Body({
  landmark,
  distanceM,
  collected,
  onClose,
}: {
  landmark: Landmark;
  distanceM: number | null;
  collected: boolean;
  onClose: () => void;
}) {
  const meta = CATEGORY_META[landmark.category];
  const infoRows = [
    landmark.hours && { key: 'hours', label: 'Hours', value: landmark.hours, glyph: <View style={styles.gRing} /> },
    landmark.area && { key: 'area', label: 'Region', value: landmark.area, glyph: <View style={styles.gDrop} /> },
    landmark.tip && { key: 'tip', label: 'Good to know', value: landmark.tip, glyph: <View style={styles.gDot} /> },
  ].filter(Boolean) as { key: string; label: string; value: string; glyph: React.ReactNode }[];

  return (
    <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
      {/* Hero: real photo if provided, else a tinted placeholder with the glyph. */}
      <View style={styles.hero}>
        {landmark.image ? (
          <Image source={landmark.image} style={styles.heroFill} resizeMode="cover" />
        ) : (
          <LinearGradient
            colors={[meta.tintA, meta.tintB]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.heroFill, styles.heroCenter]}
          >
            <Text style={styles.heroEmoji}>{beaconEmoji(landmark)}</Text>
          </LinearGradient>
        )}
        <View style={styles.catChip}>
          <Text style={[styles.catChipText, { color: meta.color }]}>{meta.label}</Text>
        </View>
        <Pressable onPress={onClose} style={styles.close} accessibilityRole="button" accessibilityLabel="Close">
          <Text style={styles.closeGlyph}>✕</Text>
        </Pressable>
      </View>

      {/* Title + meta. */}
      <View style={styles.titleArea}>
        <Text style={styles.name}>{landmark.name}</Text>

        <View style={styles.metaRow}>
          <View style={styles.distChip}>
            <View style={styles.distDot} />
            <Text style={styles.distText}>{formatDistance(distanceM)} away</Text>
          </View>
          {collected ? (
            <View style={styles.coloredBadge}>
              <View style={styles.coloredDot} />
              <Text style={styles.coloredText}>Colored</Text>
            </View>
          ) : (
            <View style={styles.lockedBadge}>
              <Text style={styles.lockedText}>Not colored yet</Text>
            </View>
          )}
        </View>

        {landmark.description ? <Text style={styles.blurb}>{landmark.description}</Text> : null}
      </View>

      {/* Info rows. */}
      {infoRows.length > 0 && (
        <View style={styles.infoCard}>
          {infoRows.map((row, i) => (
            <View key={row.key} style={[styles.infoRow, i < infoRows.length - 1 && styles.infoDivider]}>
              <View style={styles.infoIcon}>{row.glyph}</View>
              <Text style={styles.infoLabel}>{row.label}</Text>
              <Text style={styles.infoValue}>{row.value}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Close action. */}
      <Pressable onPress={onClose} style={styles.cta} accessibilityRole="button">
        <LinearGradient colors={colors.primaryButton} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={styles.ctaInner}>
          <Text style={styles.ctaText}>Close</Text>
        </LinearGradient>
      </Pressable>
    </ScrollView>
  );
}

/** "—" while unknown, "320 m" under 1 km, else "1.2 km". */
export function formatDistance(distanceM: number | null): string {
  if (distanceM == null) return 'Calculating…';
  if (distanceM < 1000) return `${Math.round(distanceM)} m`;
  return `${(distanceM / 1000).toFixed(1)} km`;
}

const ICON = { size: 34, radius: 11 } as const;

const styles = StyleSheet.create({
  fill: { flex: 1 },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(28,30,70,0.36)' },
  wrap: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 34,
    borderTopRightRadius: 34,
    paddingTop: 12,
    maxHeight: '92%',
    ...shadows.floating,
  },
  handle: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: '#DCDAEC' },

  hero: { marginHorizontal: 16, marginTop: 14, height: 174, borderRadius: 24, overflow: 'hidden' },
  heroFill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  heroCenter: { alignItems: 'center', justifyContent: 'center' },
  heroEmoji: { fontSize: 70 },
  catChip: {
    position: 'absolute',
    left: 14,
    top: 14,
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderRadius: 13,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  catChipText: { fontFamily: fonts.bodyExtra, fontSize: 12 },
  close: {
    position: 'absolute',
    right: 12,
    top: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.94)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeGlyph: { fontFamily: fonts.bodyExtra, fontSize: 15, color: '#6E7099', lineHeight: 16 },

  titleArea: { paddingHorizontal: 22, paddingTop: 16 },
  name: { fontFamily: fonts.display, fontSize: 25, color: colors.ink, lineHeight: 28 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 11 },
  distChip: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  distDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.blueSoft },
  distText: { fontFamily: fonts.bodyExtra, fontSize: 13, color: colors.inkSoft },
  coloredBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#E6F6EE',
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 11,
  },
  coloredDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#5FC39C' },
  coloredText: { fontFamily: fonts.bodyExtra, fontSize: 12, color: '#3FA176' },
  lockedBadge: { backgroundColor: '#F0EFF8', borderRadius: 12, paddingVertical: 4, paddingHorizontal: 11 },
  lockedText: { fontFamily: fonts.bodyExtra, fontSize: 12, color: colors.inkMuted },
  blurb: { marginTop: 14, fontFamily: fonts.body, fontSize: 14.5, lineHeight: 22, color: '#6E7099' },

  infoCard: { marginHorizontal: 22, marginTop: 16, backgroundColor: '#F6F5FC', borderRadius: 22, paddingHorizontal: 16 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 13, paddingVertical: 13 },
  infoDivider: { borderBottomWidth: 1.5, borderBottomColor: '#ECEAF6' },
  infoIcon: {
    width: ICON.size,
    height: ICON.size,
    borderRadius: ICON.radius,
    backgroundColor: '#E8EFFD',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoLabel: { flex: 1, fontFamily: fonts.bodyExtra, fontSize: 13, color: colors.inkMuted },
  infoValue: { fontFamily: fonts.bodyExtra, fontSize: 14, color: colors.ink, maxWidth: 190, textAlign: 'right' },
  gRing: { width: 12, height: 12, borderRadius: 6, borderWidth: 2.5, borderColor: colors.blueSoft },
  gDrop: {
    width: 11,
    height: 11,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    borderBottomRightRadius: 6,
    backgroundColor: '#5FC39C',
    transform: [{ rotate: '-45deg' }],
  },
  gDot: { width: 11, height: 11, borderRadius: 6, backgroundColor: '#F4B73D' },

  cta: { paddingHorizontal: 22, paddingTop: 18, paddingBottom: 12 },
  ctaInner: { borderRadius: 28, paddingVertical: 17, alignItems: 'center', ...shadows.button },
  ctaText: { fontFamily: fonts.displayMedium, fontSize: 19, color: colors.white },
});
