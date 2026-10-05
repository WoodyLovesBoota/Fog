import type { Ref } from 'react';

import type { Landmark } from '@/features/poi/landmarks';

/**
 * The seam between the map screen and whatever draws the map.
 *
 * The screen owns all exploration state (visited cells, collected landmarks,
 * tracking, sheets); a surface only paints it and reports taps. Two surfaces
 * implement this: `MapLibreSurface` (street tiles) and `DioramaSurface` (the
 * hand-built 3D island). Which one runs is `MAP_RENDERER` in `mapConfig`.
 */

export type LatLng = { lat: number; lng: number };

/** Camera commands. Each surface picks its own "close enough to walk by" zoom. */
export type MapSurfaceHandle = {
  /** Cut straight to a position. */
  jumpTo(center: LatLng): void;
  /** Glide to a position. */
  flyTo(center: LatLng, durationMs: number): void;
};

export type MapSurfaceProps = {
  ref?: Ref<MapSurfaceHandle>;
  /** Visited H3 cell ids — everywhere else stays under fog. */
  visitedCells: string[];
  /**
   * Landmarks allowed on the map: anchors + collected. Hidden landmarks are
   * filtered out by the screen, never by the surface (the no-spoiler rule).
   */
  pins: Landmark[];
  /** The landmark whose detail sheet is open, if any. */
  selectedId: string | null;
  /** A landmark was tapped — or, with `null`, the map around them was. */
  onSelectLandmark: (landmark: Landmark | null) => void;
  /** The surface can now take camera commands. */
  onReady: () => void;
};
