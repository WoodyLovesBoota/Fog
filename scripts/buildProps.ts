/**
 * Phase 2-3 prop scatterer. Turns the cached OSM source polygons/lines
 * (scripts/osm/singapore_props_source.geojson, from build:osm-props) into three
 * bundled point layers the map renders as clay sprites:
 *
 *   assets/props/houses.json     — propKey "house"        (landuse residential)
 *   assets/props/buildings.json  — propKey "building"     (commercial/retail/industrial)
 *   assets/props/trees.json      — propKey "tree_round" | "tree_palm"
 *
 * (`.json`, not `.geojson`: Expo's Metro bundles only `.json` as an importable
 * object — a `.geojson` require would not parse. The content is still GeoJSON.)
 *
 * DETERMINISTIC: a fixed RNG seed ⇒ identical output every run, so the scatter
 * is stable across builds and reviewable in a diff. No Date/random-based state.
 *
 * PLACEMENT (spec 2-3):
 *   - min spacing:  house 120m · building 150m · trees 60m (residential-sparse 90m)
 *   - per-polygon cap:  house 12 · building 8 · trees 30 (residential-sparse 6)
 *   - exclude: within 15m of a road, within 100m of a landmark, inside water
 *   - palm: green/beach within 500m of coastline → palm; inland green mixes palm
 *     at 1:4 (20%) vs round; residential trees are round only
 *
 * Performance: 184k road linestrings make a naive per-point buffer test hopeless,
 * so roads and water are loaded into coarse grid spatial hashes; each candidate
 * only tests the handful of segments/polygons in its own cell + neighbours.
 *
 * Usage:  npm run build:props   (needs build:osm-props to have run first)
 */
import fs from "node:fs";
import path from "node:path";

const SRC = path.join(__dirname, "osm", "singapore_props_source.geojson");
const OUT_DIR = path.join(__dirname, "..", "assets", "props");

const SEED = 0x5eed_2317; // fixed — see "DETERMINISTIC" above
const OVERSAMPLE = 16; // random candidates generated per accepted slot

type LonLat = [number, number];
type Ring = LonLat[];

// ---------------------------------------------------------------- RNG --------
/** mulberry32 — tiny deterministic PRNG. Seeded once; no global random. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(SEED);

// ----------------------------------------------------------- geometry --------
const DEG = Math.PI / 180;
const M_PER_DEG_LAT = 111320;

/** Great-circle-ish metres between two lon/lat points (equirectangular). */
function distM(a: LonLat, b: LonLat): number {
  const mLat = ((a[1] + b[1]) / 2) * DEG;
  const dx = (b[0] - a[0]) * M_PER_DEG_LAT * Math.cos(mLat);
  const dy = (b[1] - a[1]) * M_PER_DEG_LAT;
  return Math.hypot(dx, dy);
}

/** Metres from point p to segment a–b (local flat projection around p). */
function distToSegM(p: LonLat, a: LonLat, b: LonLat): number {
  const kx = Math.cos(p[1] * DEG) * M_PER_DEG_LAT;
  const ky = M_PER_DEG_LAT;
  const ax = (a[0] - p[0]) * kx, ay = (a[1] - p[1]) * ky;
  const bx = (b[0] - p[0]) * kx, by = (b[1] - p[1]) * ky;
  const dx = bx - ax, dy = by - ay;
  const l2 = dx * dx + dy * dy;
  let t = l2 ? -(ax * dx + ay * dy) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(ax + t * dx, ay + t * dy);
}

/** Ray-cast point-in-ring (ring is lon/lat, not necessarily closed). */
function pointInRing(pt: LonLat, ring: Ring): boolean {
  let inside = false;
  const x = pt[0], y = pt[1];
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1];
    const xj = ring[j][0], yj = ring[j][1];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

type BBox = [number, number, number, number]; // minx,miny,maxx,maxy
function ringBBox(ring: Ring): BBox {
  let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
  for (const [x, y] of ring) {
    if (x < a) a = x;
    if (y < b) b = y;
    if (x > c) c = x;
    if (y > d) d = y;
  }
  return [a, b, c, d];
}

// ------------------------------------------------------- spatial hash --------
/** Grid bucket of segment endpoints for road / coastline buffer tests. */
class SegGrid {
  private cell: number;
  private map = new Map<string, LonLat[][]>();
  constructor(cell: number) {
    this.cell = cell;
  }
  private key(x: number, y: number) {
    return `${Math.floor(x / this.cell)},${Math.floor(y / this.cell)}`;
  }
  add(a: LonLat, b: LonLat) {
    // Insert into both endpoints' cells (segments are short vs the cell size).
    for (const p of [a, b]) {
      const k = this.key(p[0], p[1]);
      let arr = this.map.get(k);
      if (!arr) this.map.set(k, (arr = []));
      arr.push([a, b]);
    }
  }
  /** Min metres from p to any segment within its cell + 8 neighbours. */
  minDist(p: LonLat, cap: number): number {
    const cx = Math.floor(p[0] / this.cell);
    const cy = Math.floor(p[1] / this.cell);
    let best = Infinity;
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const arr = this.map.get(`${cx + dx},${cy + dy}`);
        if (!arr) continue;
        for (const [a, b] of arr) {
          const d = distToSegM(p, a, b);
          if (d < best) best = d;
          if (best <= cap) return best; // early out once inside the buffer
        }
      }
    }
    return best;
  }
}

/** Grid bucket of water polygons (by bbox) for point-in-water tests. */
class PolyGrid {
  private cell: number;
  private map = new Map<string, { ring: Ring; bbox: BBox }[]>();
  constructor(cell: number) {
    this.cell = cell;
  }
  add(ring: Ring) {
    const bbox = ringBBox(ring);
    const x0 = Math.floor(bbox[0] / this.cell), x1 = Math.floor(bbox[2] / this.cell);
    const y0 = Math.floor(bbox[1] / this.cell), y1 = Math.floor(bbox[3] / this.cell);
    for (let x = x0; x <= x1; x++) {
      for (let y = y0; y <= y1; y++) {
        const k = `${x},${y}`;
        let arr = this.map.get(k);
        if (!arr) this.map.set(k, (arr = []));
        arr.push({ ring, bbox });
      }
    }
  }
  contains(p: LonLat): boolean {
    const arr = this.map.get(`${Math.floor(p[0] / this.cell)},${Math.floor(p[1] / this.cell)}`);
    if (!arr) return false;
    for (const { ring, bbox } of arr) {
      if (p[0] < bbox[0] || p[0] > bbox[2] || p[1] < bbox[1] || p[1] > bbox[3]) continue;
      if (pointInRing(p, ring)) return true;
    }
    return false;
  }
}

// ------------------------------------------------------- landmark set --------
/** Landmark coords, parsed from landmarks.ts (can't import: it require()s webp). */
function loadLandmarks(): LonLat[] {
  const s = fs.readFileSync(
    path.join(__dirname, "..", "src", "features", "poi", "landmarks.ts"),
    "utf8",
  );
  const lat = [...s.matchAll(/\blat:\s*([-0-9.]+)/g)].map((m) => +m[1]);
  const lng = [...s.matchAll(/\blng:\s*([-0-9.]+)/g)].map((m) => +m[1]);
  return lat.map((la, i): LonLat => [lng[i], la]);
}

// ------------------------------------------------------------- config --------
interface ScatterCfg {
  spacingM: number;
  cap: number;
}
// Densities were roughly halved in spacing (and caps raised to match) once the
// renderer stopped collision-culling props: with culling on, the old 120m/150m/60m
// scatter looked far sparser on screen than it was on paper. These numbers are the
// density knob — halve spacing again for a busier board, at ~4× the point count.
const HOUSE: ScatterCfg = { spacingM: 70, cap: 25 };
const BUILDING: ScatterCfg = { spacingM: 90, cap: 18 };
const TREE: ScatterCfg = { spacingM: 35, cap: 60 };
const TREE_RESIDENTIAL: ScatterCfg = { spacingM: 55, cap: 14 };

// Props are ~30px on screen now, so they no longer swallow a lane at 8m from the
// centreline — a tighter buffer buys back the roadside strips.
const ROAD_BUFFER_M = 8;
const LANDMARK_RADIUS_M = 100;
const COAST_BUFFER_M = 500;
const INLAND_PALM_RATIO = 0.2; // 1 palm per 4 round inland

// --------------------------------------------------------- scattering --------
type Ctx = {
  roads: SegGrid;
  coast: SegGrid;
  water: PolyGrid;
  landmarks: LonLat[];
  lmGrid: SegGrid; // reuse SegGrid as a point grid (a=b) for landmark proximity
};

/** All hard exclusions shared by every prop. */
function excluded(p: LonLat, ctx: Ctx): boolean {
  if (ctx.water.contains(p)) return true;
  if (ctx.roads.minDist(p, ROAD_BUFFER_M) < ROAD_BUFFER_M) return true;
  if (ctx.lmGrid.minDist(p, LANDMARK_RADIUS_M) < LANDMARK_RADIUS_M) return true;
  return false;
}

/**
 * Scatter points inside one polygon: rejection-sample the bbox, keep points that
 * are in-ring, un-excluded, and ≥ spacing from already-accepted ones, up to cap.
 * `onAccept(pt)` tags each accepted point (e.g. palm vs round).
 */
function scatterPolygon(
  ring: Ring,
  cfg: ScatterCfg,
  ctx: Ctx,
  accepted: LonLat[],
  onAccept: (pt: LonLat) => void,
): void {
  const bbox = ringBBox(ring);
  const [minx, miny, maxx, maxy] = bbox;
  let kept = 0;
  const tries = cfg.cap * OVERSAMPLE;
  for (let i = 0; i < tries && kept < cfg.cap; i++) {
    const p: LonLat = [minx + rand() * (maxx - minx), miny + rand() * (maxy - miny)];
    if (!pointInRing(p, ring)) continue;
    if (excluded(p, ctx)) continue;
    let ok = true;
    for (const q of accepted) {
      if (distM(p, q) < cfg.spacingM) {
        ok = false;
        break;
      }
    }
    if (!ok) continue;
    accepted.push(p);
    onAccept(p);
    kept++;
  }
}

/** Is any sampled vertex of a ring within COAST_BUFFER_M of the coastline? */
function isCoastal(ring: Ring, coast: SegGrid): boolean {
  const step = Math.max(1, Math.floor(ring.length / 16));
  for (let i = 0; i < ring.length; i += step) {
    if (coast.minDist(ring[i], COAST_BUFFER_M) < COAST_BUFFER_M) return true;
  }
  return false;
}

// 5 decimals ≈ 1.1m — below the size of a prop sprite, and it keeps the bundled
// JSON ~20% smaller now that the point count is up.
const round5 = (n: number) => Math.round(n * 1e5) / 1e5;
function featurePoint(p: LonLat, propKey: string) {
  return {
    // `sortKey` (= -latitude) is baked in because symbol-sort-key can't read a
    // point's latitude from geometry via expression: southern (front) sprites
    // get the larger key and overdraw northern ones — depth order on the board.
    type: "Feature" as const,
    properties: { propKey, sortKey: round5(-p[1]) },
    geometry: { type: "Point" as const, coordinates: [round5(p[0]), round5(p[1])] },
  };
}

function main() {
  if (!fs.existsSync(SRC)) {
    console.error(`Missing ${SRC}. Run: npm run build:osm-props`);
    process.exit(1);
  }
  console.log("Loading source…");
  const src = JSON.parse(fs.readFileSync(SRC, "utf8")) as {
    features: {
      properties: { k: string };
      geometry: { type: string; coordinates: any };
    }[];
  };

  // Bucket source features by class.
  const residential: Ring[] = [];
  const commercial: Ring[] = [];
  const green: Ring[] = [];
  const beach: Ring[] = [];
  const roads = new SegGrid(0.0035);
  const coast = new SegGrid(0.005);
  const water = new PolyGrid(0.01);

  for (const f of src.features) {
    const k = f.properties.k;
    const g = f.geometry;
    if (g.type === "Polygon") {
      const ring = g.coordinates[0] as Ring;
      if (k === "residential") residential.push(ring);
      else if (k === "commercial") commercial.push(ring);
      else if (k === "green") green.push(ring);
      else if (k === "beach") beach.push(ring);
      else if (k === "water") water.add(ring);
    } else if (g.type === "LineString") {
      const line = g.coordinates as Ring;
      const grid = k === "road" ? roads : k === "coastline" ? coast : null;
      if (grid) for (let i = 1; i < line.length; i++) grid.add(line[i - 1], line[i]);
    }
  }

  const landmarks = loadLandmarks();
  const lmGrid = new SegGrid(0.01);
  for (const l of landmarks) lmGrid.add(l, l);

  const ctx: Ctx = { roads, coast, water, landmarks, lmGrid };
  console.log(
    `Source: ${residential.length} residential · ${commercial.length} commercial · ` +
      `${green.length} green · ${beach.length} beach · ${landmarks.length} landmarks`,
  );

  // --- houses ---------------------------------------------------------------
  const houses: any[] = [];
  for (const ring of residential) {
    scatterPolygon(ring, HOUSE, ctx, [], (p) => houses.push(featurePoint(p, "house")));
  }

  // --- buildings ------------------------------------------------------------
  const buildings: any[] = [];
  for (const ring of commercial) {
    scatterPolygon(ring, BUILDING, ctx, [], (p) => buildings.push(featurePoint(p, "building")));
  }

  // --- trees ----------------------------------------------------------------
  const trees: any[] = [];
  // Beach polygons → palm.
  for (const ring of beach) {
    scatterPolygon(ring, TREE, ctx, [], (p) => trees.push(featurePoint(p, "tree_palm")));
  }
  // Green polygons → coastal ones all palm; inland mostly round, 1:4 palm.
  for (const ring of green) {
    const coastal = isCoastal(ring, coast);
    scatterPolygon(ring, TREE, ctx, [], (p) => {
      const palm = coastal || rand() < INLAND_PALM_RATIO;
      trees.push(featurePoint(p, palm ? "tree_palm" : "tree_round"));
    });
  }
  // Residential → sparse round trees, alongside the houses.
  for (const ring of residential) {
    scatterPolygon(ring, TREE_RESIDENTIAL, ctx, [], (p) =>
      trees.push(featurePoint(p, "tree_round")),
    );
  }

  // --- write ----------------------------------------------------------------
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const write = (name: string, feats: any[]) => {
    const fc = { type: "FeatureCollection", features: feats };
    const p = path.join(OUT_DIR, name);
    fs.writeFileSync(p, JSON.stringify(fc));
    const kb = (fs.statSync(p).size / 1024).toFixed(0);
    console.log(`  ${name}: ${feats.length} points (${kb} KB)`);
  };
  console.log("Output:");
  write("houses.json", houses);
  write("buildings.json", buildings);
  write("trees.json", trees);

  const palm = trees.filter((t) => t.properties.propKey === "tree_palm").length;
  console.log(
    `\n✓ total ${houses.length + buildings.length + trees.length} props ` +
      `(${trees.length} trees: ${palm} palm / ${trees.length - palm} round) — seed ${SEED}`,
  );
}

main();
