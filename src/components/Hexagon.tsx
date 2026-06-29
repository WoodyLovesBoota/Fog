import { memo } from 'react';
import Svg, { Polygon, Path, ClipPath, Defs, G } from 'react-native-svg';

import { colors } from '@/theme/tokens';

/** Vertical (pointy-top) hexagon, matching the prototype's clip-path polygon. */
function hexPoints(w: number, h: number): string {
  return [
    [0.5 * w, 0],
    [w, 0.25 * h],
    [w, 0.75 * h],
    [0.5 * w, h],
    [0, 0.75 * h],
    [0, 0.25 * h],
  ]
    .map((p) => p.join(','))
    .join(' ');
}

/** Build a pie wedge from 12 o'clock, sweeping clockwise by `pct`%. */
function wedgePath(cx: number, cy: number, r: number, pct: number): string {
  const frac = Math.max(0, Math.min(100, pct)) / 100;
  if (frac <= 0) return '';
  if (frac >= 1) {
    // Full circle as a square cover (clipped to the hexagon anyway).
    return `M${cx - r},${cy - r} H${cx + r} V${cy + r} H${cx - r} Z`;
  }
  const start = -Math.PI / 2; // top
  const end = start + frac * Math.PI * 2;
  const pts: string[] = [`M${cx},${cy}`];
  const steps = Math.max(2, Math.ceil(frac * 60));
  for (let i = 0; i <= steps; i++) {
    const a = start + (end - start) * (i / steps);
    pts.push(`L${cx + Math.cos(a) * r},${cy + Math.sin(a) * r}`);
  }
  pts.push('Z');
  return pts.join(' ');
}

type Props = {
  size: number; // width; height derived from ratio
  ratio?: number; // h/w (prototype badge 30/27, stats 214/196)
  pct: number;
  inset?: number; // donut thickness -> white inner hex
  fill?: string;
  track?: string;
  innerColor?: string;
};

/**
 * Donut-style hexagonal progress meter. A colored wedge sweeps around a
 * hexagon over a track color, with an inner hexagon punched out to leave a ring.
 */
function HexagonBase({
  size,
  ratio = 1,
  pct,
  inset = 0,
  fill = colors.hexFill,
  track = colors.hexTrack,
  innerColor = colors.white,
}: Props) {
  const w = size;
  const h = size * ratio;
  const cx = w / 2;
  const cy = h / 2;
  const r = Math.max(w, h);
  const clipId = `hexclip-${w}-${h}`;

  return (
    <Svg width={w} height={h}>
      <Defs>
        <ClipPath id={clipId}>
          <Polygon points={hexPoints(w, h)} />
        </ClipPath>
      </Defs>
      <G clipPath={`url(#${clipId})`}>
        <Polygon points={hexPoints(w, h)} fill={track} />
        {pct > 0 ? <Path d={wedgePath(cx, cy, r, pct)} fill={fill} /> : null}
      </G>
      {inset > 0 ? (
        <G transform={`translate(${inset},${inset})`}>
          <Polygon points={hexPoints(w - inset * 2, h - inset * 2)} fill={innerColor} />
        </G>
      ) : null}
    </Svg>
  );
}

/** A flat, solid hexagon tile (used as stat-row icon backings). */
export function HexTile({
  size,
  ratio = 1,
  color,
}: {
  size: number;
  ratio?: number;
  color: string;
}) {
  const w = size;
  const h = size * ratio;
  return (
    <Svg width={w} height={h}>
      <Polygon points={hexPoints(w, h)} fill={color} />
    </Svg>
  );
}

export const Hexagon = memo(HexagonBase);
