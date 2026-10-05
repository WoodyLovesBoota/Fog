/**
 * World space: 1 unit = 1 km, +x = east, +z = south, +y = up.
 * The origin sits near the middle of the main island.
 */
export const ORIGIN = { lat: 1.352, lng: 103.82 };

const KM_PER_DEG_LAT = 110.574;
const KM_PER_DEG_LNG = 111.32 * Math.cos((ORIGIN.lat * Math.PI) / 180);

/** The rectangle of world that is generated in detail. Open sea carries on beyond it. */
export const WORLD = {
  minX: -27,
  maxX: 33,
  minZ: -16,
  maxZ: 21,
  width: 60,
  depth: 37,
  centerX: 3,
  centerZ: 2.5,
} as const;

export function toWorld(lng: number, lat: number): [x: number, z: number] {
  return [(lng - ORIGIN.lng) * KM_PER_DEG_LNG, -(lat - ORIGIN.lat) * KM_PER_DEG_LAT];
}

/** `[lat, lng]` pairs (the order people read coordinates in) -> world `[x, z]`. */
export function latLngToWorld([lat, lng]: readonly [number, number]): [number, number] {
  return toWorld(lng, lat);
}
