import { cellToBoundary } from 'h3-js';
import type { Feature, FeatureCollection, Polygon } from 'geojson';

/**
 * Fog-of-war geometry as a single masking polygon: one big rectangle covering
 * the whole region, with each *visited* H3 cell punched out as a hole. Wherever
 * you haven't been stays under the mask (cloud); visited cells are holes, so the
 * basemap shows through ("cloud cleared").
 *
 * Why a holed polygon instead of per-cell hexagons: covering all of Singapore
 * with res-10 hexagons would be ~120k features. The mask is one feature whose
 * cost scales only with how many cells you've *visited* — and it always covers
 * the map no matter where you pan or how far you zoom out.
 *
 * Pure logic — no React Native, no map imports — so it stays inside the
 * framework-free exploration core and can be unit-tested in isolation.
 */
export type CellProps = { cellId: string };

/**
 * Outer mask rectangle, [lng, lat]. Generously larger than Singapore so the fog
 * never visibly "ends" at any pan/zoom the user can reach (offline pack tops out
 * at zoom 8, ~±10° here is far wider than any reachable viewport). Wound
 * counter-clockwise per GeoJSON's outer-ring convention.
 */
const MASK_BBOX = { west: 93.8, south: -8.6, east: 113.8, north: 11.4 };

function maskOuterRing(): number[][] {
  const { west, south, east, north } = MASK_BBOX;
  return [
    [west, south],
    [east, south],
    [east, north],
    [west, north],
    [west, south],
  ];
}

/**
 * Build the fog mask: outer rectangle + one hole per visited cell. A cell with
 * no visits yet yields a solid rectangle (everything fogged).
 */
export function fogMask(visitedCells: string[]): FeatureCollection<Polygon, CellProps> {
  const holes = visitedCells.map((id) => {
    // `true` = GeoJSON [lng, lat] order. The boundary ring is reversed so holes
    // wind clockwise (opposite the outer ring), matching the GeoJSON spec.
    const boundary = cellToBoundary(id, true);
    const ring = [...boundary, boundary[0]];
    ring.reverse();
    return ring;
  });

  const feature: Feature<Polygon, CellProps> = {
    type: 'Feature',
    properties: { cellId: '__fog_mask__' },
    geometry: { type: 'Polygon', coordinates: [maskOuterRing(), ...holes] },
  };

  return { type: 'FeatureCollection', features: [feature] };
}
