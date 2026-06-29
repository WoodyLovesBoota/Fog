import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInUp, FadeOut } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

import { colors, fonts, shadows } from '@/theme/tokens';

/** Floating green confirmation pill shown when a new cell is uncovered. */
export function Toast({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <Animated.View
      entering={FadeInUp.duration(220)}
      exiting={FadeOut.duration(200)}
      pointerEvents="none"
      style={styles.wrap}
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
  wrap: { position: 'absolute', top: 64, alignSelf: 'center', zIndex: 16 },
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
