/**
 * Build-time generator for the LOW-POLY TERRAIN of Singapore.
 *
 * Recreates the whole island as a faceted low-poly mesh with REAL geography:
 *   1. Simplify the coastline polygon (Douglas-Peucker) → chunky low-poly coast,
 *      then densify long edges so triangles hug the shore evenly.
 *   2. Inject the outlines of major OSM landuse polygons (reservoirs, parks,
 *      forests, the airport — from the committed cache scripts/osm_landuse.geojson,
 *      see fetchOsmLanduse.mjs) as extra triangulation points, so facet edges
 *      follow real boundaries instead of slicing across them.
 *   3. Scatter a jittered hex grid of interior points and Delaunay-triangulate
 *      (delaunator); keep triangles whose centroid falls on land.
 *   4. Sample REAL elevation (AWS Open Data terrarium tiles — SRTM-derived,
 *      free, no API key) at every vertex.
 *   5. Classify each triangle by landuse (water > aerodrome > green > urban)
 *      and bake its color: class palette × elevation band × flat-shading from
 *      the triangle normal (fixed light) × a little seeded jitter — the classic
 *      low-poly look, precomputed so the app does zero work.
 *
 * Output: src/data/lowPolyTerrain.ts — compact flat arrays (verts, tri indices,
 * per-tri color + extrusion height). The app rebuilds GeoJSON at load.
 *
 * Plain Node ESM (no tsx needed):  npm run build:terrain
 * Requires network for the elevation tiles; the land polygon and landuse cache
 * are local files (run `npm run fetch:landuse` once if the cache is missing).
 */
import { Buffer } from 'node:buffer';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import Delaunator from 'delaunator';
import pngjs from 'pngjs';

import {
  M_PER_DEG_LAT,
  densify,
  inAnyPolygon,
  inPolygon,
  mPerDegLng,
  mulberry32,
  normalize3,
  ringAreaKm2,
  ringBbox,
  simplify,
} from './geoUtils.mjs';

const { PNG } = pngjs;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---- Tunables ---------------------------------------------------------------
const SIMPLIFY_TOL_DEG = 0.0012; // ~130m — coastline chunkiness
const MIN_ISLAND_KM2 = 0.15; // drop islets smaller than this
const BOUNDARY_MAX_SEG_M = 450; // densify coast edges to at most this
const INTERIOR_SPACING_M = 680; // hex-grid spacing for interior points
const ELEV_ZOOM = 11; // terrarium tile zoom (~76m/px)
/**
 * SRTM is a surface model: downtown towers and port cranes read as 200-400m
 * "hills". Singapore's real summit is Bukit Timah (164m), so anything above
 * this is a building artifact — clamp it to keep the mesh terrain-true.
 */
const MAX_ELEV_M = 170;
const ELEV_EXAGGERATION = 11; // Singapore is subtle; pump it for the look
const BASE_HEIGHT_M = 30; // land sits on a slab above the sea
const COORD_DECIMALS = 5; // ~1.1m — plenty for a low-poly mesh

// Landuse constraint injection: only outlines of features this big get their
// own triangulation points (smaller ones still color facets, just fuzzier).
const CONSTRAINT_MIN_KM2 = 0.3;
const CONSTRAINT_MAX_KM2 = 60; // skip anything sea-sized (bbox-clipped areas)
const CONSTRAINT_TOL_DEG = 0.00055; // ~60m — re-simplify outlines for injection
const CONSTRAINT_MAX_SEG_M = 350;

/** Inland water sits recessed below the land slab, dead flat. */
const WATER_HEIGHT_M = 16;
const WATER_COLOR = '#69AEDD';

/** Elevation bands (meters, REAL not exaggerated) → top color, per class. */
const GREEN_BANDS = [
  [8, '#ACD48F'],
  [20, '#93C77B'],
  [45, '#79B368'],
  [90, '#609F58'],
  [Infinity, '#4E8B4E'], // Bukit Timah tops
];
const URBAN_BANDS = [
  [2.5, '#E5D9AE'], // beach / freshly reclaimed coast
  [8, '#DCD6C9'],
  [25, '#D2CBBC'],
  [60, '#C6BFAE'],
  [Infinity, '#B9B1A0'],
];
const AERO_BANDS = [[Infinity, '#CDD1D6']]; // runways read as one flat tone

/** Fixed light for facet shading (x east, y north, z up), normalized below.
    Lower sun angle = stronger slope contrast = crisper low-poly facets. */
const LIGHT = normalize3([-0.55, 0.3, 0.72]);

const GEOJSON_PATH = path.join(__dirname, 'singapore_land.geojson');
const LANDUSE_PATH = path.join(__dirname, 'osm_landuse.geojson');
const OUT_PATH = path.join(__dirname, '..', 'src', 'data', 'lowPolyTerrain.ts');

// ---- Geometry: polygon plumbing ---------------------------------------------
function toPolygons(gj) {
  const out = [];
  const collect = (g) => {
    if (!g) return;
    if (g.type === 'Polygon') out.push(g.coordinates);
    else if (g.type === 'MultiPolygon') g.coordinates.forEach((p) => out.push(p));
    else if (g.type === 'Feature') collect(g.geometry);
    else if (g.type === 'FeatureCollection') g.features.forEach((f) => collect(f.geometry));
    else if (g.type === 'GeometryCollection') g.geometries.forEach(collect);
  };
  collect(gj);
  return out;
}

// ---- Elevation: terrarium tiles ----------------------------------------------
/** Web-mercator global pixel coords at ELEV_ZOOM. */
function lngToGx(lng) {
  return ((lng + 180) / 360) * 256 * 2 ** ELEV_ZOOM;
}
function latToGy(lat) {
  const s = Math.sin((lat * Math.PI) / 180);
  return (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * 256 * 2 ** ELEV_ZOOM;
}

async function fetchTile(tx, ty) {
  const url = `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${ELEV_ZOOM}/${tx}/${ty}.png`;
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return PNG.sync.read(Buffer.from(await res.arrayBuffer()));
    } catch (e) {
      if (attempt >= 3) throw new Error(`tile ${tx}/${ty}: ${e.message}`);
      await new Promise((r) => setTimeout(r, 500 * attempt));
    }
  }
}

/** Bilinear elevation sampler over a mosaic of decoded tiles. */
function makeElevSampler(tiles) {
  const px = (gx, gy) => {
    const tx = Math.floor(gx / 256);
    const ty = Math.floor(gy / 256);
    const png = tiles.get(`${tx}/${ty}`);
    if (!png) return 0; // outside the fetched window → treat as sea level
    const ix = Math.min(255, Math.max(0, Math.floor(gx - tx * 256)));
    const iy = Math.min(255, Math.max(0, Math.floor(gy - ty * 256)));
    const o = (iy * 256 + ix) * 4;
    // terrarium encoding: elevation = R*256 + G + B/256 - 32768
    return png.data[o] * 256 + png.data[o + 1] + png.data[o + 2] / 256 - 32768;
  };
  return (lng, lat) => {
    const gx = lngToGx(lng) - 0.5;
    const gy = latToGy(lat) - 0.5;
    const x0 = Math.floor(gx);
    const y0 = Math.floor(gy);
    const fx = gx - x0;
    const fy = gy - y0;
    return (
      px(x0, y0) * (1 - fx) * (1 - fy) +
      px(x0 + 1, y0) * fx * (1 - fy) +
      px(x0, y0 + 1) * (1 - fx) * fy +
      px(x0 + 1, y0 + 1) * fx * fy
    );
  };
}

// ---- Landuse classification ----------------------------------------------------
/**
 * Load the OSM cache into per-class polygon lists with precomputed bboxes for
 * a fast prefilter. Priority at query time: water > aero > green; anything
 * unclassified is urban (Singapore's honest default).
 */
function loadLanduse() {
  if (!fs.existsSync(LANDUSE_PATH)) {
    console.error(`Missing ${LANDUSE_PATH}. Run \`npm run fetch:landuse\` once first.`);
    process.exit(1);
  }
  const fc = JSON.parse(fs.readFileSync(LANDUSE_PATH, 'utf8'));
  const byClass = { water: [], aero: [], green: [] };
  for (const f of fc.features) {
    const cls = f.properties.class;
    if (!byClass[cls]) continue;
    const rings = f.geometry.coordinates;
    byClass[cls].push({ rings, bbox: ringBbox(rings[0]), areaKm2: f.properties.area_km2 });
  }
  return byClass;
}

function makeClassifier(landuse) {
  const hit = (x, y, list) => {
    for (const p of list) {
      const [w, s, e, n] = p.bbox;
      if (x < w || x > e || y < s || y > n) continue;
      if (inPolygon(x, y, p.rings)) return true;
    }
    return false;
  };
  return (x, y) => {
    if (hit(x, y, landuse.water)) return 'water';
    if (hit(x, y, landuse.aero)) return 'aero';
    if (hit(x, y, landuse.green)) return 'green';
    return 'urban';
  };
}

// ---- Color baking -------------------------------------------------------------
function hexToRgb(hex) {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
}
function rgbToHex([r, g, b]) {
  const c = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}
function bandColor(bands, elev) {
  for (const [top, color] of bands) if (elev < top) return color;
  return bands[bands.length - 1][1];
}

// ---- Main ---------------------------------------------------------------------
async function main() {
  if (!fs.existsSync(GEOJSON_PATH)) {
    console.error(`Missing ${GEOJSON_PATH}.`);
    process.exit(1);
  }
  const rand = mulberry32(42);
  const gj = JSON.parse(fs.readFileSync(GEOJSON_PATH, 'utf8'));
  const landuse = loadLanduse();
  const classify = makeClassifier(landuse);

  // 1. Simplify + densify every coast ring; drop islets. Rings kept OPEN.
  const polys = [];
  for (const rings of toPolygons(gj)) {
    const outerClosed = rings[0];
    if (ringAreaKm2(outerClosed) < MIN_ISLAND_KM2) continue;
    const processed = [];
    for (let r = 0; r < rings.length; r++) {
      const open = rings[r].slice(0, -1);
      const simp = simplify(open, SIMPLIFY_TOL_DEG);
      if (simp.length < 3) continue;
      if (r > 0 && ringAreaKm2(simp) < 0.05) continue; // tiny hole
      processed.push(densify(simp, BOUNDARY_MAX_SEG_M));
    }
    if (processed.length) polys.push(processed);
  }

  // 2. Point cloud: coast points + landuse outlines + jittered interior grid.
  const points = [];
  for (const rings of polys) for (const ring of rings) points.push(...ring);
  const coastCount = points.length;

  // Landuse constraint points — facet edges follow reservoir/park/airport
  // boundaries instead of slicing across them. Offshore vertices (river mouths,
  // coastal parks poking past the simplified coast) are filtered out.
  let constraintCount = 0;
  for (const list of Object.values(landuse)) {
    for (const p of list) {
      if (p.areaKm2 < CONSTRAINT_MIN_KM2 || p.areaKm2 > CONSTRAINT_MAX_KM2) continue;
      for (const ringClosed of p.rings) {
        const open = ringClosed.slice(0, -1);
        if (open.length < 3 || ringAreaKm2(open) < CONSTRAINT_MIN_KM2 / 3) continue;
        const outline = densify(simplify(open, CONSTRAINT_TOL_DEG), CONSTRAINT_MAX_SEG_M);
        for (const [x, y] of outline) {
          if (inAnyPolygon(x, y, polys)) {
            points.push([x, y]);
            constraintCount++;
          }
        }
      }
    }
  }

  let west = Infinity, south = Infinity, east = -Infinity, north = -Infinity;
  for (const [x, y] of points) {
    if (x < west) west = x;
    if (x > east) east = x;
    if (y < south) south = y;
    if (y > north) north = y;
  }
  const dLat = INTERIOR_SPACING_M / M_PER_DEG_LAT;
  const dLng = INTERIOR_SPACING_M / mPerDegLng((south + north) / 2);
  let row = 0;
  for (let lat = south + dLat / 2; lat < north; lat += dLat * 0.866, row++) {
    for (let lng = west + (row % 2 ? dLng / 2 : 0); lng < east; lng += dLng) {
      const jx = lng + (rand() - 0.5) * dLng * 0.5;
      const jy = lat + (rand() - 0.5) * dLat * 0.5;
      if (inAnyPolygon(jx, jy, polys)) points.push([jx, jy]);
    }
  }
  console.log(
    `points: ${points.length} (${coastCount} coast, ${constraintCount} landuse outline)`,
  );

  // 3. Delaunay; keep land triangles (centroid test) and classify them.
  const del = Delaunator.from(points);
  const tris = [];
  const triClass = [];
  const classCount = { water: 0, aero: 0, green: 0, urban: 0 };
  for (let t = 0; t < del.triangles.length; t += 3) {
    const [a, b, c] = [del.triangles[t], del.triangles[t + 1], del.triangles[t + 2]];
    const cx = (points[a][0] + points[b][0] + points[c][0]) / 3;
    const cy = (points[a][1] + points[b][1] + points[c][1]) / 3;
    if (!inAnyPolygon(cx, cy, polys)) continue;
    tris.push([a, b, c]);
    const cls = classify(cx, cy);
    triClass.push(cls);
    classCount[cls]++;
  }
  console.log(`triangles on land: ${tris.length} / ${del.triangles.length / 3}`, classCount);

  // 4. Real elevation at every vertex.
  const margin = 0.02;
  const txMin = Math.floor(lngToGx(west - margin) / 256);
  const txMax = Math.floor(lngToGx(east + margin) / 256);
  const tyMin = Math.floor(latToGy(north + margin) / 256);
  const tyMax = Math.floor(latToGy(south - margin) / 256);
  const tiles = new Map();
  const jobs = [];
  for (let tx = txMin; tx <= txMax; tx++) {
    for (let ty = tyMin; ty <= tyMax; ty++) {
      jobs.push(fetchTile(tx, ty).then((png) => tiles.set(`${tx}/${ty}`, png)));
    }
  }
  await Promise.all(jobs);
  console.log(`elevation tiles: ${tiles.size} (z${ELEV_ZOOM})`);
  const elevAt = makeElevSampler(tiles);
  const elev = points.map(([x, y]) => Math.min(MAX_ELEV_M, Math.max(0, elevAt(x, y))));
  console.log(`elevation range: 0..${Math.max(...elev).toFixed(1)}m`);

  // 5. Bake per-triangle color (class palette × band × shading × jitter) + height.
  const shadeRand = mulberry32(1337);
  const colors = [];
  const heights = [];
  for (let i = 0; i < tris.length; i++) {
    const [a, b, c] = tris[i];
    const cls = triClass[i];
    const eMean = (elev[a] + elev[b] + elev[c]) / 3;

    if (cls === 'water') {
      // Dead-flat recessed lake: no lambert (SRTM under water is noise) and
      // only a whisper of jitter so adjacent facets don't band visibly.
      heights.push(WATER_HEIGHT_M);
      const s = 0.98 + shadeRand() * 0.04;
      colors.push(rgbToHex(hexToRgb(WATER_COLOR).map((v) => v * s)));
      continue;
    }

    heights.push(Math.round(BASE_HEIGHT_M + eMean * ELEV_EXAGGERATION));
    // Facet normal in local meters (z uses the same exaggeration → visible slopes).
    const k = mPerDegLng(points[a][1]);
    const v1 = [
      (points[b][0] - points[a][0]) * k,
      (points[b][1] - points[a][1]) * M_PER_DEG_LAT,
      (elev[b] - elev[a]) * ELEV_EXAGGERATION,
    ];
    const v2 = [
      (points[c][0] - points[a][0]) * k,
      (points[c][1] - points[a][1]) * M_PER_DEG_LAT,
      (elev[c] - elev[a]) * ELEV_EXAGGERATION,
    ];
    let n = [
      v1[1] * v2[2] - v1[2] * v2[1],
      v1[2] * v2[0] - v1[0] * v2[2],
      v1[0] * v2[1] - v1[1] * v2[0],
    ];
    if (n[2] < 0) n = [-n[0], -n[1], -n[2]];
    n = normalize3(n);
    const lambert = Math.max(0, n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2]);
    const shade = (0.68 + 0.42 * lambert) * (0.97 + shadeRand() * 0.06);
    const bands = cls === 'green' ? GREEN_BANDS : cls === 'aero' ? AERO_BANDS : URBAN_BANDS;
    colors.push(rgbToHex(hexToRgb(bandColor(bands, eMean)).map((v) => v * shade)));
  }

  // 6. Emit compact arrays. Only vertices referenced by kept triangles.
  const used = new Map(); // old index → new index
  for (const tri of tris) for (const i of tri) if (!used.has(i)) used.set(i, used.size);
  const verts = new Array(used.size * 2);
  for (const [oldI, newI] of used) {
    verts[newI * 2] = +points[oldI][0].toFixed(COORD_DECIMALS);
    verts[newI * 2 + 1] = +points[oldI][1].toFixed(COORD_DECIMALS);
  }
  const triIdx = tris.flatMap(([a, b, c]) => [used.get(a), used.get(b), used.get(c)]);

  const banner =
    `// AUTO-GENERATED by scripts/buildLowPolyTerrain.mjs — do not edit by hand.\n` +
    `// Low-poly Singapore terrain: real SRTM elevation (AWS terrarium z${ELEV_ZOOM}) +\n` +
    `// OSM landuse classes (water/green/aero/urban, scripts/osm_landuse.geojson).\n` +
    `// ${tris.length} triangles, exaggeration ×${ELEV_EXAGGERATION}, base ${BASE_HEIGHT_M}m. Colors pre-shaded.\n`;
  const body =
    `/** Flat [lng0, lat0, lng1, lat1, …] vertex coordinates. */\n` +
    `export const TERRAIN_VERTS: readonly number[] = ${JSON.stringify(verts)};\n` +
    `/** Flat [a0, b0, c0, a1, b1, c1, …] vertex indices, one triple per triangle. */\n` +
    `export const TERRAIN_TRIS: readonly number[] = ${JSON.stringify(triIdx)};\n` +
    `/** Per-triangle baked fill color (landuse class × band × facet shading). */\n` +
    `export const TERRAIN_COLORS: readonly string[] = ${JSON.stringify(colors)};\n` +
    `/** Per-triangle extrusion height in meters (exaggerated, slab included). */\n` +
    `export const TERRAIN_HEIGHTS: readonly number[] = ${JSON.stringify(heights)};\n`;
  fs.writeFileSync(OUT_PATH, banner + body);
  const kb = (fs.statSync(OUT_PATH).size / 1024).toFixed(0);
  console.log(`wrote ${path.relative(process.cwd(), OUT_PATH)} (${kb} KB)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
