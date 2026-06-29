import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, fonts } from '@/theme/tokens';
import { beaconColor } from '@/features/poi/landmarkGeo';
import type { Landmark } from '@/features/poi/landmarks';

/**
 * The visual for a single landmark beacon: a teardrop pin (category color, white
 * ring, white center dot) with the landmark name on a pill below it — matching
 * the design handoff. Rendered inside a MapLibre `<Marker>` (see `app/map.tsx`),
 * which keeps it pinned to the coordinate and always on top of the fog.
 *
 * Anchored at `top`, so the pin head sits on the coordinate and the name hangs
 * beneath it — exactly how the handoff positions it.
 */
function LandmarkPinImpl({ landmark }: { landmark: Landmark }) {
  return (
    <View style={styles.root}>
      <View style={[styles.pin, { backgroundColor: beaconColor(landmark) }]}>
        <View style={styles.dot} />
      </View>
      <View style={styles.label}>
        <Text style={styles.labelText} numberOfLines={1}>
          {landmark.name}
        </Text>
      </View>
    </View>
  );
}

export const LandmarkPin = memo(LandmarkPinImpl);

const styles = StyleSheet.create({
  root: { alignItems: 'center' },
  pin: {
    width: 30,
    height: 30,
    // teardrop: three round corners, one sharp — rotated so the sharp tip points down.
    borderTopLeftRadius: 15,
    borderTopRightRadius: 15,
    borderBottomRightRadius: 15,
    borderBottomLeftRadius: 0,
    transform: [{ rotate: '-45deg' }],
    borderWidth: 3,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#28285A',
    shadowOpacity: 0.3,
    shadowRadius: 9,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.white },
  label: {
    marginTop: 6,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 11,
    paddingVertical: 2,
    paddingHorizontal: 9,
    shadowColor: '#46508C',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  labelText: { fontFamily: fonts.bodyExtra, fontSize: 11, color: colors.ink },
});
