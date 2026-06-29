import { describe, it, expect } from 'vitest';

import { ExplorationEngine } from './explorationEngine';
import type { LocationProvider, LocationFix } from '../ports/LocationProvider';

/** A test provider we can push fixes through by hand — no GPS, no clock. */
class FakeProvider implements LocationProvider {
  private onFix: ((fix: LocationFix) => void) | null = null;
  async start(onFix: (fix: LocationFix) => void) {
    this.onFix = onFix;
  }
  stop() {
    this.onFix = null;
  }
  emit(fix: LocationFix) {
    this.onFix?.(fix);
  }
}

// A fixed point in Singapore; nearby jitter stays inside one ~125m H3 cell.
const LAT = 1.3521;
const LNG = 103.8198;

describe('ExplorationEngine', () => {
  it('drops fixes worse than the accuracy limit (no cell, no dwell)', async () => {
    const provider = new FakeProvider();
    const fixCells: string[] = [];
    const visited: string[] = [];
    const engine = new ExplorationEngine(
      provider,
      (c) => visited.push(c),
      ({ cellId }) => fixCells.push(cellId),
    );
    await engine.start();

    provider.emit({ lat: LAT, lng: LNG, accuracy: 80, timestamp: 0 });
    provider.emit({ lat: LAT, lng: LNG, accuracy: 9999, timestamp: 30_000 });

    expect(fixCells).toEqual([]); // both fixes filtered out
    expect(visited).toEqual([]);
  });

  it('converts good fixes to an H3 cell and reports it visited after the dwell', async () => {
    const provider = new FakeProvider();
    const fixCells: string[] = [];
    const visited: string[] = [];
    const engine = new ExplorationEngine(
      provider,
      (c) => visited.push(c),
      ({ cellId }) => fixCells.push(cellId),
    );
    await engine.start();

    provider.emit({ lat: LAT, lng: LNG, accuracy: 8, timestamp: 0 });
    provider.emit({ lat: LAT, lng: LNG, accuracy: 8, timestamp: 25_000 });

    const cell = fixCells[0];
    expect(cell).toMatch(/^8[0-9a-f]{14}$/); // an H3 res-10 cell id
    expect(fixCells).toEqual([cell, cell]); // both good fixes mapped to same cell
    expect(visited).toEqual([cell]); // crossed the 20s dwell once
  });
});
