/**
 * One-time fetcher for OSM landuse polygons over Singapore.
 *
 * Queries the Overpass API for water bodies (reservoirs, rivers), green areas
 * (parks, nature reserves, forest, golf, cemeteries, military jungle) and
 * aerodromes, assembles way/relation geometry into polygons, classifies and
 * simplifies them, and writes a compact GeoJSON CACHE to
 * scripts/osm_landuse.geojson.
 *
 * That cache is what buildLowPolyTerrain.mjs reads — the terrain build itself
 * never talks to Overpass, so it's reproducible and works offline once this
 * has been run once. Re-run only when you want fresher OSM data:
 *
 *   npm run fetch:landuse
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { ringAreaKm2, simplify } from './geoUtils.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_PATH = path.join(__dirname, 'osm_landuse.geojson');

/** slightly larger than the land polygon so coastal features aren't clipped. */
const BBOX = '1.13,103.55,1.50,104.12'; // south,west,north,east (Overpass order)
const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];
const SIMPLIFY_TOL_DEG = 0.0004; // ~44m — these only drive ~50m-scale coloring
const MIN_AREA_KM2 = 0.02; // drop ponds/lawns smaller than this

/**
 * Tag → class. Checked in order; first match wins (a golf course inside a
 * water tag combo doesn't happen in practice). 'military' is included as green
 * deliberately: Singapore's military areas (Western Catchment, Tekong) are
 * jungle, and painting them urban-gray would look far more wrong.
 */
function classify(tags) {
  if (!tags) return null;
  if (tags.natural === 'water' || tags.landuse === 'reservoir') return 'water';
  if (tags.aeroway === 'aerodrome') return 'aero';
  if (['park', 'nature_reserve', 'golf_course', 'garden'].includes(tags.leisure)) return 'green';
  if (['forest', 'cemetery', 'military'].includes(tags.landuse)) return 'green';
  if (tags.natural === 'wood') return 'green';
  return null;
}

const QUERY = `
[out:json][timeout:180][bbox:${BBOX}];
(
  way["natural"="water"];
  relation["natural"="water"];
  way["landuse"="reservoir"];
  relation["landuse"="reservoir"];
  way["leisure"~"^(park|nature_reserve|golf_course|garden)$"];
  relation["leisure"~"^(park|nature_reserve|golf_course|garden)$"];
  way["landuse"~"^(forest|cemetery|military)$"];
  relation["landuse"~"^(forest|cemetery|military)$"];
  way["natural"="wood"];
  relation["natural"="wood"];
  way["aeroway"="aerodrome"];
  relation["aeroway"="aerodrome"];
);
out geom;
`;

async function fetchOverpass() {
  let lastErr;
  for (const url of ENDPOINTS) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        console.log(`querying ${url} (attempt ${attempt})…`);
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            // overpass-api.de rejects UA-less requests with 406.
            'User-Agent': 'fog-terrain-build-script/1.0',
          },
          body: `data=${encodeURIComponent(QUERY)}`,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
      } catch (e) {
        lastErr = e;
        console.warn(`  failed: ${e.message}`);
        await new Promise((r) => setTimeout(r, 2000 * attempt));
      }
    }
  }
  throw lastErr;
}

/** Overpass way geometry [{lat, lon}, …] → open ring [[lng, lat], …]. */
function toRing(geometry) {
  const ring = geometry.map((p) => [p.lon, p.lat]);
  const closed =
    ring.length > 1 &&
    ring[0][0] === ring[ring.length - 1][0] &&
    ring[0][1] === ring[ring.length - 1][1];
  return closed ? ring.slice(0, -1) : ring;
}

/**
 * Stitch a multipolygon relation's member ways (of one role) into closed
 * rings by joining segments at shared endpoints. Overpass emits identical
 * coordinates for shared nodes, so exact equality is the correct join test.
 * Unclosable leftovers (members clipped by the bbox) are dropped.
 */
function stitchRings(members) {
  const rings = [];
  const segments = [];
  for (const m of members) {
    if (!m.geometry || m.geometry.length < 2) continue;
    const pts = m.geometry.map((p) => [p.lon, p.lat]);
    const isClosed =
      pts.length > 3 &&
      pts[0][0] === pts[pts.length - 1][0] &&
      pts[0][1] === pts[pts.length - 1][1];
    if (isClosed) rings.push(pts.slice(0, -1));
    else segments.push(pts);
  }
  const key = ([x, y]) => `${x},${y}`;
  while (segments.length) {
    const chain = segments.pop();
    let extended = true;
    while (extended) {
      extended = false;
      const head = key(chain[0]);
      const tail = key(chain[chain.length - 1]);
      if (head === tail) break; // closed
      for (let i = 0; i < segments.length; i++) {
        const s = segments[i];
        const sHead = key(s[0]);
        const sTail = key(s[s.length - 1]);
        if (sHead === tail) chain.push(...s.slice(1));
        else if (sTail === tail) chain.push(...s.slice(0, -1).reverse());
        else if (sTail === head) chain.unshift(...s.slice(0, -1));
        else if (sHead === head) chain.unshift(...s.slice(1).reverse());
        else continue;
        segments.splice(i, 1);
        extended = true;
        break;
      }
    }
    if (chain.length > 3 && key(chain[0]) === key(chain[chain.length - 1])) {
      rings.push(chain.slice(0, -1));
    }
  }
  return rings;
}

function main(osm) {
  const features = [];
  let dropped = 0;

  const addPolygon = (cls, outer, holes = []) => {
    const area = ringAreaKm2(outer);
    if (area < MIN_AREA_KM2) {
      dropped++;
      return;
    }
    const rings = [outer, ...holes]
      .map((r) => simplify(r, SIMPLIFY_TOL_DEG))
      .filter((r) => r.length >= 3)
      // close each ring per GeoJSON
      .map((r) => [...r, r[0]]);
    if (!rings.length) return;
    features.push({
      type: 'Feature',
      properties: { class: cls, area_km2: +area.toFixed(3) },
      geometry: { type: 'Polygon', coordinates: rings },
    });
  };

  for (const el of osm.elements) {
    const cls = classify(el.tags);
    if (!cls) continue;
    if (el.type === 'way' && el.geometry) {
      const ring = toRing(el.geometry);
      if (ring.length >= 3) addPolygon(cls, ring);
    } else if (el.type === 'relation' && el.members) {
      const outers = stitchRings(el.members.filter((m) => m.role === 'outer'));
      const inners = stitchRings(el.members.filter((m) => m.role === 'inner'));
      for (const outer of outers) {
        // Assign each hole to the outer ring that contains its first vertex.
        const holes = inners.filter((h) => {
          const [x, y] = h[0];
          let inside = false;
          for (let i = 0, j = outer.length - 1; i < outer.length; j = i++) {
            const [xi, yi] = outer[i];
            const [xj, yj] = outer[j];
            if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
              inside = !inside;
            }
          }
          return inside;
        });
        addPolygon(cls, outer, holes);
      }
    }
  }

  const byClass = {};
  for (const f of features) byClass[f.properties.class] = (byClass[f.properties.class] ?? 0) + 1;
  // Round coordinates to 5 decimals (~1.1m) to keep the cache lean.
  const fc = JSON.parse(
    JSON.stringify({ type: 'FeatureCollection', features }, (k, v) =>
      typeof v === 'number' ? +v.toFixed(5) : v,
    ),
  );
  fs.writeFileSync(OUT_PATH, JSON.stringify(fc));
  const kb = (fs.statSync(OUT_PATH).size / 1024).toFixed(0);
  console.log(`kept ${features.length} polygons`, byClass, `(dropped ${dropped} tiny)`);
  console.log(`wrote ${path.relative(process.cwd(), OUT_PATH)} (${kb} KB)`);
}

const osm = await fetchOverpass();
console.log(`overpass returned ${osm.elements.length} elements`);
main(osm);
