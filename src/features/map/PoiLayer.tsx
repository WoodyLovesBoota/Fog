import { memo } from 'react';
import { View, StyleSheet } from 'react-native';

import { colors } from '@/theme/tokens';
import { POIS } from '@/features/explore/data';
import { cellCenter, type CellLayout, COLS } from '@/features/map/grid';

/**
 * Decorative location pins (hawker centres, parks, the bay…) sitting on the
 * map beneath the fog, so uncovering an area reveals little landmarks.
 */
function PoiLayerImpl({ layout }: { layout: CellLayout }) {
  return (
    <>
      {POIS.map((poi) => {
        const id = poi.row * COLS + poi.col;
        const c = cellCenter(id, layout);
        const color = colors.poi[poi.color];
        return (
          <View
            key={poi.id}
            pointerEvents="none"
            style={[styles.pin, { left: c.x - 12, top: c.y - 18, backgroundColor: color }]}
          >
            <View style={styles.pinDot} />
          </View>
        );
      })}
    </>
  );
}

const styles = StyleSheet.create({
  pin: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
    borderBottomLeftRadius: 0,
    transform: [{ rotate: '-45deg' }],
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: colors.white,
    transform: [{ rotate: '45deg' }],
  },
});

export const PoiLayer = memo(PoiLayerImpl);
