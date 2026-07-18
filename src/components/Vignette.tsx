import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

/**
 * Corner vignette laid over the map (Phase 1.13 clay-texture pass). A true
 * radial darkening: clear through the center, fading to a soft dusk-green only
 * as it reaches the four corners — so the diorama reads as a lit object with
 * its frame receding into shade, not a flat rectangle. Deliberately faint
 * ("있는지 모르게"): it must register as depth, never as a gray box.
 *
 * Not a MapLibre style layer — it's an RN overlay so it can't tint the tiles
 * themselves and stays independent of the offline style JSON. `pointerEvents
 * none` + absoluteFill lets every map gesture pass straight through; mounted
 * ABOVE <MapView> but BELOW the HUD/buttons so the chrome stays crisp.
 *
 * Radial geometry: cx/cy 50% (screen center), rx/ry 70%. With the default
 * objectBoundingBox units the corner sits at normalized radius ~1.0, so the
 * corners hit the full VIGNETTE_ALPHA while the edge-midpoints land ~half that
 * and the middle ~third of the frame stays perfectly clear.
 */
const VIGNETTE_RGB = '40,60,30'; // dusk green, matching the board's shade
const VIGNETTE_ALPHA = 0.18; // corner darkness — subtle on purpose

function VignetteBase() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id="fog-vignette" cx="50%" cy="50%" rx="70%" ry="70%">
            {/* Clear through the middle third of the frame… */}
            <Stop offset="0.45" stopColor={`rgb(${VIGNETTE_RGB})`} stopOpacity={0} />
            {/* …darkening only as it reaches the corners. */}
            <Stop offset="1" stopColor={`rgb(${VIGNETTE_RGB})`} stopOpacity={VIGNETTE_ALPHA} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#fog-vignette)" />
      </Svg>
    </View>
  );
}

/** Static overlay — never re-renders after mount (no props, no state). */
export const Vignette = memo(VignetteBase);
