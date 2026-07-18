import type { StyleSpecification } from '@maplibre/maplibre-gl-style-spec';

/**
 * Map configuration — one place for the MapLibre style and the Singapore
 * offline-download geometry. Tile source is Stadia Maps (OSM-based, free tier,
 * offline caching allowed by their terms). No Mapbox/Google token is involved:
 * MapLibre v11 has no access-token concept at all.
 *
 * The API key must come from the environment (.env, never committed). The
 * `EXPO_PUBLIC_` prefix is what makes it readable from JS in an Expo build.
 */

export const STADIA_API_KEY = process.env.EXPO_PUBLIC_STADIA_KEY ?? '';

/**
 * Building footprint FILL toggle. Phase 2-4 retired the flat terracotta-roof
 * `building` fill layer: the clay building/house SPRITES (assets/props, see
 * PropSymbols) now stand in for structures, so the footprint dots would just
 * double up under them. Default `false` therefore drops the `building` layer
 * from the parsed style. Flip to `true` to bring the footprint fill back for a
 * comparison screenshot — the layer stays in lowpoly.json purely so this switch
 * can revive it.
 */
export const BUILDINGS_FOOTPRINT_VISIBLE = false;

/**
 * The rendered style: a local fork of Stadia's alidade_smooth restyled into the
 * grass-board look (labels/POIs stripped, PALETTE colors, green landuse
 * patchwork, terracotta-roof buildings + light concrete roads — see
 * assets/mapstyle/lowpoly.json). The JSON ships with a
 * `{STADIA_API_KEY}` placeholder so the real key never lands in the repo; we
 * substitute it here, at require time, via one stringify→replace→parse pass.
 * When BUILDINGS_FOOTPRINT_VISIBLE is off (the Phase 2 default) we drop the
 * `building` layer from the parsed copy so the flag is a pure render toggle (the
 * JSON on disk is never mutated).
 */
const LOWPOLY_STYLE_JSON = require('../../assets/mapstyle/lowpoly.json') as StyleSpecification;

const SUBSTITUTED_STYLE: StyleSpecification = JSON.parse(
  JSON.stringify(LOWPOLY_STYLE_JSON).replaceAll('{STADIA_API_KEY}', STADIA_API_KEY),
);

export const LOWPOLY_MAP_STYLE: StyleSpecification = BUILDINGS_FOOTPRINT_VISIBLE
  ? SUBSTITUTED_STYLE
  : {
      ...SUBSTITUTED_STYLE,
      layers: SUBSTITUTED_STYLE.layers.filter((layer) => layer.id !== 'building'),
    };

/**
 * Style URL used ONLY for the offline pack download. The native OfflineManager
 * accepts a hosted style URL, not inline JSON — so we keep downloading against
 * the original alidade_smooth URL. That's fine because the local lowpoly style
 * reads the exact same vector-tile source (openmaptiles.json on Stadia): the
 * offline database caches resources by URL, so the pack's tiles serve the
 * custom style too, and the existing `singapore_v2` pack stays valid.
 */
export const PACK_STYLE_URL =
  `https://tiles.stadiamaps.com/styles/alidade_smooth.json?api_key=${STADIA_API_KEY}`;

/**
 * Default camera target: Singapore's CBD / Marina Bay (Downtown Core). This is
 * the view the map opens on — the CBD towers to the west, Marina Bay (MBS,
 * Merlion, ArtScience, Gardens) to the east — so the props + anchor landmarks
 * are in frame from the first paint, not off in an unexplored heartland. The
 * old geographic-centroid default (103.8198, 1.3521, ~Bishan) is kept below for
 * reference. MapLibre/GeoJSON order is [lng, lat].
 */
export const SINGAPORE_CENTER: [number, number] = [103.853, 1.2836];
/** Geographic centroid of the island (retired default — see SINGAPORE_CENTER). */
export const SINGAPORE_CENTROID: [number, number] = [103.8198, 1.3521];

/** Offline download box — south-west and north-east corners, [lng, lat]. */
export const SG_BOUNDS_SW: [number, number] = [103.59, 1.16];
export const SG_BOUNDS_NE: [number, number] = [104.09, 1.47];

/**
 * Download zoom range. Raising maxZoom multiplies pack size fast (16 is ~2–4×
 * of 15). 15 gives street-level detail; drop to 14 if the pack feels heavy.
 * The Camera may zoom PAST OFFLINE_MAX_ZOOM: vector tiles overscale, so z15
 * tiles keep rendering crisply at z16–17 fully offline. It must never zoom
 * BELOW CAMERA_MIN_ZOOM though — that's the miniature-framing floor.
 */
export const OFFLINE_MIN_ZOOM = 8;
export const OFFLINE_MAX_ZOOM = 15;

/**
 * Flat-board ("tilted game board") camera envelope. The whole art direction
 * depends on the framing: a few neighborhood blocks on a gently tilted board —
 * never a city-wide vista, never a horizon.
 *
 * - Default rest state: DEFAULT_ZOOM (15.5) at DEFAULT_PITCH (42°). Phase 1
 *   dropped the tilt from 55° to 42° — a board leaned toward you, not a 3D
 *   cityscape — so perspective distortion stays mild.
 * - Zooming out still lowers the tilt: pitch interpolates 42°→30° between
 *   PITCH_FULL_ZOOM and CAMERA_MIN_ZOOM. The ramp is what enforces the
 *   never-show-the-horizon rule Phase 1 keeps, so 42° is the rest tilt, not a
 *   hard constant — a wider view flattens toward top-down and distant terrain
 *   can never crawl into the frame.
 * - CAMERA_MIN_ZOOM = 13 hard-stops the zoom-out at "a district", not a city.
 */
export const CAMERA_MIN_ZOOM = 13;
export const CAMERA_MAX_ZOOM = 17;
export const DEFAULT_ZOOM = 15.5;
export const DEFAULT_PITCH = 42;
export const MIN_PITCH = 30;
/** Zoom at (and above) which the camera uses the full DEFAULT_PITCH tilt. */
export const PITCH_FULL_ZOOM = 15.5;

/** The pitch the miniature camera wants at a given zoom (clamped linear ramp). */
export function pitchForZoom(zoom: number): number {
  const t = (zoom - CAMERA_MIN_ZOOM) / (PITCH_FULL_ZOOM - CAMERA_MIN_ZOOM);
  const clamped = Math.min(1, Math.max(0, t));
  return MIN_PITCH + (DEFAULT_PITCH - MIN_PITCH) * clamped;
}

/** Pack name + the key under which we record "download already finished". */
export const OFFLINE_PACK_KEY = 'singapore_v2';
