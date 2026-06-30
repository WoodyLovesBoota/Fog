import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, View, type ViewStyle } from 'react-native';

import { colors, shadows } from '@/theme/tokens';
import { locationEvents } from '@/core/exploration/locationEvents';

/**
 * Minimal liveness indicator (top-right of the map): a single dot that gently
 * breathes a soft green halo while the location pipeline is alive — a fix
 * arrived within {@link LIVE_WINDOW_MS} — and settles into a muted resting dot
 * when nothing is coming in. No diagnostics, no text: just "the signal is live".
 *
 * Wired straight to {@link locationEvents} via `onRawFix`, so it lights up even
 * for fixes too noisy to clear a cell. If the dot stays muted, the app is
 * receiving nothing — the problem is upstream (permission / background mode).
 */
const LIVE_WINDOW_MS = 8_000;
/** Soft green, shared with the success stat tint, for the alive state. */
const LIVE_COLOR = colors.statTints[1].fg;

type Props = { style?: ViewStyle };

export function LiveSignal({ style }: Props) {
  const [live, setLive] = useState(false);
  const offTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pulse = useRef(new Animated.Value(0)).current;

  // Liveness: each raw fix lights the dot and (re)arms a fall-dark timer.
  useEffect(() => {
    const offRaw = locationEvents.onRawFix(() => {
      setLive(true);
      if (offTimer.current) clearTimeout(offTimer.current);
      offTimer.current = setTimeout(() => setLive(false), LIVE_WINDOW_MS);
    });
    return () => {
      offRaw();
      if (offTimer.current) clearTimeout(offTimer.current);
    };
  }, []);

  // Breathing halo: an expanding, fading ring that loops only while live.
  useEffect(() => {
    if (!live) {
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.timing(pulse, { toValue: 1, duration: 1600, useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [live, pulse]);

  const haloScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.7, 2.6] });
  const haloOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0] });

  return (
    <View style={[styles.wrap, style]} pointerEvents="none">
      {live && (
        <Animated.View
          style={[styles.halo, { transform: [{ scale: haloScale }], opacity: haloOpacity }]}
        />
      )}
      <View style={[styles.core, { backgroundColor: live ? LIVE_COLOR : colors.inkMuted }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', width: 14, height: 14, alignItems: 'center', justifyContent: 'center' },
  halo: { position: 'absolute', width: 14, height: 14, borderRadius: 7, backgroundColor: LIVE_COLOR },
  core: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.white,
    ...shadows.chip,
  },
});
