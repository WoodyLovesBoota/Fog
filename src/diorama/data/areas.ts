import { toWorld } from "@/diorama/lib/geo";
import raw from "./sg-areas.json";

/** A closed outline in world space. */
export type Ring = [x: number, z: number][];

export type Area = {
  name: string;
  /** Each polygon is its outer ring followed by any holes. */
  polygons: Ring[][];
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
};

/**
 * URA Master Plan 2019 planning areas (data.gov.sg, Singapore Open Data Licence).
 * Regenerate with `pnpm sync:areas`.
 */
export const AREAS: Area[] = (raw as { name: string; polygons: number[][][] }[]).map((area) => {
  const bounds = { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity };
  const polygons = area.polygons.map((rings) =>
    rings.map((flat) => {
      const ring: Ring = [];
      for (let i = 0; i < flat.length; i += 2) {
        const [x, z] = toWorld(flat[i], flat[i + 1]);
        bounds.minX = Math.min(bounds.minX, x);
        bounds.maxX = Math.max(bounds.maxX, x);
        bounds.minZ = Math.min(bounds.minZ, z);
        bounds.maxZ = Math.max(bounds.maxZ, z);
        ring.push([x, z]);
      }
      return ring;
    }),
  );
  return { name: area.name, polygons, bounds };
});

function inRing(ring: Ring, x: number, z: number): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, zi] = ring[i];
    const [xj, zj] = ring[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

/** The planning area containing world point (x, z), if any. */
export function areaAt(x: number, z: number): Area | null {
  for (const area of AREAS) {
    const b = area.bounds;
    if (x < b.minX || x > b.maxX || z < b.minZ || z > b.maxZ) continue;
    for (const rings of area.polygons) {
      // Even-odd across outer ring + holes.
      if (rings.reduce((inside, ring) => (inRing(ring, x, z) ? !inside : inside), false)) return area;
    }
  }
  return null;
}
