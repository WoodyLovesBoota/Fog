import { COLS, ROWS } from '@/features/map/grid';

/**
 * Seed + demo data, ported from the prototype.
 *
 * `INITIAL_EXPLORED` is the small cluster already uncovered when a returning
 * user opens the map (so it never starts as a blank fog wall).
 * `DEMO_ROUTE` is the scripted walk the "Start walking" button plays back —
 * it stands in for a live GPS stream in Expo Go / simulators where the device
 * doesn't actually move.
 */
export const INITIAL_EXPLORED: number[] = [
  108, 107, 109, 100, 101, 116, 115, 117, 99, 92, 124, 123, 93,
];

export const DEMO_ROUTE: number[] = [
  100, 92, 93, 85, 77, 76, 68, 60, 61, 53, 45, 44, 36, 28, 29, 21, 13, 12, 20,
  84, 118, 110, 102, 94, 86, 78, 70, 69,
];

export const DEMO_START_CELL = 108;

/** Points of interest revealed beneath the fog (decorative map pins). */
export type PoiColor = 'orange' | 'green' | 'blue' | 'purple';
export type Poi = { id: string; col: number; row: number; color: PoiColor };
export const POIS: Poi[] = [
  { id: 'hawker', col: 2, row: 6, color: 'orange' },
  { id: 'park', col: 5, row: 5, color: 'green' },
  { id: 'bay', col: 3, row: 9, color: 'blue' },
  { id: 'temple', col: 2, row: 4, color: 'purple' },
  { id: 'mall', col: 6, row: 8, color: 'orange' },
];

/**
 * Singapore bounding box used to map a real GPS reading onto the fixed grid,
 * so live tracking colors plausible cells. (MVP: single city, fixed denominator.)
 */
export const SG_BOUNDS = {
  minLat: 1.235,
  maxLat: 1.475,
  minLng: 103.6,
  maxLng: 104.04,
};

/** Convert a geographic coordinate to a grid cell id (or null if out of bounds). */
export function geoToCell(lat: number, lng: number): number | null {
  const { minLat, maxLat, minLng, maxLng } = SG_BOUNDS;
  if (lat < minLat || lat > maxLat || lng < minLng || lng > maxLng) return null;
  const col = Math.min(COLS - 1, Math.floor(((lng - minLng) / (maxLng - minLng)) * COLS));
  // North (max lat) maps to the top row.
  const row = Math.min(ROWS - 1, Math.floor(((maxLat - lat) / (maxLat - minLat)) * ROWS));
  return row * COLS + col;
}
