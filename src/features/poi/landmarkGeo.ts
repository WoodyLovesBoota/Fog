import { CATEGORY_META, type Landmark } from '@/features/poi/landmarks';

/**
 * Pure presentation helpers for landmarks (color + glyph resolution).
 * No React / map imports here. Beacons themselves render as native `<Marker>`s
 * (see `LandmarkPin`), so there's no GeoJSON conversion anymore.
 */

/** Resolve a landmark's display color (category default). */
export function beaconColor(l: Landmark): string {
  return CATEGORY_META[l.category].color;
}

/** Resolve a landmark's glyph (own emoji or category fallback). */
export function beaconEmoji(l: Landmark): string {
  return l.emoji ?? CATEGORY_META[l.category].emoji;
}
