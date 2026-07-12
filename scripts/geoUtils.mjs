/**
 * Shared plain-JS geometry helpers for the build scripts
 * (buildLowPolyTerrain.mjs, fetchOsmLanduse.mjs). Planar approximations
 * throughout — perfectly fine at Singapore scale (~50km).
 */

export const M_PER_DEG_LAT = 110_540;
export const mPerDegLng = (lat) => 111_320 * Math.cos((lat * Math.PI) / 180);

export function normalize3(v) {
  const n = Math.hypot(v[0], v[1], v[2]);
  return [v[0] / n, v[1] / n, v[2] / n];
}

/** Deterministic PRNG so re-runs produce identical data (mulberry32). */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Shoelace area of a ring in km² (ring may be open or closed). */
export function ringAreaKm2(ring) {
  const lat0 = ring[0][1];
  const kx = mPerDegLng(lat0) / 1000;
  const ky = M_PER_DEG_LAT / 1000;
  let s = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[(i + 1) % ring.length];
    s += x1 * kx * (y2 * ky) - x2 * kx * (y1 * ky);
  }
  return Math.abs(s / 2);
}

/** Douglas-Peucker on an open ring (no closing duplicate). Tolerance in deg. */
export function simplify(points, tol) {
  if (points.length < 4) return points;
  const keep = new Array(points.length).fill(false);
  keep[0] = keep[points.length - 1] = true;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    let maxD = -1;
    let maxI = -1;
    const [ax, ay] = points[a];
    const [bx, by] = points[b];
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    for (let i = a + 1; i < b; i++) {
      const [px, py] = points[i];
      let d;
      if (len2 === 0) d = Math.hypot(px - ax, py - ay);
      else {
        const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
        d = Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
      }
      if (d > maxD) {
        maxD = d;
        maxI = i;
      }
    }
    if (maxD > tol) {
      keep[maxI] = true;
      stack.push([a, maxI], [maxI, b]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

/** Add points along edges longer than maxSeg meters. Input/output: open ring. */
export function densify(ring, maxSegM) {
  const out = [];
  for (let i = 0; i < ring.length; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[(i + 1) % ring.length];
    out.push([x1, y1]);
    const segM = Math.hypot((x2 - x1) * mPerDegLng(y1), (y2 - y1) * M_PER_DEG_LAT);
    const n = Math.floor(segM / maxSegM);
    for (let k = 1; k <= n; k++) {
      const t = k / (n + 1);
      out.push([x1 + (x2 - x1) * t, y1 + (y2 - y1) * t]);
    }
  }
  return out;
}

/** Ray-cast point-in-ring (ring may be open or closed). */
export function inRing(x, y, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/** Inside a polygon = inside the outer ring and not inside any hole ring. */
export function inPolygon(x, y, rings) {
  if (!inRing(x, y, rings[0])) return false;
  for (let h = 1; h < rings.length; h++) {
    if (inRing(x, y, rings[h])) return false;
  }
  return true;
}

/** Inside any of a list of polygons (each = [outer, ...holes])? */
export function inAnyPolygon(x, y, polys) {
  for (const rings of polys) if (inPolygon(x, y, rings)) return true;
  return false;
}

/** [west, south, east, north] bbox of a ring. */
export function ringBbox(ring) {
  let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
  for (const [x, y] of ring) {
    if (x < w) w = x;
    if (x > e) e = x;
    if (y < s) s = y;
    if (y > n) n = y;
  }
  return [w, s, e, n];
}
