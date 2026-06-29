/**
 * Denominator for the "N% of Singapore explored" progress badge.
 *
 * ⚠️ APPROXIMATE for MVP. This value is an area-based estimate:
 *   Singapore land area (734.3 km², 2023) ÷ average res-10 H3 cell area
 *   (0.01505 km²) ≈ 48,799 cells.
 *
 * To replace it with the exact land-cell count, drop a Singapore land polygon
 * at `scripts/singapore_land.geojson` (Natural Earth admin-0 or OSM boundary)
 * and run `npm run build:land-cells`, which overwrites this file. The script's
 * H3 resolution MUST match H3_RESOLUTION in src/config/explorationConfig.ts
 * (currently 10) or the denominator will be wrong.
 */
export const TOTAL_LAND_CELLS = 48799;
