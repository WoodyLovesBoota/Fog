import { describe, expect, it } from 'vitest';
import { cellToChildren, cellToParent, latLngToCell } from 'h3-js';

import { hexRing, visitedToVisualCells } from './hexWorld';

// Two real res-8 Singapore land tiles, derived from coordinates so the ids are
// always valid regardless of the h3 version's internal encoding.
const TILE_A = latLngToCell(1.3521, 103.8198, 8);
const TILE_B = latLngToCell(1.29, 103.85, 8);

describe('visitedToVisualCells', () => {
  it('rolls fine cells up to their coarse VISUAL parent', () => {
    const children = cellToChildren(TILE_A, 10);
    // Two distinct res-10 cells inside the same res-8 tile → one visual tile.
    const out = visitedToVisualCells([children[0], children[1]], 8);
    expect(out).toEqual([TILE_A]);
  });

  it('dedupes and preserves distinct parents', () => {
    const childA = cellToChildren(TILE_A, 10)[0];
    const childB = cellToChildren(TILE_B, 10)[0];
    const out = visitedToVisualCells([childA, childB, childA], 8);
    expect(new Set(out)).toEqual(new Set([TILE_A, TILE_B]));
    expect(out.length).toBe(2);
  });

  it('returns an empty list for no visits', () => {
    expect(visitedToVisualCells([], 8)).toEqual([]);
  });

  it('maps a res-10 cell to its own res-8 parent', () => {
    const cell = cellToChildren(TILE_A, 10)[3];
    expect(visitedToVisualCells([cell], 8)).toEqual([cellToParent(cell, 8)]);
  });
});

describe('hexRing', () => {
  it('returns a closed ring (last point equals first)', () => {
    const ring = hexRing(TILE_A, 1);
    expect(ring.length).toBeGreaterThanOrEqual(7); // 6-7 hex vertices + closure
    expect(ring[0]).toEqual(ring[ring.length - 1]);
  });

  it('inset < 1 shrinks every vertex toward the centroid', () => {
    const full = hexRing(TILE_A, 1);
    const inset = hexRing(TILE_A, 0.5);
    // Centroid of the full open ring (drop the closing duplicate).
    const open = full.slice(0, -1);
    const cx = open.reduce((s, [x]) => s + x, 0) / open.length;
    const cy = open.reduce((s, [, y]) => s + y, 0) / open.length;
    const dist = (p: number[]) => Math.hypot(p[0] - cx, p[1] - cy);
    for (let i = 0; i < open.length; i++) {
      // Each inset vertex is ~half the distance from the centroid.
      expect(dist(inset[i])).toBeLessThan(dist(full[i]));
      expect(dist(inset[i])).toBeCloseTo(dist(full[i]) * 0.5, 6);
    }
  });
});
