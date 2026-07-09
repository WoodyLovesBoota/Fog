import { memo, useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { CloudFace } from '@/components/CloudFace';
import { FloatingCloud } from '@/components/FloatingCloud';
import { colors, fonts } from '@/theme/tokens';

/**
 * Branded launch splash — the explorer cloud mascot bobbing under a warm sun,
 * the "Singapore Explorer" wordmark, and three bouncing loader dots over the
 * soft lilac gradient.
 *
 * Mounted once at app start (see app/_layout.tsx) so it only ever appears on a
 * COLD launch — it is never re-shown when the app returns from the background,
 * because the React tree (and this already-dismissed overlay) stays mounted.
 */

const DOTS = ['#88A5F4', '#7FD4B4', '#9E91E0'] as const;

function LoaderDot({ color, delay }: { color: string; delay: number }) {
  // Ported from the handoff `@keyframes bounce`: rise -9px and brighten, then
  // settle, with a stagger so the three dots ripple left-to-right.
  const t = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(t, { toValue: 1, duration: 460, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(t, { toValue: 0, duration: 460, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.delay(380),
      ])
    );
    const start = setTimeout(() => loop.start(), delay);
    return () => {
      clearTimeout(start);
      loop.stop();
    };
  }, [t, delay]);

  const translateY = t.interpolate({ inputRange: [0, 1], outputRange: [0, -9] });
  const opacity = t.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1] });

  return <Animated.View style={[styles.dot, { backgroundColor: color, opacity, transform: [{ translateY }] }]} />;
}

type Props = {
  /** Called once the hold elapses and the fade-out completes. */
  onDone?: () => void;
  /** How long the splash holds before fading out (ms). */
  holdMs?: number;
};

function SplashOverlayBase({ onDone, holdMs = 1700 }: Props) {
  const fade = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const t = setTimeout(() => {
      Animated.timing(fade, {
        toValue: 0,
        duration: 400,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start(() => onDone?.());
    }, holdMs);
    return () => clearTimeout(t);
  }, [fade, holdMs, onDone]);

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.root, { opacity: fade }]}>
      <LinearGradient
        colors={colors.splashGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.hero}>
        {/* warm sun glow, tucked behind the mascot on the left */}
        <View style={styles.sun} />
        <FloatingCloud amplitude={9} duration={6000} delay={0}>
          <CloudFace mood="happy" hat scale={1.55} />
        </FloatingCloud>
      </View>

      <Text style={styles.title}>Singapore Explorer</Text>
      <Text style={styles.subtitle}>Color the city as you go</Text>

      <View style={styles.loader}>
        {DOTS.map((c, i) => (
          <LoaderDot key={c} color={c} delay={i * 180} />
        ))}
      </View>
    </Animated.View>
  );
}

export const SplashOverlay = memo(SplashOverlayBase);

const styles = StyleSheet.create({
  root: { alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  hero: {
    width: 280,
    height: 230,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 36,
  },
  sun: {
    position: 'absolute',
    left: 30,
    top: 78,
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: '#F6C24E',
    shadowColor: '#F4B73D',
    shadowOpacity: 0.5,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 36,
    lineHeight: 40,
    letterSpacing: -0.5,
    color: colors.ink,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 16,
    color: colors.inkSoft,
    marginTop: 12,
    textAlign: 'center',
  },
  loader: {
    position: 'absolute',
    bottom: 110,
    flexDirection: 'row',
    gap: 11,
  },
  dot: { width: 11, height: 11, borderRadius: 6 },
});
