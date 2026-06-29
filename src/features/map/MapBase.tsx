import { memo } from 'react';
import Svg, {
  Rect,
  Defs,
  RadialGradient,
  Stop,
  Pattern,
  Line,
  Ellipse,
} from 'react-native-svg';

import { colors } from '@/theme/tokens';

/**
 * The colorful city that lives *under* the fog. A flat land base, a faint
 * street grid, a sea sweeping in from the bottom corners, and a few soft park
 * blobs — a stylized Singapore, matching the prototype's layered gradients.
 */
function MapBaseImpl({ width, height }: { width: number; height: number }) {
  const W = width;
  const H = height;
  return (
    <Svg width={W} height={H} style={{ position: 'absolute', top: 0, left: 0 }}>
      <Defs>
        <Pattern id="grid" width={46} height={46} patternUnits="userSpaceOnUse">
          <Line x1={0} y1={0} x2={46} y2={0} stroke={colors.gridLine} strokeWidth={2} />
          <Line x1={0} y1={0} x2={0} y2={46} stroke={colors.gridLine} strokeWidth={2} />
        </Pattern>
        <RadialGradient id="sea" cx="94%" cy="96%" rx="85%" ry="60%">
          <Stop offset="0%" stopColor={colors.water[0]} stopOpacity={1} />
          <Stop offset="48%" stopColor={colors.water[1]} stopOpacity={1} />
          <Stop offset="80%" stopColor={colors.water[1]} stopOpacity={0} />
        </RadialGradient>
        <RadialGradient id="sea2" cx="6%" cy="90%" rx="55%" ry="36%">
          <Stop offset="0%" stopColor={colors.water[2]} stopOpacity={1} />
          <Stop offset="78%" stopColor={colors.water[2]} stopOpacity={0} />
        </RadialGradient>
        <RadialGradient id="park" cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor={colors.park[0]} stopOpacity={1} />
          <Stop offset="55%" stopColor={colors.park[1]} stopOpacity={1} />
          <Stop offset="100%" stopColor={colors.park[1]} stopOpacity={0} />
        </RadialGradient>
      </Defs>

      {/* land */}
      <Rect x={0} y={0} width={W} height={H} fill={colors.land} />
      {/* street grid */}
      <Rect x={0} y={0} width={W} height={H} fill="url(#grid)" />
      {/* parks */}
      <Ellipse cx={0.25 * W} cy={0.27 * H} rx={0.22 * W} ry={0.16 * H} fill="url(#park)" />
      <Ellipse cx={0.72 * W} cy={0.2 * H} rx={0.16 * W} ry={0.12 * H} fill="url(#park)" />
      <Ellipse cx={0.52 * W} cy={0.6 * H} rx={0.18 * W} ry={0.13 * H} fill="url(#park)" />
      {/* sea */}
      <Rect x={0} y={0} width={W} height={H} fill="url(#sea)" />
      <Rect x={0} y={0} width={W} height={H} fill="url(#sea2)" />
    </Svg>
  );
}

export const MapBase = memo(MapBaseImpl);
