import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInUp, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

import { colors, fonts, shadows } from '@/theme/tokens';

/** Floating green confirmation pill shown when a new cell is uncovered. */
export function Toast({ message }: { message: string | null }) {
  // Offset from the safe-area top, not the screen top: a fixed `top` would sit
  // the pill under the status bar / on top of the progress badge on notched
  // phones. 64 clears the badge row (insets.top + 12 + ~44px of badge).
  const insets = useSafeAreaInsets();
  if (!message) return null;
  return (
    <Animated.View
      entering={FadeInUp.duration(220)}
      exiting={FadeOut.duration(200)}
      pointerEvents="none"
      style={[styles.wrap, { top: insets.top + 64 }]}
    >
      <LinearGradient
        colors={colors.toastGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.pill}
      >
        <View style={styles.dot} />
        <Text style={styles.text}>{message}</Text>
      </LinearGradient>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', alignSelf: 'center', zIndex: 16 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 22,
    paddingVertical: 10,
    paddingHorizontal: 18,
    ...shadows.chip,
  },
  dot: { width: 8, height: 8, borderRadius: 999, backgroundColor: colors.white },
  text: { color: colors.white, fontFamily: fonts.bodyExtra, fontSize: 14 },
});
