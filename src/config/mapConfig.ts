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
 * The rendered style: a local fork of Stadia's alidade_smooth restyled into the
 * pastel low-poly game look (labels/POIs stripped, PALETTE colors, extruded
 * buildings — see assets/mapstyle/lowpoly.json). The JSON ships with a
 * `{STADIA_API_KEY}` placeholder so the real key never lands in the repo; we
 * substitute it here, at require time, via one stringify→replace→parse pass.
 */
const LOWPOLY_STYLE_JSON = require('../../assets/mapstyle/lowpoly.json') as StyleSpecification;

export const LOWPOLY_MAP_STYLE: StyleSpecification = JSON.parse(
  JSON.stringify(LOWPOLY_STYLE_JSON).replaceAll('{STADIA_API_KEY}', STADIA_API_KEY),
);

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

/** Singapore, roughly centered. MapLibre/GeoJSON order is [lng, lat]. */
export const SINGAPORE_CENTER: [number, number] = [103.8198, 1.3521];

/** Offline download box — south-west and north-east corners, [lng, lat]. */
export const SG_BOUNDS_SW: [number, number] = [103.59, 1.16];
export const SG_BOUNDS_NE: [number, number] = [104.09, 1.47];

/**
 * Download zoom range. Raising maxZoom multiplies pack size fast (16 is ~2–4×
 * of 15). 15 gives street-level detail; drop to 14 if the pack feels heavy.
 * The Camera's min/maxZoom must stay in lockstep so the user can't outrun the
 * cached tiles.
 */
export const OFFLINE_MIN_ZOOM = 8;
export const OFFLINE_MAX_ZOOM = 15;

/** Pack name + the key under which we record "download already finished". */
export const OFFLINE_PACK_KEY = 'singapore_v2';
