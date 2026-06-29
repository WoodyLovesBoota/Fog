import { memo, useMemo } from 'react';
import { GeoJSONSource, Layer } from '@maplibre/maplibre-react-native';

import { colors } from '@/theme/tokens';
import { landmarksToGeoJSON } from '@/features/poi/landmarkGeo';
import type { Landmark } from '@/features/poi/landmarks';

/**
 * Landmark beacons drawn on the map. Mount this BEFORE the fog mask in
 * `app/map.tsx` so the fog renders on top: beacons sit under the cloud and only
 * become visible where the fog has been punched out (visited cells) — exactly
 * like the basemap underneath.
 *
 * Three stacked layers per beacon: a soft colored halo, a white-ringed dot, and
 * a text label.
 */
function BeaconLayerImpl({ landmarks }: { landmarks: Landmark[] }) {
  const fc = useMemo(() => landmarksToGeoJSON(landmarks), [landmarks]);

  return (
    <GeoJSONSource id="landmark-beacons" data={fc}>
      <Layer
        id="beacon-halo"
        type="circle"
        paint={{
          'circle-radius': 16,
          'circle-color': ['get', 'color'],
          'circle-opacity': 0.18,
        }}
      />
      <Layer
        id="beacon-dot"
        type="circle"
        paint={{
          'circle-radius': 6,
          'circle-color': ['get', 'color'],
          'circle-stroke-width': 2,
          'circle-stroke-color': colors.white,
        }}
      />
      <Layer
        id="beacon-label"
        type="symbol"
        layout={{
          'text-field': ['get', 'label'],
          'text-size': 12,
          'text-offset': [0, 1.2],
          'text-anchor': 'top',
          'text-optional': true,
          'text-allow-overlap': false,
        }}
        paint={{
          'text-color': colors.ink,
          'text-halo-color': colors.white,
          'text-halo-width': 1.6,
        }}
      />
    </GeoJSONSource>
  );
}

export const BeaconLayer = memo(BeaconLayerImpl);
