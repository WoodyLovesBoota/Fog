import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { colors, fonts, shadows } from '@/theme/tokens';
import { locationEvents } from '@/core/exploration/locationEvents';
import {
  DWELL_THRESHOLD_MS,
  MAX_ACCURACY_M,
  MAX_DWELL_GAP_MS,
} from '@/config/explorationConfig';

/**
 * Diagnostic live-signal HUD (top-right of the map). It is a *ground-truth*
 * read-out of the location pipeline, wired straight to {@link locationEvents}:
 *
 *  - pulsing green "LIVE" whenever a fix arrived within {@link LIVE_WINDOW_MS}
 *    (driven by `onRawFix`, so it lights up even for fixes too noisy to count);
 *  - the latest horizontal accuracy, amber when it's worse than the
 *    {@link MAX_ACCURACY_M} gate that silently drops fixes;
 *  - accepted/received fix counts;
 *  - a dwell bar toward the {@link DWELL_THRESHOLD_MS} that uncovers a cell;
 *  - how many cells (holes) have been cleared this session.
 *
 * If this pill is dark, the app is receiving nothing — the problem is upstream
 * (permission / background mode / Expo Go), not the fog. If it's green but the
 * accuracy is amber, fixes are being dropped for noise. If it's green with good
 * accuracy and the dwell bar fills but no hole appears, the bug is downstream.
 *
 * The dwell figure is a fresh in-memory approximation (it resets on remount);
 * the persisted engine state is the source of truth for what actually counts.
 */
const LIVE_WINDOW_MS = 8_000;

type Props = { style?: ViewStyle };

export function LiveSignal({ style }: Props) {
  const [live, setLive] = useState(false);
  const [acc, setAcc] = useState<number | null>(null);
  const [okCount, setOkCount] = useState(0);
  const [rawCount, setRawCount] = useState(0);
  const [cleared, setCleared] = useState(0);
  const [dwellMs, setDwellMs] = useState(0);

  const offTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dwellCell = useRef<string | null>(null);
  const lastOkAt = useRef<number | null>(null);
  const pulse = useRef(new Animated.Value(1)).current;

  // Heartbeat: pulse the dot only while live; hold it solid when idle.
  useEffect(() => {
    if (!live) {
      pulse.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.25, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [live, pulse]);

  useEffect(() => {
    const offRaw = locationEvents.onRawFix((e) => {
      setLive(true);
      setAcc(e.accuracy);
      setRawCount((n) => n + 1);
      if (offTimer.current) clearTimeout(offTimer.current);
      offTimer.current = setTimeout(() => setLive(false), LIVE_WINDOW_MS);
    });
    const offFix = locationEvents.onFix((e) => {
      setOkCount((n) => n + 1);
      const now = e.timestamp || Date.now();
      // Approximate the engine's dwell: credit the gap to the cell we sat in,
      // reset on a cell change or a gap too long to be real dwell.
      if (dwellCell.current === e.cellId && lastOkAt.current != null) {
        const dt = now - lastOkAt.current;
        if (dt > 0 && dt <= MAX_DWELL_GAP_MS) setDwellMs((d) => d + dt);
      } else {
        dwellCell.current = e.cellId;
        setDwellMs(0);
      }
      lastOkAt.current = now;
    });
    const offVisited = locationEvents.onVisited(() => {
      setCleared((n) => n + 1);
      setDwellMs(0);
      dwellCell.current = null;
      lastOkAt.current = null;
    });
    return () => {
      offRaw();
      offFix();
      offVisited();
      if (offTimer.current) clearTimeout(offTimer.current);
    };
  }, []);

  const accGood = acc != null && acc <= MAX_ACCURACY_M;
  const pct = Math.min(100, (dwellMs / DWELL_THRESHOLD_MS) * 100);

  return (
    <View style={[styles.wrap, style]} pointerEvents="none">
      <View style={styles.row}>
        <Animated.View
          style={[
            styles.dot,
            { backgroundColor: live ? colors.statTints[1].fg : colors.inkMuted, opacity: live ? pulse : 1 },
          ]}
        />
        <Text style={styles.title}>{live ? 'LIVE' : '신호 없음'}</Text>
      </View>

      {acc == null ? (
        <Text style={styles.sub}>GPS 대기 중…</Text>
      ) : (
        <Text style={[styles.sub, { color: accGood ? colors.inkSoft : colors.poi.orange }]}>
          ±{Math.round(acc)}m{accGood ? '' : ' ⚠ 정확도 초과'} · fix {okCount}/{rawCount}
        </Text>
      )}

      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct}%` }]} />
      </View>
      <Text style={styles.foot}>
        dwell {Math.floor(dwellMs / 1000)}/{DWELL_THRESHOLD_MS / 1000}s · 구멍 {cleared}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    backgroundColor: colors.white,
    borderRadius: 16,
    paddingVertical: 9,
    paddingHorizontal: 12,
    gap: 5,
    minWidth: 138,
    ...shadows.chip,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  dot: { width: 9, height: 9, borderRadius: 5 },
  title: { fontFamily: fonts.display, fontSize: 14, color: colors.ink, letterSpacing: 0.5 },
  sub: { fontFamily: fonts.body, fontSize: 11, color: colors.inkSoft },
  track: { height: 4, borderRadius: 2, backgroundColor: colors.hexTrack, overflow: 'hidden' },
  fill: { height: 4, borderRadius: 2, backgroundColor: colors.blueSoft },
  foot: { fontFamily: fonts.body, fontSize: 10, color: colors.inkMuted },
});
