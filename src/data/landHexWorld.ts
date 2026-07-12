import type { Feature, FeatureCollection, Polygon } from 'geojson';

import { hexRing, type HexProps } from '@/core/exploration/hexWorld';
import { LAND_HEX_CELLS } from '@/data/landHexCells';

/**
 * The static geometry of the low-poly hex world, built once at module load from
 * the precomputed land-cell id list (`landHexCells.ts`, see
 * `scripts/buildLandHexCells.ts`). Tile *shape* never changes — only each tile's
 * explored flag does — so we compute the ~870 rings a single time and, on every
 * visit, just re-stamp the `explored` property onto the shared geometry.
 */

/** Gap between neighbouring tiles: 1 = touching, 0.9 = 10% seam. Tunable. */
export const HEX_INSET = 0.92;

/** Precomputed { id, ring } for each land tile — the fixed board geometry. */
const BASE_TILES: { id: string; ring: number[][] }[] = LAND_HEX_CELLS.map(
  (id) => ({ id, ring: hexRing(id, HEX_INSET) }),
);

/** Set of all land tile ids — used to keep explored highlights on the board. */
export const LAND_HEX_IDS: ReadonlySet<string> = new Set(LAND_HEX_CELLS);

/**
 * The world as a GeoJSON FeatureCollection, each tile flagged `explored` 0/1
 * from the given set. Reuses the precomputed rings, so a rebuild is just ~870
 * tiny object allocations — cheap enough to run on each new visit.
 */
export function buildWorldFC(
  exploredCells: ReadonlySet<string>,
): FeatureCollection<Polygon, HexProps> {
  const features: Feature<Polygon, HexProps>[] = BASE_TILES.map((t) => ({
    type: 'Feature',
    properties: { explored: exploredCells.has(t.id) ? 1 : 0 },
    geometry: { type: 'Polygon', coordinates: [t.ring] },
  }));
  return { type: 'FeatureCollection', features };
}
