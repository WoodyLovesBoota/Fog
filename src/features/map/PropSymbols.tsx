import { memo } from "react";
import {
  GeoJSONSource,
  type ImageEntry,
  Images,
  Layer,
  type SymbolLayerSpecification,
} from "@maplibre/maplibre-react-native";

/**
 * Phase 2-4 prop sprites: clay houses / buildings / trees scattered across the
 * board as MapLibre SymbolLayers. Positions are baked at build time by
 * scripts/buildProps.ts (seeded, deterministic) into assets/props/*.json — this
 * component just renders them; it never computes placement.
 *
 * THREE sources, drawn bottom-to-top TREES < HOUSES < BUILDINGS so a tall CBD
 * tower overdraws a house overdraws a tree in the same spot. The caller mounts
 * this BELOW the landmarks + fog, completing the Phase 2-4 stack:
 *   베이스맵 < 나무 < house < building < 랜드마크 < fog.
 *
 * Trees are ONE source; the tree layer's icon-image is data-driven off
 * `propKey` ("tree_round" | "tree_palm"), so broadleaf and palm ride the same
 * layer. Props are not tappable.
 */

// Sprite art — DOWNSCALED 256×256 icons (assets/basic/icons), NOT the 1920×1920
// originals in assets/basic, which overflowed MapLibre's icon atlas and rendered
// as torn streaks. Keys match the `propKey` values baked into the scatter
// features. Regenerate with: sips -Z 256 assets/basic/<f>.png --out assets/basic/icons/<f>.png
const PROP_IMAGES: Record<string, ImageEntry> = {
  house: require("../../../assets/basic/icons/clay_house.png"),
  building: require("../../../assets/basic/icons/clay_building.png"),
  tree_round: require("../../../assets/basic/icons/clay_tree_broadleaf.png"),
  tree_palm: require("../../../assets/basic/icons/clay_tree_palm.png"),
};

// Baked scatter point layers (GeoJSON FeatureCollections of Points).
const HOUSES = require("../../../assets/props/houses.json") as GeoJSON.FeatureCollection;
const BUILDINGS = require("../../../assets/props/buildings.json") as GeoJSON.FeatureCollection;
const TREES = require("../../../assets/props/trees.json") as GeoJSON.FeatureCollection;

/**
 * icon-size ZOOM ramps for the 256×256 icon art. Targets: house ~96px,
 * tree ~64px, building ~128px at mid-zoom. These stops are the on-device
 * calibration knob — nudge until the board matches the reference.
 *
 * Shared: icon-anchor 'bottom' (sprite stands on its point); icon-pitch/rotation
 * -alignment 'viewport' so each sprite is a BILLBOARD standing upright on the
 * 42°-pitched board (without it they lie flat on the ground and look vertically
 * squished); symbol-sort-key = -latitude (front sprites overdraw back).
 *
 * icon-allow-overlap / icon-ignore-placement are BOTH true, and that is load-
 * bearing, not a perf oversight. With collision on (the default), MapLibre runs
 * placement in SCREEN space every time the camera moves, so a different subset of
 * sprites wins each frame — trees and houses visibly jump around while panning.
 * Turning collision off makes every baked point draw at its own coordinate,
 * always: the scatter reads as a fixed world, and it also stops the board looking
 * artificially sparse (culled clusters were the "too spread out" symptom).
 * The perf levers are now the per-layer minzoom + the scatter caps in
 * scripts/buildProps.ts, NOT collision.
 */
const commonLayout: SymbolLayerSpecification["layout"] = {
  "icon-anchor": "bottom",
  "icon-pitch-alignment": "viewport",
  "icon-rotation-alignment": "viewport",
  "symbol-sort-key": ["get", "sortKey"],
  "icon-allow-overlap": true,
  "icon-ignore-placement": true,
};

/**
 * ONE minzoom for all three prop layers, so trees, houses and buildings pop in
 * and out together as a single diorama. They used to be staggered (building 13 ·
 * house 13.5 · tree 14), which meant buildings appeared alone on an empty board
 * for a zoom level before the rest caught up. 14 is the strictest of the old
 * three — it also keeps the most sprites off screen at low zoom, where the
 * viewport covers the most ground.
 */
const PROP_MINZOOM = 14;

// Sizes are relative to the 256px source art, so 0.10 ≈ 26 screen px. Roughly
// tree 26px / house 34px / building 48px at z16, doubling every 2 zoom levels so
// props grow with the board instead of swimming against it. Every ramp starts at
// PROP_MINZOOM so nothing is mid-interpolation at the moment it becomes visible.
const TREE_LAYOUT: SymbolLayerSpecification["layout"] = {
  ...commonLayout,
  "icon-image": ["get", "propKey"],
  "icon-size": ["interpolate", ["linear"], ["zoom"], 14, 0.05, 16, 0.1, 18, 0.2],
};
const HOUSE_LAYOUT: SymbolLayerSpecification["layout"] = {
  ...commonLayout,
  "icon-image": "house",
  "icon-size": ["interpolate", ["linear"], ["zoom"], 14, 0.065, 16, 0.13, 18, 0.26],
};
const BUILDING_LAYOUT: SymbolLayerSpecification["layout"] = {
  ...commonLayout,
  "icon-image": "building",
  "icon-size": ["interpolate", ["linear"], ["zoom"], 14, 0.095, 16, 0.19, 18, 0.38],
};

// One-time perf note (dev only): total sprite count on the board. If frames drop
// on device, raise the spacings/caps in scripts/buildProps.ts and re-run
// `npm run build:props` — every knob is there, not here.
if (__DEV__) {
  console.log(
    `[props] ${HOUSES.features.length} houses · ${BUILDINGS.features.length} buildings · ` +
      `${TREES.features.length} trees = ${
        HOUSES.features.length + BUILDINGS.features.length + TREES.features.length
      } sprites`,
  );
}

function PropSymbolsBase() {
  return (
    <>
      <Images images={PROP_IMAGES} />
      {/* All three share PROP_MINZOOM so the diorama fades in as one piece. */}
      <GeoJSONSource id="props-trees" data={TREES}>
        <Layer id="props-trees-layer" type="symbol" minzoom={PROP_MINZOOM} layout={TREE_LAYOUT} />
      </GeoJSONSource>
      <GeoJSONSource id="props-houses" data={HOUSES}>
        <Layer id="props-houses-layer" type="symbol" minzoom={PROP_MINZOOM} layout={HOUSE_LAYOUT} />
      </GeoJSONSource>
      {/* Buildings last = top of the props (a tower overdraws a house/tree). */}
      <GeoJSONSource id="props-buildings" data={BUILDINGS}>
        <Layer
          id="props-buildings-layer"
          type="symbol"
          minzoom={PROP_MINZOOM}
          layout={BUILDING_LAYOUT}
        />
      </GeoJSONSource>
    </>
  );
}

/** Static after mount — the scatter data never changes at runtime. */
export const PropSymbols = memo(PropSymbolsBase);
