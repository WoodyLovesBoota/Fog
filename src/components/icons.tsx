import { View, StyleSheet } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { colors } from '@/theme/tokens';

/** Padlock glyph for locked / "not yet found" collection slots. */
export function LockIcon({ color = '#AEACC6', size = 26 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* shackle */}
      <Path
        d="M7.2 11V8.2a4.8 4.8 0 0 1 9.6 0V11"
        stroke={color}
        strokeWidth={2.4}
        strokeLinecap="round"
      />
      {/* body */}
      <Rect x={4.4} y={10.4} width={15.2} height={10.8} rx={3.2} fill={color} />
      {/* keyhole */}
      <Circle cx={12} cy={15} r={1.8} fill={colors.white} />
      <Rect x={11.2} y={15} width={1.6} height={3.4} rx={0.8} fill={colors.white} />
    </Svg>
  );
}

/** Tiny three-bar chart glyph (Stats button + signal indicator). */
export function BarsIcon({ color = colors.blueSoft, size = 14 }: { color?: string; size?: number }) {
  const unit = size / 14;
  return (
    <View style={[styles.bars, { height: size }]}>
      <View style={[styles.bar, { height: 7 * unit, backgroundColor: color }]} />
      <View style={[styles.bar, { height: 14 * unit, backgroundColor: color }]} />
      <View style={[styles.bar, { height: 10 * unit, backgroundColor: color }]} />
    </View>
  );
}

/** Crosshair / "locate me" compass glyph. */
export function CrosshairIcon({ color = colors.blueDeep, size = 26 }: { color?: string; size?: number }) {
  return (
    <View style={{ width: size, height: size }}>
      <View style={[styles.ring, { borderColor: color }]} />
      <View style={[styles.center, { backgroundColor: color }]} />
      <View style={[styles.tickV, { backgroundColor: color, top: -1 }]} />
      <View style={[styles.tickV, { backgroundColor: color, bottom: -1 }]} />
      <View style={[styles.tickH, { backgroundColor: color, left: -1 }]} />
      <View style={[styles.tickH, { backgroundColor: color, right: -1 }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 2.5 },
  bar: { width: 3.5, borderRadius: 1.5 },
  ring: {
    position: 'absolute',
    top: 5,
    left: 5,
    right: 5,
    bottom: 5,
    borderWidth: 2.5,
    borderRadius: 999,
  },
  center: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: 6,
    height: 6,
    borderRadius: 999,
    marginLeft: -3,
    marginTop: -3,
  },
  tickV: { position: 'absolute', left: '50%', marginLeft: -1.25, width: 2.5, height: 6, borderRadius: 1 },
  tickH: { position: 'absolute', top: '50%', marginTop: -1.25, height: 2.5, width: 6, borderRadius: 1 },
});
