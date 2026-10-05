import { toWorld } from "@/diorama/lib/geo";
import raw from "./sg-mrt.json";

export type MrtLine = {
  /** Station-code prefix: NS, EW, NE, CC, DT, TE. */
  id: string;
  name: string;
  color: string;
  /** Track runs in world space. */
  paths: [x: number, z: number][][];
};

export type MrtStation = {
  name: string;
  /** Ids of the lines that call here; more than one makes it an interchange. */
  lines: string[];
  x: number;
  z: number;
};

/** How far (0..1) each official line colour is washed towards white, so the network sits back a little. */
const WASH = 0.24;

function soften(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const mix = (c: number) => Math.round(c + (255 - c) * WASH);
  const rgb = (mix((n >> 16) & 255) << 16) | (mix((n >> 8) & 255) << 8) | mix(n & 255);
  return `#${rgb.toString(16).padStart(6, "0")}`;
}

/**
 * MRT lines and stations, from OpenStreetMap (© OpenStreetMap contributors, ODbL).
 * Regenerate with `pnpm sync:mrt`.
 */
export const MRT_LINES: MrtLine[] = raw.lines.map((line) => ({
  id: line.id,
  name: line.name,
  color: soften(line.color),
  paths: line.paths.map((flat) => {
    const path: [number, number][] = [];
    for (let i = 0; i < flat.length; i += 2) path.push(toWorld(flat[i], flat[i + 1]));
    return path;
  }),
}));

export const MRT_LINE_BY_ID = new Map(MRT_LINES.map((line) => [line.id, line]));

export const MRT_STATIONS: MrtStation[] = raw.stations.map((station) => {
  const [x, z] = toWorld(station.lng, station.lat);
  return { name: station.name, lines: station.lines, x, z };
});
