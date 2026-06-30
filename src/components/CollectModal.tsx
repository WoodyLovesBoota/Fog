import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { colors, fonts, shadows } from '@/theme/tokens';
import { CATEGORY_META, type Landmark } from '@/features/poi/landmarks';

/**
 * Single-landmark celebration modal (design handoff). Pops centered over a dim
 * backdrop when exactly one landmark is collected — within
 * {@link import('@/config/explorationConfig').DISCOVERY_RADIUS_M} of its
 * coordinate. A batch of two or more routes to MultiDiscoverySheet instead, so
 * this surface always shows just one.
 *
 * Two variants share the layout: an ANCHOR (already on the map) reads as a
 * "check-in", a HIDDEN landmark as a "new discovery".
 */
export function CollectModal({
  landmark,
  onViewDetails,
  onDismiss,
}: {
  landmark: Landmark | null;
  onViewDetails: (landmark: Landmark) => void;
  onDismiss: () => void;
}) {
  const meta = landmark ? CATEGORY_META[landmark.category] : null;
  const isAnchor = landmark?.isAnchor ?? false;

  return (
    <Modal visible={landmark != null} transparent animationType="fade" onRequestClose={onDismiss} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onDismiss} accessibilityRole="button" accessibilityLabel="Close" />
      <View style={styles.center} pointerEvents="box-none">
        {landmark && meta && (
          <View style={styles.card}>
            {/* Sparkle accents. */}
            <View style={[styles.sparkle, { left: 40, top: 26, backgroundColor: '#F4B73D' }]} />
            <View style={[styles.sparkle, { right: 38, top: 42, backgroundColor: '#88A5F4' }]} />
            <View style={[styles.sparkleDot, { right: 60, top: 16 }]} />

            {/* Medal: tinted disc with the pin in the middle. */}
            <View style={styles.medal}>
              <LinearGradient
                colors={[colors.white, meta.tintB, meta.tintA]}
                start={{ x: 0.35, y: 0.3 }}
                end={{ x: 1, y: 1 }}
                style={styles.medalDisc}
              />
              <View style={[styles.pin, { backgroundColor: meta.color }]}>
                <View style={styles.pinDot} />
              </View>
            </View>

            <Text style={[styles.kicker, { color: meta.color }]}>
              {isAnchor ? '✓ CHECKED IN' : '✨ NEW LANDMARK DISCOVERED'}
            </Text>
            <Text style={styles.name}>{landmark.name}</Text>
            <Text style={styles.sub}>
              {meta.label}
              {landmark.area ? ` · ${landmark.area}` : ''}
            </Text>

            <View style={styles.addedChip}>
              <View style={styles.addedDot} />
              <Text style={styles.addedText}>Added to your collection · +1 ✦</Text>
            </View>

            <View style={styles.actions}>
              <Pressable onPress={() => onViewDetails(landmark)} accessibilityRole="button">
                <LinearGradient colors={colors.primaryButton} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={styles.primary}>
                  <Text style={styles.primaryText}>View details</Text>
                </LinearGradient>
              </Pressable>
              <Pressable onPress={onDismiss} accessibilityRole="button" style={styles.secondary}>
                <Text style={styles.secondaryText}>Keep exploring</Text>
              </Pressable>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(28,30,70,0.42)' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 22 },
  card: {
    width: '100%',
    maxWidth: 348,
    backgroundColor: colors.white,
    borderRadius: 32,
    paddingTop: 32,
    paddingHorizontal: 26,
    paddingBottom: 24,
    alignItems: 'center',
    overflow: 'hidden',
    shadowColor: '#28285A',
    shadowOpacity: 0.36,
    shadowRadius: 32,
    shadowOffset: { width: 0, height: 20 },
    elevation: 16,
  },
  sparkle: { position: 'absolute', width: 8, height: 8, borderRadius: 2, opacity: 0.9 },
  sparkleDot: { position: 'absolute', width: 7, height: 7, borderRadius: 4, backgroundColor: '#5FC39C' },

  medal: { width: 104, height: 104, marginTop: 4, alignItems: 'center', justifyContent: 'center' },
  medalDisc: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 52,
    shadowColor: '#28285A',
    shadowOpacity: 0.16,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  pin: {
    width: 40,
    height: 40,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderBottomRightRadius: 20,
    borderBottomLeftRadius: 0,
    transform: [{ rotate: '-45deg' }],
    borderWidth: 3.5,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#28285A',
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 8,
  },
  pinDot: { width: 13, height: 13, borderRadius: 7, backgroundColor: colors.white },

  kicker: { marginTop: 18, fontFamily: fonts.bodyExtra, fontSize: 12, letterSpacing: 1.4 },
  name: { marginTop: 7, fontFamily: fonts.display, fontSize: 26, color: colors.ink, lineHeight: 29, textAlign: 'center' },
  sub: { marginTop: 7, fontFamily: fonts.bodyBold, fontSize: 14, color: colors.inkMuted },

  addedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 16,
    backgroundColor: '#F6F5FC',
    borderRadius: 16,
    paddingVertical: 9,
    paddingHorizontal: 16,
  },
  addedDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#F4B73D' },
  addedText: { fontFamily: fonts.bodyExtra, fontSize: 13, color: colors.blueLink },

  actions: { marginTop: 22, alignSelf: 'stretch', gap: 10 },
  primary: { borderRadius: 24, paddingVertical: 15, alignItems: 'center', ...shadows.button },
  primaryText: { fontFamily: fonts.displayMedium, fontSize: 18, color: colors.white },
  secondary: { paddingVertical: 4, alignItems: 'center' },
  secondaryText: { fontFamily: fonts.bodyExtra, fontSize: 15, color: colors.inkMuted },
});
