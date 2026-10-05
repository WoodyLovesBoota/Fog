import { WORLD, latLngToWorld, toWorld } from "@/diorama/lib/geo";
import { fbm, smoothstep } from "@/diorama/lib/noise";
import land from "@/diorama/data/sg-land.json";
import { AIRFIELD, FORESTS, HILLS, INDUSTRY, SKYLINE, TOWNS, WATER, type Blob } from "./places";

/** A scalar sampled on a regular grid over the board, read back with bilinear filtering. */
export class Field {
  readonly width: number;
  readonly height: number;
  readonly data: Float32Array;

  constructor(readonly cellsPerKm: number) {
    this.width = Math.round(WORLD.width * cellsPerKm);
    this.height = Math.round(WORLD.depth * cellsPerKm);
    this.data = new Float32Array(this.width * this.height);
  }

  /** World position of the centre of cell (i, j). */
  cellX(i: number) {
    return WORLD.minX + (i + 0.5) / this.cellsPerKm;
  }
  cellZ(j: number) {
    return WORLD.minZ + (j + 0.5) / this.cellsPerKm;
  }

  at(x: number, z: number): number {
    const { width: w, height: h, data } = this;
    const gx = Math.min(w - 1.001, Math.max(0, (x - WORLD.minX) * this.cellsPerKm - 0.5));
    const gz = Math.min(h - 1.001, Math.max(0, (z - WORLD.minZ) * this.cellsPerKm - 0.5));
    const ix = gx | 0;
    const iz = gz | 0;
    const fx = gx - ix;
    const fz = gz - iz;
    const o = iz * w + ix;
    const top = data[o] + (data[o + 1] - data[o]) * fx;
    const bottom = data[o + w] + (data[o + w + 1] - data[o + w]) * fx;
    return top + (bottom - top) * fz;
  }
}

/** Traces every land ring into `ctx`, in canvas pixels at `pxPerKm`. */
export function traceLand(ctx: CanvasRenderingContext2D | Path2D, pxPerKm: number) {
  for (const polygon of land.polygons) {
    for (const ring of polygon) {
      for (let i = 0; i < ring.length; i += 2) {
        const [x, z] = toWorld(ring[i], ring[i + 1]);
        const px = (x - WORLD.minX) * pxPerKm;
        const py = (z - WORLD.minZ) * pxPerKm;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
    }
  }
}

/** Strokes a `[lat, lng]` polyline (or dots a single point) in canvas pixels. */
export function strokeLatLng(
  ctx: CanvasRenderingContext2D,
  path: readonly (readonly [number, number])[],
  pxPerKm: number,
) {
  ctx.beginPath();
  path.forEach((p, i) => {
    const [x, z] = latLngToWorld(p);
    const px = (x - WORLD.minX) * pxPerKm;
    const py = (z - WORLD.minZ) * pxPerKm;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
    // A one-point path is a pond: a zero-length segment with round caps.
    if (path.length === 1) ctx.lineTo(px + 0.01, py);
  });
  ctx.stroke();
}

const INF = 1e20;

/** Felzenszwalb & Huttenlocher 1D squared distance transform. */
function edt1d(f: Float64Array, n: number, d: Float64Array, v: Int32Array, z: Float64Array) {
  let k = 0;
  v[0] = 0;
  z[0] = -INF;
  z[1] = INF;
  for (let q = 1; q < n; q++) {
    let s = 0;
    do {
      const r = v[k];
      s = (f[q] - f[r] + q * q - r * r) / (q - r) / 2;
    } while (s <= z[k] && --k > -1);
    k++;
    v[k] = q;
    z[k] = s;
    z[k + 1] = INF;
  }
  k = 0;
  for (let q = 0; q < n; q++) {
    while (z[k + 1] < q) k++;
    const r = v[k];
    d[q] = (q - r) * (q - r) + f[r];
  }
}

/** In place: `grid` holds 0 at feature cells and INF elsewhere; becomes squared distance (in cells). */
function edt2d(grid: Float64Array, w: number, h: number) {
  const n = Math.max(w, h);
  const f = new Float64Array(n);
  const d = new Float64Array(n);
  const v = new Int32Array(n);
  const z = new Float64Array(n + 1);
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) f[y] = grid[y * w + x];
    edt1d(f, h, d, v, z);
    for (let y = 0; y < h; y++) grid[y * w + x] = d[y];
  }
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) f[x] = grid[row + x];
    edt1d(f, w, d, v, z);
    for (let x = 0; x < w; x++) grid[row + x] = d[x];
  }
}

function boxBlur(field: Field, passes: number) {
  const { width: w, height: h, data } = field;
  const tmp = new Float32Array(data.length);
  for (let p = 0; p < passes; p++) {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const xl = x > 0 ? x - 1 : x;
        const xr = x < w - 1 ? x + 1 : x;
        tmp[y * w + x] = (data[y * w + xl] + data[y * w + x] + data[y * w + xr]) / 3;
      }
    }
    for (let y = 0; y < h; y++) {
      const yu = y > 0 ? y - 1 : y;
      const yd = y < h - 1 ? y + 1 : y;
      for (let x = 0; x < w; x++) {
        data[y * w + x] = (tmp[yu * w + x] + tmp[y * w + x] + tmp[yd * w + x]) / 3;
      }
    }
  }
}

/** Signed distance to the edge of `mask`, in km: positive on land, negative over water. */
function signedDistance(mask: Uint8ClampedArray, cellsPerKm: number): Field {
  const field = new Field(cellsPerKm);
  const { width: w, height: h } = field;
  const toLand = new Float64Array(w * h);
  const toWater = new Float64Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const isLand = mask[i * 4 + 3] > 127;
    toLand[i] = isLand ? 0 : INF;
    toWater[i] = isLand ? INF : 0;
  }
  edt2d(toLand, w, h);
  edt2d(toWater, w, h);
  for (let i = 0; i < w * h; i++) {
    const d = toWater[i] > 0 ? Math.sqrt(toWater[i]) - 0.5 : 0.5 - Math.sqrt(toLand[i]);
    field.data[i] = d / cellsPerKm;
  }
  // The mask is binary, so the raw distance has a one-cell staircase along the coast.
  boxBlur(field, 2);
  return field;
}

function sumBlobs(blobs: Blob[], cellsPerKm: number): Field {
  const field = new Field(cellsPerKm);
  const { width: w, height: h, data } = field;
  for (const blob of blobs) {
    const [cx, cz] = latLngToWorld(blob.at);
    const rx = blob.radius * (blob.stretch?.[0] ?? 1);
    const rz = blob.radius * (blob.stretch?.[1] ?? 1);
    // Beyond three radii the gaussian is below 1.2% of its peak.
    const i0 = Math.max(0, Math.floor((cx - rx * 3 - WORLD.minX) * cellsPerKm));
    const i1 = Math.min(w - 1, Math.ceil((cx + rx * 3 - WORLD.minX) * cellsPerKm));
    const j0 = Math.max(0, Math.floor((cz - rz * 3 - WORLD.minZ) * cellsPerKm));
    const j1 = Math.min(h - 1, Math.ceil((cz + rz * 3 - WORLD.minZ) * cellsPerKm));
    for (let j = j0; j <= j1; j++) {
      const dz = (field.cellZ(j) - cz) / rz;
      for (let i = i0; i <= i1; i++) {
        const dx = (field.cellX(i) - cx) / rx;
        data[j * w + i] += blob.amp * Math.exp(-(dx * dx + dz * dz));
      }
    }
  }
  return field;
}

export type Fields = {
  /** Signed km to the nearest water of any kind (sea, reservoir, channel). */
  shore: Field;
  /** Signed km to the open sea only — tells a beach apart from a lakeside. */
  coast: Field;
  hill: Field;
  forest: Field;
  urban: Field;
  skyline: Field;
  industry: Field;
  airfield: Field;
  heightAt(x: number, z: number): number;
};

const SHORE_CELLS_PER_KM = 24;
const BLOB_CELLS_PER_KM = 10;

/** Height of the flat lowland above the waterline. */
export const PLAIN_HEIGHT = 0.36;
/** Signed shore distances (km) where the sand ends and where the bank tops out onto the plain. */
export const BANK = [0.13, 0.24] as const;

export function buildFields(): Fields {
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(WORLD.width * SHORE_CELLS_PER_KM);
  canvas.height = Math.round(WORLD.depth * SHORE_CELLS_PER_KM);
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;

  ctx.fillStyle = "#fff";
  ctx.beginPath();
  traceLand(ctx, SHORE_CELLS_PER_KM);
  ctx.fill("evenodd");
  const coast = signedDistance(ctx.getImageData(0, 0, canvas.width, canvas.height).data, SHORE_CELLS_PER_KM);

  ctx.globalCompositeOperation = "destination-out";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const water of WATER) {
    ctx.lineWidth = water.width * SHORE_CELLS_PER_KM;
    strokeLatLng(ctx, water.path, SHORE_CELLS_PER_KM);
  }
  const shore = signedDistance(ctx.getImageData(0, 0, canvas.width, canvas.height).data, SHORE_CELLS_PER_KM);

  const hill = sumBlobs(HILLS, BLOB_CELLS_PER_KM);
  const fields: Fields = {
    shore,
    coast,
    hill,
    forest: sumBlobs(FORESTS, BLOB_CELLS_PER_KM),
    urban: sumBlobs(TOWNS, BLOB_CELLS_PER_KM),
    skyline: sumBlobs(SKYLINE, BLOB_CELLS_PER_KM),
    industry: sumBlobs(INDUSTRY, BLOB_CELLS_PER_KM),
    airfield: sumBlobs(AIRFIELD, BLOB_CELLS_PER_KM),
    heightAt(x, z) {
      const d = shore.at(x, z);
      if (d <= 0) return -0.3 * smoothstep(0, 0.4, -d);
      // A low sandy apron, then a step up onto the grass — the "slab on a beach" look.
      let h = 0.06 * smoothstep(0, 0.12, d) + (PLAIN_HEIGHT - 0.06) * smoothstep(BANK[0], BANK[1], d);
      h += smoothstep(0.22, 0.7, d) * hill.at(x, z);
      h += smoothstep(0.4, 1.5, d) * (fbm(x * 0.5, z * 0.5, 3, 7) - 0.5) * 0.1;
      return h;
    },
  };
  return fields;
}
