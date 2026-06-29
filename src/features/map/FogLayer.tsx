import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';

import { colors } from '@/theme/tokens';
import { cellOrigin, type CellLayout, TOTAL_CELLS } from '@/features/map/grid';

// Cloud silhouette authored over a 72x80 box (a 56x64 cell + 8px bleed),
// taken verbatim from the prototype's clip-path.
const CLOUD =
  'M14,74 C4,74 1,62 8,55 C1,48 6,33 16,37 C17,20 32,16 38,28 C43,10 60,10 64,26 C75,22 79,40 70,48 C78,54 74,70 62,72 L62,74 Z';
const REF_CELL_W = 56;
const REF_CELL_H = 64;
const BLEED = 8;

type Props = {
  layout: CellLayout;
  width: number;
  height: number;
  isFogged: (id: number) => boolean;
  onTapCell: (id: number) => void;
};

/**
 * Renders a soft cloud over every still-fogged cell. Visuals live in one SVG
 * overlay (cheap, no per-cell views); a thin layer of transparent hit targets
 * sits on top so tapping a cloud uncovers that cell.
 */
function FogLayerImpl({ layout, width, height, isFogged, onTapCell }: Props) {
  const { cellW, cellH } = layout;
  const sx = cellW / REF_CELL_W;
  const sy = cellH / REF_CELL_H;

  const fogged: number[] = [];
  for (let id = 0; id < TOTAL_CELLS; id++) if (isFogged(id)) fogged.push(id);

  return (
    <View style={StyleSheet.absoluteFill}>
      <Svg width={width} height={height} pointerEvents="none" style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="fogfill" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={colors.fogGradient[0]} />
            <Stop offset="1" stopColor={colors.fogGradient[1]} />
          </LinearGradient>
        </Defs>
        {fogged.map((id) => {
          const o = cellOrigin(id, layout);
          const tx = o.x - BLEED * sx;
          const ty = o.y - BLEED * sy;
          return (
            <Path key={id} d={CLOUD} fill="url(#fogfill)" transform={`translate(${tx},${ty}) scale(${sx},${sy})`} />
          );
        })}
      </Svg>
      {fogged.map((id) => {
        const o = cellOrigin(id, layout);
        return (
          <Pressable
            key={id}
            onPress={() => onTapCell(id)}
            accessibilityRole="button"
            accessibilityLabel="Uncover area"
            style={[styles.hit, { left: o.x, top: o.y, width: cellW, height: cellH }]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  hit: { position: 'absolute' },
});

export const FogLayer = memo(FogLayerImpl);
