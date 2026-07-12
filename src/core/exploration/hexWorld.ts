import { cellToBoundary, cellToParent } from 'h3-js';

/**
 * Geometry for the low-poly hex world (the map's replacement for the real
 * basemap + cloud fog). Land is drawn as a board of H3 tiles at the coarse
 * VISUAL resolution; each tile is extruded and colored by whether it's been
 * explored. Pure logic — no React Native, no map imports — so it lives in the
 * framework-free exploration core and is unit-testable.
 */

/** Per-feature flag read by the data-driven extrusion paint (color + height). */
export type HexProps = { explored: 0 | 1 };

/**
 * Shrink a ring toward its centroid so neighbouring tiles show a thin seam —
 * the classic "separated tiles" low-poly look. `factor` 1 = tiles touch,
 * 0.9 = a 10% gap. Operates on the OPEN boundary (no closing vertex) so the
 * centroid isn't skewed by a duplicated point.
 */
function insetRing(ring: number[][], factor: number): number[][] {
  if (factor >= 1) return ring;
  let cx = 0;
  let cy = 0;
  for (const [x, y] of ring) {
    cx += x;
    cy += y;
  }
  cx /= ring.length;
  cy /= ring.length;
  return ring.map(([x, y]) => [cx + (x - cx) * factor, cy + (y - cy) * factor]);
}

/**
 * The closed GeoJSON ring ([lng, lat]) for one hex tile, optionally inset.
 * h3's `cellToBoundary` returns an open ring; we inset then close it.
 */
export function hexRing(cellId: string, inset = 1): number[][] {
  const boundary = cellToBoundary(cellId, true); // [lng, lat], open ring
  const ring = insetRing(boundary, inset);
  ring.push(ring[0]); // close per GeoJSON
  return ring;
}

/**
 * Map the fine res-10 visited cells up to their VISUAL-resolution parents,
 * deduped. A coarse tile counts as "explored" the moment any res-10 cell inside
 * it is visited, so walking a single fine cell lights the whole board tile.
 */
export function visitedToVisualCells(
  visitedCells: string[],
  visualRes: number,
): string[] {
  const parents = new Set<string>();
  for (const id of visitedCells) parents.add(cellToParent(id, visualRes));
  return [...parents];
}
