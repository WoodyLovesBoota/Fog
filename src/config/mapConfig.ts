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
 * Dark style fits the "fog" mood. If the key is missing the URL still forms,
 * but tile requests will 401 — the download gate surfaces that as an error.
 */
export const MAP_STYLE_URL =
  `https://tiles.stadiamaps.com/styles/alidade_smooth_dark.json?api_key=${STADIA_API_KEY}`;

/** Singapore, roughly centered. MapLibre/GeoJSON order is [lng, lat]. */
export const SINGAPORE_CENTER: [number, number] = [103.8198, 1.3521];

/** Offline download box — south-west and north-east corners, [lng, lat]. */
export const SG_BOUNDS_SW: [number, number] = [103.59, 1.16];
export const SG_BOUNDS_NE: [number, number] = [104.09, 1.47];

/**
 * Download zoom range. Raising maxZoom multiplies pack size fast (16 is ~2–4×
 * of 15). 15 gives street-level detail; drop to 14 if the pack feels heavy.
 */
export const OFFLINE_MIN_ZOOM = 8;
export const OFFLINE_MAX_ZOOM = 15;

/** Pack name + the key under which we record "download already finished". */
export const OFFLINE_PACK_KEY = 'singapore_v1';
