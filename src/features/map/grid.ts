/**
 * Grid math for the fog-of-war canvas.
 *
 * The handoff prototype lays out an 8x19 offset grid of cells over the phone
 * (390x844). We keep the same cell topology but scale every dimension to the
 * real canvas so the grid fills any screen while preserving the design ratios.
 *
 * Cell ids run 0..(COLS*ROWS-1), row-major: id = row*COLS + col.
 * Odd rows are shifted right by half a cell (the prototype's `r % 2`),
 * which gives the soft brick/offset look of the clouds.
 */

export const COLS = 8;
export const ROWS = 19;
export const TOTAL_CELLS = COLS * ROWS;

// Prototype reference frame.
const REF_W = 390;
const REF_H = 844;
const REF_CELL_W = 56;
const REF_CELL_H = 64;
const REF_OX = -16;
const REF_OY = -34;
export const GY = 0.75; // vertical step factor (rows overlap slightly)

export type CellLayout = {
  cellW: number;
  cellH: number;
  ox: number;
  oy: number;
};

export function layoutFor(canvasW: number, canvasH: number): CellLayout {
  const sx = canvasW / REF_W;
  const sy = canvasH / REF_H;
  return {
    cellW: REF_CELL_W * sx,
    cellH: REF_CELL_H * sy,
    ox: REF_OX * sx,
    oy: REF_OY * sy,
  };
}

export function cellOrigin(id: number, l: CellLayout): { x: number; y: number } {
  const col = id % COLS;
  const row = Math.floor(id / COLS);
  const x = col * l.cellW + (row % 2 ? l.cellW / 2 : 0) + l.ox;
  const y = row * (l.cellH * GY) + l.oy;
  return { x, y };
}

export function cellCenter(id: number, l: CellLayout): { x: number; y: number } {
  const o = cellOrigin(id, l);
  return { x: o.x + l.cellW / 2, y: o.y + l.cellH / 2 };
}

/** One of three soft reveal tints, stable per cell (matches prototype colorFor). */
const REVEAL_TINTS = ['#9FD6EC', '#A2E3CC', '#B3BEF6'] as const;
export function revealTint(id: number): string {
  return REVEAL_TINTS[id % 3];
}
