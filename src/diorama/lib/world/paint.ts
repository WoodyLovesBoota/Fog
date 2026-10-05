import { WORLD, latLngToWorld } from "@/diorama/lib/geo";
import { fbm, smoothstep, valueNoise } from "@/diorama/lib/noise";
import { PALETTE, hexToRgb } from "@/diorama/lib/palette";
import { BANK, strokeLatLng, traceLand, type Fields } from "./fields";
import { AREAS } from "@/diorama/data/areas";
import { ROADS, type RoadLine } from "@/diorama/data/roads";
import { RIVERS, RUNWAYS } from "./places";

/** Texels per km of the painted ground. 64 -> a 3840 x 2368 texture. */
export const PAINT_PX_PER_KM = 64;

type Rgb = [number, number, number];

const rgb = {
  sand: hexToRgb(PALETTE.sand),
  sandWet: hexToRgb(PALETTE.sandWet),
  grass: PALETTE.grass.map(hexToRgb),
  grassRim: hexToRgb(PALETTE.grassRim),
  bank: PALETTE.bank.map(hexToRgb),
  tuft: hexToRgb(PALETTE.tuft),
  forest: PALETTE.forest.map(hexToRgb),
  peak: hexToRgb(PALETTE.peak),
  urban: hexToRgb(PALETTE.urban),
  urbanCore: hexToRgb(PALETTE.urbanCore),
  street: hexToRgb(PALETTE.street),
  industry: hexToRgb(PALETTE.industry),
  airfield: hexToRgb(PALETTE.airfield),
};

// Street grids run at a few fixed bearings; which one a block gets is picked by low-frequency noise.
const GRID_ANGLES = [0.18, -0.42, 0.7].map((a) => [Math.cos(a), Math.sin(a)] as const);
const BLOCKS_PER_KM = 3.4;

/** Half-width (km) over which neighbouring shore bands are blended: about one texel. */
const EDGE = 0.6 / PAINT_PX_PER_KM;
const feather = (d: number, edge: number) => Math.min(1, Math.max(0, (d - edge) / (EDGE * 2) + 0.5));
const blend = (a: Rgb, b: Rgb, t: number): Rgb =>
  t <= 0 ? a : t >= 1 ? b : [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const scale = (a: Rgb, k: number): Rgb => [a[0] * k, a[1] * k, a[2] * k];

/** Paints the ground: flat, banded colours in the spirit of a hand-drawn game map. */
export function paintGround(fields: Fields): HTMLCanvasElement {
  const ppk = PAINT_PX_PER_KM;
  const canvas = document.createElement("canvas");
  canvas.width = WORLD.width * ppk;
  canvas.height = WORLD.depth * ppk;
  const ctx = canvas.getContext("2d")!;
  const image = ctx.createImageData(canvas.width, canvas.height);
  const out = image.data;
  const { shore, coast, hill, forest, urban, industry, airfield } = fields;

  let o = 0;
  for (let py = 0; py < canvas.height; py++) {
    const z = WORLD.minZ + (py + 0.5) / ppk;
    for (let px = 0; px < canvas.width; px++, o += 4) {
      const x = WORLD.minX + (px + 0.5) / ppk;
      const d = shore.at(x, z);
      let c: Rgb;
      let shade = 1;
      let lift = 0;

      if (d < -0.08) {
        // Under the sea surface; never seen.
        c = rgb.sandWet;
      } else {
        const fine = valueNoise(x * 1.9, z * 1.9, 1);
        const broad = valueNoise(x * 0.3, z * 0.3, 2);
        const speck = valueNoise(x * 15, z * 15, 4);
        const lakeside = coast.at(x, z) > 0.4;

        {
          const f = forest.at(x, z) + (fine - 0.5) * 0.3;
          // Ragged town edges: a clean threshold on the density blobs would draw perfect circles.
          const u = urban.at(x, z) + (fbm(x * 0.8, z * 0.8, 3, 5) - 0.5) * 0.7;
          const ind = industry.at(x, z) + (fine - 0.5) * 0.2;
          const air = airfield.at(x, z);
          const height = hill.at(x, z);

          if (air > 0.5) {
            c = rgb.airfield;
          } else if (f > 0.55) {
            c = f > 0.9 ? rgb.forest[1] : rgb.forest[0];
            shade = 1 - 0.07 * smoothstep(0.7, 0.9, speck);
          } else if (ind > 0.55 || u > 0.5) {
            const paved = ind > 0.55 ? rgb.industry : u > 0.85 ? rgb.urbanCore : rgb.urban;
            const [cos, sin] = GRID_ANGLES[Math.min(2, (valueNoise(x * 0.16, z * 0.16, 3) * 3) | 0)];
            const gx = (x * cos + z * sin) * BLOCKS_PER_KM;
            const gz = (z * cos - x * sin) * BLOCKS_PER_KM;
            const onStreet = gx - Math.floor(gx) < 0.1 || gz - Math.floor(gz) < 0.1;
            c = onStreet ? rgb.street : paved;
          } else {
            c = broad < 0.42 ? rgb.grass[0] : broad < 0.6 ? rgb.grass[1] : rgb.grass[2];
            c = blend(c, rgb.tuft, smoothstep(0.74, 0.92, speck));
          }
          // Stepped highlights up the hills, like contour bands on a hand-drawn map.
          if (air <= 0.5 && height > 0.3) lift = Math.ceil(smoothstep(0.3, 1.5, height) * 4) / 4;
          if (lakeside) {
            if (d < 0.07) c = rgb.grassRim;
          } else if (d < BANK[1] + 0.03 + EDGE) {
            // Beach, then the exposed earth of the bank, then a darker lip of turf. Each
            // boundary is feathered over a texel so the bands stay smooth when zoomed in.
            const sand = d < 0.045 ? rgb.sandWet : rgb.sand;
            const mid = (BANK[0] + BANK[1]) / 2;
            let band = blend(speck > 0.86 ? scale(sand, 0.95) : sand, rgb.bank[0], feather(d, BANK[0]));
            band = blend(band, rgb.bank[1], feather(d, mid));
            band = blend(band, rgb.grassRim, feather(d, BANK[1] - 0.015));
            c = blend(band, lift > 0 || shade < 1 ? rgb.grassRim : c, feather(d, BANK[1] + 0.03));
            lift = 0;
            shade = 1;
          }
        }
      }
      if (lift > 0) c = [c[0] + (rgb.peak[0] - c[0]) * lift * 0.55, c[1] + (rgb.peak[1] - c[1]) * lift * 0.55, c[2] + (rgb.peak[2] - c[2]) * lift * 0.55];
      if (shade < 1) c = [c[0] * shade, c[1] * shade, c[2] * shade];
      out[o] = c[0];
      out[o + 1] = c[1];
      out[o + 2] = c[2];
      out[o + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);

  // Line work, clipped to the land so nothing bleeds onto the seabed.
  ctx.save();
  ctx.beginPath();
  traceLand(ctx, ppk);
  ctx.clip("evenodd");
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  for (const river of RIVERS) {
    ctx.strokeStyle = PALETTE.grassRim;
    ctx.lineWidth = 0.14 * ppk;
    strokeLatLng(ctx, river, ppk);
    ctx.strokeStyle = PALETTE.river;
    ctx.lineWidth = 0.085 * ppk;
    strokeLatLng(ctx, river, ppk);
  }

  // Real roads, minor ones first so the expressways sit on top. Widths are in km and
  // far wider than life, or they would vanish at map scale.
  const strokeRoads = (lines: RoadLine[], style: string, widthKm: number) => {
    ctx.strokeStyle = style;
    ctx.lineWidth = widthKm * ppk;
    ctx.beginPath();
    for (const line of lines) {
      line.forEach(([x, z], i) => {
        const px = (x - WORLD.minX) * ppk;
        const py = (z - WORLD.minZ) * ppk;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
    }
    ctx.stroke();
  };
  const casing = "rgba(196, 178, 132, 0.5)";
  strokeRoads(ROADS.street, "rgba(255, 249, 232, 0.8)", 0.03);
  strokeRoads(ROADS.arterial, casing, 0.075);
  strokeRoads(ROADS.arterial, PALETTE.road, 0.048);
  strokeRoads(ROADS.expressway, casing, 0.13);
  strokeRoads(ROADS.expressway, PALETTE.road, 0.09);

  // Planning-area boundaries: a faint dotted seam, enough to see the island is divided.
  ctx.strokeStyle = "rgba(44, 47, 96, 0.3)";
  ctx.lineWidth = 0.028 * ppk;
  ctx.setLineDash([0.001, 0.085 * ppk]);
  ctx.beginPath();
  for (const area of AREAS) {
    for (const ring of area.polygons.flat()) {
      ring.forEach(([x, z], i) => {
        const px = (x - WORLD.minX) * ppk;
        const py = (z - WORLD.minZ) * ppk;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.closePath();
    }
  }
  ctx.stroke();
  ctx.setLineDash([]);

  for (const runway of RUNWAYS) {
    ctx.lineCap = "butt";
    ctx.strokeStyle = PALETTE.runway;
    ctx.lineWidth = 0.2 * ppk;
    strokeLatLng(ctx, runway, ppk);
    ctx.strokeStyle = "#FFFFFF";
    ctx.lineWidth = 0.03 * ppk;
    ctx.setLineDash([0.18 * ppk, 0.14 * ppk]);
    strokeLatLng(ctx, runway, ppk);
    ctx.setLineDash([]);
  }
  ctx.restore();

  return canvas;
}

/** True if (x, z) is on or right beside a runway — props stay off the tarmac. */
export function nearRunway(x: number, z: number): boolean {
  for (const [a, b] of RUNWAYS) {
    const [ax, az] = latLngToWorld(a);
    const [bx, bz] = latLngToWorld(b);
    const t = Math.min(1, Math.max(0, ((x - ax) * (bx - ax) + (z - az) * (bz - az)) / ((bx - ax) ** 2 + (bz - az) ** 2)));
    if (Math.hypot(x - (ax + (bx - ax) * t), z - (az + (bz - az) * t)) < 0.3) return true;
  }
  return false;
}
