import type { Feature, FeatureCollection, Point } from 'geojson';

import { CATEGORY_META, type Landmark } from '@/features/poi/landmarks';

/**
 * Pure helpers bridging the landmark list to the MapLibre GeoJSON source.
 * No React / map imports here.
 */

/** Feature properties carried into the map layers (paint/layout read these). */
export type BeaconProps = {
  id: string;
  name: string;
  category: Landmark['category'];
  color: string;
  emoji: string;
  /** Label MapLibre's text-field renders (emoji + name). */
  label: string;
};

/** Resolve a landmark's display color (category default). */
export function beaconColor(l: Landmark): string {
  return CATEGORY_META[l.category].color;
}

/** Resolve a landmark's glyph (own emoji or category fallback). */
export function beaconEmoji(l: Landmark): string {
  return l.emoji ?? CATEGORY_META[l.category].emoji;
}

/** Convert landmarks to a MapLibre-ready FeatureCollection of points. */
export function landmarksToGeoJSON(
  landmarks: Landmark[]
): FeatureCollection<Point, BeaconProps> {
  const features: Feature<Point, BeaconProps>[] = landmarks.map((l) => {
    const emoji = beaconEmoji(l);
    return {
      type: 'Feature',
      id: l.id,
      geometry: { type: 'Point', coordinates: [l.lng, l.lat] },
      properties: {
        id: l.id,
        name: l.name,
        category: l.category,
        color: beaconColor(l),
        emoji,
        label: `${emoji} ${l.name}`,
      },
    };
  });
  return { type: 'FeatureCollection', features };
}
