import { describe, it, expect, beforeEach, vi } from 'vitest';

// In-memory AsyncStorage whose getItem/setItem each defer a macrotask, so that
// if the serialization queue regressed, two concurrent ingest calls would
// interleave (load stale → clobber) and the assertions below would fail.
const { store } = vi.hoisted(() => ({ store: new Map<string, string>() }));

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: (k: string) =>
      new Promise<string | null>((res) =>
        setTimeout(() => res(store.has(k) ? (store.get(k) as string) : null), 0),
      ),
    setItem: (k: string, v: string) =>
      new Promise<void>((res) =>
        setTimeout(() => {
          store.set(k, v);
          res();
        }, 0),
      ),
    removeItem: (k: string) => {
      store.delete(k);
      return Promise.resolve();
    },
  },
}));

// Imported after the mock is registered (vi.mock is hoisted above imports).
import { ingestLocations, resetIngestAnchor, type IngestFix } from './ingest';
import { loadDwellState } from '@/adapters/storage/dwellStateRepo';
import { AsyncVisitedRepository } from '@/adapters/storage/VisitedRepository.async';
import { loadStats } from '@/services/exploreStats';

// All fixes share one coordinate → one H3 cell. Singapore-ish so it's land.
const LAT = 1.2806;
const LNG = 103.8506;
const fix = (timestamp: number, accuracy = 10): IngestFix => ({
  coords: { latitude: LAT, longitude: LNG, accuracy },
  timestamp,
});

describe('ingestLocations', () => {
  beforeEach(() => {
    store.clear();
    resetIngestAnchor();
  });

  it('marks a cell visited once dwell crosses the threshold and persists it', async () => {
    await ingestLocations([fix(0), fix(10_000), fix(25_000)]); // 25s in one cell
    const visited = await new AsyncVisitedRepository().load();
    expect(visited).toHaveLength(1);
  });

  it('drops a fix worse than the accuracy limit', async () => {
    await ingestLocations([fix(0, 9999), fix(25_000, 9999)]);
    const visited = await new AsyncVisitedRepository().load();
    expect(visited).toHaveLength(0);
  });

  it('serializes concurrent calls — no lost accumulation (race regression guard)', async () => {
    // Two SEPARATE calls fired without awaiting between them, as the per-fix
    // foreground watcher does. Unserialized, the second would load state before
    // the first saved, see lastTime=null, credit nothing, and clobber the save —
    // leaving the cell unvisited. Serialized, the 25s gap is credited and it
    // crosses the threshold.
    const p1 = ingestLocations([fix(0)]);
    const p2 = ingestLocations([fix(25_000)]);
    await Promise.all([p1, p2]);

    const visited = await new AsyncVisitedRepository().load();
    expect(visited).toHaveLength(1);

    // And the dwell state advanced to the latest fix, not a stale one.
    const state = await loadDwellState();
    expect(state.lastTime).toBe(25_000);
  });

  it('accumulates walked distance across fixes', async () => {
    // ~111m north then back — each leg under MAX_STEP_M(100)? 0.0005deg ≈ 55m.
    const north = (t: number): IngestFix => ({
      coords: { latitude: LAT + 0.0005, longitude: LNG, accuracy: 10 },
      timestamp: t,
    });
    await ingestLocations([fix(0), north(3_000), fix(6_000)]);
    const stats = await loadStats();
    expect(stats.distanceM).toBeGreaterThan(50);
  });
});
