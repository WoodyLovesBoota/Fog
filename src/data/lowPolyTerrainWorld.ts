import type { Feature, FeatureCollection, Polygon } from 'geojson';

import {
  TERRAIN_COLORS,
  TERRAIN_HEIGHTS,
  TERRAIN_TRIS,
  TERRAIN_VERTS,
} from '@/data/lowPolyTerrain';

/**
 * The low-poly Singapore terrain as render-ready GeoJSON, inflated once at
 * module load from the compact baked arrays (`lowPolyTerrain.ts`, see
 * `scripts/buildLowPolyTerrain.mjs`). Each triangle carries its pre-shaded
 * `color` and exaggerated extrusion height `h`, so the map's data-driven paint
 * just reads properties — no per-frame work, no runtime lighting.
 *
 * The mesh is static (real coastline + real SRTM elevation, colors baked at
 * build time), which is why this is a constant rather than a builder function.
 */
export type TerrainProps = { color: string; h: number };

function triFeature(t: number): Feature<Polygon, TerrainProps> {
  const ring: number[][] = [];
  for (let k = 0; k < 3; k++) {
    const v = TERRAIN_TRIS[t * 3 + k];
    ring.push([TERRAIN_VERTS[v * 2], TERRAIN_VERTS[v * 2 + 1]]);
  }
  ring.push(ring[0]); // close per GeoJSON
  return {
    type: 'Feature',
    properties: { color: TERRAIN_COLORS[t], h: TERRAIN_HEIGHTS[t] },
    geometry: { type: 'Polygon', coordinates: [ring] },
  };
}

export const TERRAIN_FC: FeatureCollection<Polygon, TerrainProps> = {
  type: 'FeatureCollection',
  features: Array.from({ length: TERRAIN_HEIGHTS.length }, (_, t) => triFeature(t)),
};
