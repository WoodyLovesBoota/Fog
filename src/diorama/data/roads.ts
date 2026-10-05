import { toWorld } from "@/diorama/lib/geo";
import raw from "./sg-roads.json";

/** A road centreline in world space. */
export type RoadLine = [x: number, z: number][];

const toLines = (lines: number[][]): RoadLine[] =>
  lines.map((flat) => {
    const line: RoadLine = [];
    for (let i = 0; i < flat.length; i += 2) line.push(toWorld(flat[i], flat[i + 1]));
    return line;
  });

/**
 * Singapore's real main roads, from OpenStreetMap (© OpenStreetMap contributors, ODbL).
 * Regenerate with `pnpm sync:roads`.
 */
export const ROADS = {
  /** Expressways: PIE, AYE, ECP, CTE… */
  expressway: toLines(raw.expressway),
  /** Trunk and primary roads. */
  arterial: toLines(raw.arterial),
  /** Secondary roads. */
  street: toLines(raw.street),
};
