/**
 * Phase 2 "props" tunables — tree/building SPRITE scattering over the low-poly
 * board. PRE-RECORDED in Phase 1.12: nothing here is wired to a renderer yet;
 * these are the agreed parameters so Phase 2 starts from a decision, not a blank
 * page. Keep this file framework-free (plain constants) like explorationConfig.
 *
 * WHY this exists (Phase 1.12 redirect): the map style no longer paints a darker
 * green for forest/wood/nature_reserve — those organic blobs bloated the frame
 * (see assets/mapstyle/lowpoly.json, Phase 1.12 note). "Forest" is now expressed
 * as a DENSITY of tree sprites, not a fill color. So a forest reads as "lots of
 * trees", and an empty-looking grass patch at Bukit Timah is EXPECTED until this
 * scatter fills it in.
 *
 * The polygons themselves still exist in the vector tiles even though we stopped
 * drawing their fills — Phase 2 must query the source geometry directly to know
 * WHERE to go dense:
 *   - FOREST tier  ← openmaptiles `park` source-layer (nature_reserve/national_park)
 *                    + `landcover` class=wood (natural=wood / landuse=forest).
 *   - PARK tier    ← openmaptiles `landcover` subclass=park (leisure=park), the
 *                    one green that KEEPS a grassDark fill.
 *
 * Sprite art lives in assets/basic/ (clay_tree_broadleaf.png, clay_tree_palm.png,
 * clay_house.png, clay_building.png).
 */

/** A tree-scatter tier: how tightly to pack sprites inside a class of polygon. */
export interface TreeScatterTier {
  /** Target grid spacing between scattered trees, in meters. Smaller = denser. */
  readonly spacingM: number;
  /** Hard cap on trees generated PER polygon, so a huge reserve can't explode. */
  readonly maxPerPolygon: number;
}

/**
 * Two density tiers (Phase 1.12 step 2). Forest goes ~3× denser than a manicured
 * park so the eye reads "woods vs a lawn with a few trees" — the whole point of
 * moving forest from "dark fill" to "many trees".
 */
export const TREE_SCATTER = {
  /**
   * Forest / wood / nature_reserve interiors — the areas whose dark fill was
   * retired in Phase 1.12. Dense on purpose: this is what now MAKES them read
   * as forest. 35m spacing, up to 60 trees per polygon.
   */
  forest: { spacingM: 35, maxPerPolygon: 60 } as TreeScatterTier,

  /**
   * Ordinary leisure parks (still grassDark-filled). Sparse, ornamental — a few
   * trees dotted on a lawn, NOT a canopy. 60m spacing, up to 30 trees.
   */
  park: { spacingM: 60, maxPerPolygon: 30 } as TreeScatterTier,
} as const;
