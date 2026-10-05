import { memo, useImperativeHandle, useMemo, useRef } from 'react';
import { StyleSheet } from 'react-native';
import {
  Camera,
  type CameraRef,
  GeoJSONSource,
  Images,
  Layer,
  Map as MapView,
  Marker,
  UserLocation,
} from '@maplibre/maplibre-react-native';

import { MAP_STYLE_URL, SINGAPORE_CENTER } from '@/config/mapConfig';
import { fogMask } from '@/core/exploration/cellGeometry';
import { LandmarkPin } from '@/features/map/LandmarkPin';
import type { MapSurfaceProps } from '@/features/map/MapSurface';
import type { Landmark } from '@/features/poi/landmarks';

/** Static initial camera — hoisted so its reference is stable across renders.
    A new object literal here would break <Camera>'s memo every render. */
const INITIAL_VIEW_STATE = { center: SINGAPORE_CENTER, zoom: 15 } as const;
/** Seamless cloud texture tiled across the fog mask (registered via <Images>). */
const CLOUD_TILE = require('../../../assets/cloud-tile.png');
const CLOUD_IMAGE_ID = 'fog-cloud';
/** Static fog paint — hoisted so MapLibre doesn't re-apply the style each render.
    `fill-pattern` paints the cloud texture instead of a flat color; the mask is
    still one feature, so the cloud cover costs nothing per unexplored cell. */
const FOG_PAINT = {
  'fill-pattern': CLOUD_IMAGE_ID,
  'fill-opacity': 0.7,
} as const;
const FOG_IMAGES = { [CLOUD_IMAGE_ID]: CLOUD_TILE } as const;

/** One landmark beacon on the map. Memoized so the frequent screen re-renders
    (toast flashes, tracking toggles, sheet opens) never touch the native
    markers: with a stable `onSelect`, every prop here is reference-equal
    across renders, so MapLibre re-syncs a marker only when the landmark set
    itself changes. The inline closure below is safe — it's inside the memo
    boundary, recreated only when this component actually re-renders. */
const PinMarker = memo(function PinMarker({
  landmark,
  onSelect,
}: {
  landmark: Landmark;
  onSelect: (lm: Landmark) => void;
}) {
  return (
    <Marker
      id={landmark.id}
      lngLat={[landmark.lng, landmark.lat]}
      anchor="top"
      onPress={() => onSelect(landmark)}
    >
      <LandmarkPin landmark={landmark} />
    </Marker>
  );
});

/**
 * Real geographic map: MapLibre + Stadia tiles, rendered from the offline pack
 * the screen downloads before mounting this.
 *
 * Fog-of-war: one big mask polygon always covers the whole region; each visited
 * H3 cell is punched out as a hole so the basemap shows through ("cloud
 * cleared"). Because the mask is a single feature, the fog never flickers or
 * "ends" as you pan/zoom — there's no viewport to recompute.
 */
export const MapLibreSurface = memo(function MapLibreSurface({
  ref,
  visitedCells,
  pins,
  onSelectLandmark,
  onReady,
}: MapSurfaceProps) {
  const cameraRef = useRef<CameraRef>(null);

  useImperativeHandle(
    ref,
    () => ({
      jumpTo: ({ lat, lng }) =>
        cameraRef.current?.jumpTo({ center: [lng, lat], zoom: 15 }),
      flyTo: ({ lat, lng }, duration) =>
        cameraRef.current?.flyTo({ center: [lng, lat], zoom: 16, duration }),
    }),
    []
  );

  // Fog mask: rebuilt only when a cell is visited. Always covers the map.
  const fogFC = useMemo(() => fogMask(visitedCells), [visitedCells]);

  return (
    <MapView
      style={styles.map}
      mapStyle={MAP_STYLE_URL}
      attribution
      onDidFinishLoadingMap={onReady}
    >
      <Camera ref={cameraRef} initialViewState={INITIAL_VIEW_STATE} />
      <UserLocation />

      {/* Register the seamless cloud texture used by the fog fill-pattern. */}
      <Images images={FOG_IMAGES} />

      {/* Fog-of-war: one mask polygon covers the whole region, painted with a
          tiled cloud texture; visited cells are punched out as holes, so the
          basemap shows through there. */}
      <GeoJSONSource id="fog-mask" data={fogFC}>
        <Layer id="fog-fill" type="fill" paint={FOG_PAINT} />
      </GeoJSONSource>

      {/* Landmark beacons — native Markers sit ON TOP of the fog and stay
          visible everywhere, names included. Anchored at the pin head; tapping
          one opens the detail sheet. */}
      {pins.map((lm) => (
        <PinMarker key={lm.id} landmark={lm} onSelect={onSelectLandmark} />
      ))}
    </MapView>
  );
});

const styles = StyleSheet.create({
  map: { flex: 1 },
});
