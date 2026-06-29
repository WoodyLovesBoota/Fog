import { memo, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { colors } from '@/theme/tokens';

/** The user's position: a solid blue dot with a soft radar pulse around it. */
function LocationDotImpl({ x, y }: { x: number; y: number }) {
  const t = useSharedValue(0);

  useEffect(() => {
    t.value = withRepeat(withTiming(1, { duration: 2200, easing: Easing.out(Easing.ease) }), -1, false);
  }, [t]);

  const pulse = useAnimatedStyle(() => ({
    transform: [{ scale: 0.55 + t.value * 2.15 }],
    opacity: t.value < 0.8 ? 0.55 * (1 - t.value / 0.8) : 0,
  }));

  return (
    <View pointerEvents="none" style={[styles.wrap, { left: x - 9, top: y - 9 }]}>
      <Animated.View style={[styles.pulse, pulse]} />
      <View style={styles.core} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', width: 18, height: 18, zIndex: 9, alignItems: 'center', justifyContent: 'center' },
  pulse: { position: 'absolute', width: 18, height: 18, borderRadius: 999, backgroundColor: colors.dotPulse },
  core: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 999,
    backgroundColor: colors.dotCore,
    borderWidth: 2.5,
    borderColor: colors.white,
  },
});

export const LocationDot = memo(LocationDotImpl);
