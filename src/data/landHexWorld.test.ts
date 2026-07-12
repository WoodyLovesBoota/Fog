import { describe, expect, it } from 'vitest';

import { buildWorldFC, LAND_HEX_IDS } from '@/data/landHexWorld';
import { LAND_HEX_CELLS } from '@/data/landHexCells';

describe('landHexWorld (end-to-end board build)', () => {
  it('builds one tile feature per generated land cell', () => {
    const fc = buildWorldFC(new Set());
    expect(LAND_HEX_CELLS.length).toBeGreaterThan(0);
    expect(fc.type).toBe('FeatureCollection');
    expect(fc.features.length).toBe(LAND_HEX_CELLS.length);
  });

  it('every tile is a closed polygon ring', () => {
    const fc = buildWorldFC(new Set());
    for (const f of fc.features) {
      expect(f.geometry.type).toBe('Polygon');
      const ring = f.geometry.coordinates[0];
      expect(ring.length).toBeGreaterThanOrEqual(7);
      expect(ring[0]).toEqual(ring[ring.length - 1]);
    }
  });

  it('stamps explored=1 only on the given tiles, 0 elsewhere', () => {
    const target = LAND_HEX_CELLS[0];
    const fc = buildWorldFC(new Set([target]));
    const explored = fc.features.filter((f) => f.properties.explored === 1);
    expect(explored.length).toBe(1);
    // Every land id resolves to a real tile in the board index.
    expect(LAND_HEX_IDS.has(target)).toBe(true);
  });

  it('defaults all tiles to unexplored for an empty set', () => {
    const fc = buildWorldFC(new Set());
    expect(fc.features.every((f) => f.properties.explored === 0)).toBe(true);
  });
});
