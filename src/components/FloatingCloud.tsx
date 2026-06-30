import { memo, useEffect, useRef } from 'react';
import { Animated, Easing, type StyleProp, type ViewStyle } from 'react-native';

type Props = {
  children: React.ReactNode;
  /** Peak rise in px (design uses 7 for "floatB", 10 for "float"). */
  amplitude?: number;
  /** One full up-and-down cycle, in ms (design: 6000–7500). */
  duration?: number;
  /** Stagger so neighbouring clouds bob out of sync. */
  delay?: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * Wraps a static cloud so it gently bobs up and down forever — the drifting
 * float ported from the handoff prototype's `@keyframes float`/`floatB`
 * (translateY 0 → -Npx → 0, ease-in-out, infinite). Each cloud takes its own
 * amplitude/duration/delay so the group drifts out of phase like real clouds.
 */
function FloatingCloudBase({ children, amplitude = 10, duration = 6500, delay = 0, style }: Props) {
  // 0 → 1 → 0 drives the bob; native-driven so it runs off the JS thread.
  const t = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(t, {
          toValue: 1,
          duration: duration / 2,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(t, {
          toValue: 0,
          duration: duration / 2,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    const start = setTimeout(() => loop.start(), delay);
    return () => {
      clearTimeout(start);
      loop.stop();
    };
  }, [t, duration, delay]);

  const translateY = t.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -amplitude],
  });

  return <Animated.View style={[style, { transform: [{ translateY }] }]}>{children}</Animated.View>;
}

export const FloatingCloud = memo(FloatingCloudBase);
