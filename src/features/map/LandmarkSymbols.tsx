import { memo, useCallback, useMemo } from "react";
import type { NativeSyntheticEvent } from "react-native";
import {
  GeoJSONSource,
  type ImageEntry,
  Images,
  Layer,
  type SymbolLayerSpecification,
} from "@maplibre/maplibre-react-native";

import {
  LANDMARK_BY_ID,
  landmarkIconKey,
  landmarkTier,
  type Landmark,
} from "@/features/poi/landmarks";
import { LANDMARK_ICONS } from "@/features/poi/landmarkIcons";

/**
 * Landmark beacons as a MapLibre SymbolLayer (Phase 2-2), replacing the old
 * native `<Marker>` + `<LandmarkPin>` overlay. Each pin is now the landmark's
 * own webp — the very file the detail sheet shows as its hero photo — drawn as
 * a map icon, so the board reads as a labelled diorama rather than teardrop
 * pins.
 *
 * Icons come from {@link LANDMARK_ICONS} — DOWNSCALED 256×256 PNGs, NOT the
 * 1920×1920 hero webp in Landmark.image. The full-size webp overflowed
 * MapLibre's icon atlas and rendered as torn horizontal streaks; the sheet still
 * uses the original webp.
 *
 * NO-SPOILER, preserved: the source only ever contains `pins` (the anchors +
 * already-collected landmarks). The hidden 90 have neither a feature NOR a
 * registered image here, so their coordinate can't be read off the map until
 * they're physically discovered — exactly as the native-marker version guarded.
 *
 * Draw order is set by the CALLER: this is mounted BELOW the fog source (Phase
 * 2-4: 베이스맵 < … < 랜드마크 < fog), so a pin only surfaces once its area's fog
 * is cleared.
 *
 * Tap → `onSelect(landmark)`: the layer press bubbles the tapped feature, whose
 * `landmarkId` we resolve back to the record via {@link LANDMARK_BY_ID}.
 */

/** Shape-source press payload — the features hit under the tap. */
type SourcePress = NativeSyntheticEvent<{ features?: GeoJSON.Feature[] }>;

/**
 * SymbolLayer layout. icon-size is a ZOOM ramp for the 256×256 icon art:
 * 0.45→0.75 puts a marker at ROUGHLY 115–190px tall across z13–17. These three
 * stops are the on-device calibration knob — nudge them until the marquee sights
 * land at ~120–160px in a screenshot.
 *
 * - icon-anchor 'bottom': the coordinate sits at the icon's foot, so the marker
 *   "stands" on its spot.
 * - icon-pitch-alignment / icon-rotation-alignment 'viewport': the marker is a
 *   BILLBOARD — it stays upright, facing the screen, on the 42°-pitched board.
 *   Without this the icon lies flat on the tilted ground and foreshortens
 *   (looks vertically squished, ~cos42°≈0.74× tall).
 * - symbol-sort-key ['get','sortKey'] (= -latitude): southern (nearer-viewer)
 *   pins carry a larger key and overdraw northern ones on overlap.
 * - icon-allow-overlap false: markers hide on collision. (S-tier exemption is a
 *   later pass — every landmark is tier 'A' in the current draft, so there is no
 *   S to exempt yet.)
 */
const LANDMARK_LAYOUT: SymbolLayerSpecification["layout"] = {
  "icon-image": ["get", "iconKey"],
  "icon-anchor": "bottom",
  "icon-pitch-alignment": "viewport",
  "icon-rotation-alignment": "viewport",
  "icon-size": ["interpolate", ["linear"], ["zoom"], 13, 0.45, 15, 0.56, 17, 0.75],
  "symbol-sort-key": ["get", "sortKey"],
  "icon-allow-overlap": false,
};

function LandmarkSymbolsBase({
  pins,
  onSelect,
}: {
  pins: Landmark[];
  onSelect: (lm: Landmark) => void;
}) {
  // Register each visible landmark's 256px icon under its icon key. Only `pins`
  // get an image — the hidden 90 never do, so the no-spoiler rule holds at the
  // style level too. Rebuilt only when the visible set changes (collection grows).
  const images = useMemo(() => {
    const map: Record<string, ImageEntry> = {};
    for (const l of pins) {
      const key = landmarkIconKey(l);
      const icon = LANDMARK_ICONS[key];
      if (icon) map[key] = icon;
    }
    return map;
  }, [pins]);

  // One Point feature per visible landmark. `landmarkId` rides in properties for
  // the tap handler; `sortKey` (= -lat) drives overlap draw order.
  const data = useMemo<GeoJSON.FeatureCollection<GeoJSON.Point>>(
    () => ({
      type: "FeatureCollection",
      features: pins
        .filter((l) => LANDMARK_ICONS[landmarkIconKey(l)])
        .map((l) => ({
          type: "Feature",
          id: l.id,
          geometry: { type: "Point", coordinates: [l.lng, l.lat] },
          properties: {
            landmarkId: l.id,
            iconKey: landmarkIconKey(l),
            tier: landmarkTier(l),
            sortKey: -l.lat,
          },
        })),
    }),
    [pins],
  );

  const handlePress = useCallback(
    (e: SourcePress) => {
      const f = e.nativeEvent.features?.[0];
      const id = (f?.properties?.landmarkId ?? f?.id) as string | undefined;
      const lm = id ? LANDMARK_BY_ID.get(id) : undefined;
      if (lm) onSelect(lm);
    },
    [onSelect],
  );

  return (
    <>
      <Images images={images} />
      <GeoJSONSource id="landmarks-src" data={data} onPress={handlePress}>
        <Layer id="landmarks-symbols" type="symbol" layout={LANDMARK_LAYOUT} />
      </GeoJSONSource>
    </>
  );
}

/** Memoized: re-renders only when the visible pin set or handler changes. */
export const LandmarkSymbols = memo(LandmarkSymbolsBase);
