/**
 * Build-time OSM extractor for the Phase-2 prop scatter (scripts/buildProps.ts).
 *
 * The low-poly board no longer PAINTS landuse detail (Phase 1.12) — greenery,
 * housing and CBD density are expressed as scattered clay sprites instead. But
 * "where is residential / commercial / park / coast / road / water" lives only
 * inside the Stadia vector tiles, which can't be queried at build time. So we
 * pull the same polygons straight from OpenStreetMap via Overpass, once, and
 * cache them as a single tagged GeoJSON that buildProps.ts consumes.
 *
 * Output: scripts/osm/singapore_props_source.geojson — a FeatureCollection where
 * every feature carries `properties.k` (its class, see {@link Cls}). Raw
 * Overpass responses are cached per-class under scripts/osm/raw/ so re-runs are
 * free and a single flaky class can be re-fetched in isolation.
 *
 * Usage:  npm run build:osm-props   (add --force to bypass the raw cache)
 *
 * Data © OpenStreetMap contributors, ODbL.
 */
import fs from "node:fs";
import path from "node:path";

const OUT_DIR = path.join(__dirname, "osm");
const RAW_DIR = path.join(OUT_DIR, "raw");
const OUT = path.join(OUT_DIR, "singapore_props_source.geojson");

/** Singapore bbox as Overpass wants it: south,west,north,east. Matches SG_BOUNDS. */
const BBOX = "1.16,103.59,1.47,104.09";
const ENDPOINT = "https://overpass-api.de/api/interpreter";
const UA = "FogApp/1.0 props-build (https://github.com/WoodyLovesBoota/Fog)";
const FORCE = process.argv.includes("--force");

/** Prop-scatter source classes. */
type Cls =
  | "residential"
  | "commercial"
  | "green"
  | "beach"
  | "water"
  | "coastline"
  | "road";

/** Whether a class is areal (closed ways → polygons) or linear (ways → lines). */
const LINEAR: Record<Cls, boolean> = {
  residential: false,
  commercial: false,
  green: false,
  beach: false,
  water: false,
  coastline: true,
  road: true,
};

/** Overpass statement body per class (wrapped with out geom below). */
const QUERIES: Record<Cls, string> = {
  residential: `way["landuse"="residential"](${BBOX});`,
  commercial: `way["landuse"~"^(commercial|retail|industrial)$"](${BBOX});`,
  green: `(
    way["leisure"="park"](${BBOX});
    way["landuse"~"^(forest|grass|meadow|recreation_ground|village_green|cemetery)$"](${BBOX});
    way["natural"="wood"](${BBOX});
    way["landcover"="grass"](${BBOX});
  );`,
  beach: `(
    way["natural"="beach"](${BBOX});
    way["natural"="sand"](${BBOX});
  );`,
  water: `(
    way["natural"="water"](${BBOX});
    way["landuse"="reservoir"](${BBOX});
    way["waterway"="riverbank"](${BBOX});
    relation["natural"="water"](${BBOX});
  );`,
  coastline: `way["natural"="coastline"](${BBOX});`,
  road: `way["highway"~"^(motorway|trunk|primary|secondary|tertiary|residential|unclassified|service|living_street|motorway_link|trunk_link|primary_link|secondary_link|tertiary_link)$"](${BBOX});`,
};

type LonLat = [number, number];
type Feature = {
  type: "Feature";
  properties: { k: Cls };
  geometry:
    | { type: "Polygon"; coordinates: LonLat[][] }
    | { type: "LineString"; coordinates: LonLat[] };
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Fetch one class from Overpass (with retries), caching the raw JSON. */
async function fetchClass(cls: Cls): Promise<any> {
  const rawPath = path.join(RAW_DIR, `${cls}.json`);
  if (!FORCE && fs.existsSync(rawPath)) {
    return JSON.parse(fs.readFileSync(rawPath, "utf8"));
  }
  const query = `[out:json][timeout:180];${QUERIES[cls]}out geom;`;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": UA,
        },
        body: "data=" + encodeURIComponent(query),
      });
      if (res.status === 429 || res.status === 504) {
        throw new Error(`rate/timeout ${res.status}`);
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      fs.writeFileSync(rawPath, JSON.stringify(json));
      return json;
    } catch (e) {
      const wait = attempt * 8000;
      console.warn(`  ${cls} attempt ${attempt} failed (${e}); retry in ${wait}ms`);
      await sleep(wait);
    }
  }
  throw new Error(`Overpass fetch failed for ${cls} after retries`);
}

/** A closed ring needs ≥4 points and first === last. */
function isClosed(coords: LonLat[]): boolean {
  if (coords.length < 4) return false;
  const a = coords[0];
  const b = coords[coords.length - 1];
  return a[0] === b[0] && a[1] === b[1];
}

/** OSM element `geometry` ([{lat,lon}…]) → [lon,lat][]. */
function toCoords(geom: { lat: number; lon: number }[]): LonLat[] {
  return geom.map((g) => [g.lon, g.lat]);
}

/** Convert one class's Overpass elements into tagged GeoJSON features. */
function convert(cls: Cls, json: any): Feature[] {
  const out: Feature[] = [];
  const linear = LINEAR[cls];
  for (const el of json.elements ?? []) {
    if (el.type === "way" && Array.isArray(el.geometry)) {
      const coords = toCoords(el.geometry);
      if (linear) {
        if (coords.length >= 2)
          out.push({ type: "Feature", properties: { k: cls }, geometry: { type: "LineString", coordinates: coords } });
      } else if (isClosed(coords)) {
        out.push({ type: "Feature", properties: { k: cls }, geometry: { type: "Polygon", coordinates: [coords] } });
      }
    } else if (el.type === "relation" && Array.isArray(el.members)) {
      // Multipolygon (water): emit each geometried outer member as its own
      // polygon. Inner holes are ignored — for water that only OVER-excludes,
      // which is the safe direction for a scatter mask.
      for (const m of el.members) {
        if (m.role === "inner") continue;
        if (!Array.isArray(m.geometry)) continue;
        const coords = toCoords(m.geometry);
        if (isClosed(coords))
          out.push({ type: "Feature", properties: { k: cls }, geometry: { type: "Polygon", coordinates: [coords] } });
      }
    }
  }
  return out;
}

async function main() {
  fs.mkdirSync(RAW_DIR, { recursive: true });
  const classes = Object.keys(QUERIES) as Cls[];
  const features: Feature[] = [];

  for (const cls of classes) {
    process.stdout.write(`Fetching ${cls}… `);
    const json = await fetchClass(cls);
    const feats = convert(cls, json);
    // Loop, not push(...feats): the road class is large enough that spreading it
    // as call args overflows the stack.
    for (const f of feats) features.push(f);
    console.log(`${feats.length} features`);
    await sleep(1500); // be polite to the public endpoint
  }

  const fc = { type: "FeatureCollection", features };
  fs.writeFileSync(OUT, JSON.stringify(fc));
  const mb = (fs.statSync(OUT).size / 1e6).toFixed(1);
  console.log(`\n✓ ${features.length} features → ${path.relative(process.cwd(), OUT)} (${mb} MB)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
