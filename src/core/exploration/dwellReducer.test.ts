import { describe, it, expect } from 'vitest';

import { applyFix, emptyDwellState, type DwellState } from './dwellReducer';

// Mirrors DWELL_THRESHOLD_MS (20s) and MAX_DWELL_GAP_MS (5min) from
// explorationConfig. Serializable twin of DwellTracker — same jitter defense,
// plus the background-only large-gap guard.

/** Fold a sequence of [cell, ts] fixes, threading state + a shared visited set. */
function run(steps: [string, number][], seed: string[] = []) {
  let state: DwellState = emptyDwellState();
  const visited = new Set(seed);
  const fired: string[] = [];
  for (const [cell, ts] of steps) {
    const r = applyFix(state, cell, ts, visited);
    state = r.state;
    if (r.newlyVisited) {
      visited.add(r.newlyVisited);
      fired.push(r.newlyVisited);
    }
  }
  return { state, visited, fired };
}

describe('dwellReducer / applyFix', () => {
  it('marks a cell visited once cumulative dwell crosses the threshold', () => {
    const { fired, visited } = run([
      ['A', 0], //      first fix, nothing to credit yet
      ['A', 21_000], // 21s credited to A -> visited
    ]);
    expect(fired).toEqual(['A']);
    expect(visited.has('A')).toBe(true);
  });

  it('defends against jitter: a brief hop to a neighbor never marks it visited', () => {
    const { fired, visited } = run([
      ['A', 0],
      ['A', 5_000], //  A += 5000
      ['B', 5_500], //  A += 500  (interval was spent in A)
      ['A', 6_000], //  B += 500  (the only time ever credited to B)
      ['A', 26_000], // A += 20000 -> crosses threshold
    ]);
    expect(fired).toEqual(['A']);
    expect(visited.has('A')).toBe(true);
    expect(visited.has('B')).toBe(false); // B only ever got 500ms
  });

  it('seeded (already-visited) cells never re-fire', () => {
    const { fired } = run(
      [
        ['A', 0],
        ['A', 30_000], // would cross, but A is already visited
      ],
      ['A'],
    );
    expect(fired).toEqual([]);
  });

  it('reports a cell as newly visited only once', () => {
    const { fired } = run([
      ['A', 0],
      ['A', 21_000], // crosses here
      ['A', 42_000], // still in A, already visited
      ['A', 99_000],
    ]);
    expect(fired).toEqual(['A']);
  });

  it('drops a huge gap (background sleep) instead of crediting it to one cell', () => {
    // Stand in A, then the app sleeps for 10 minutes (> MAX_DWELL_GAP_MS) before
    // the next fix. That gap must NOT be dumped onto A, so A stays uncolored.
    const { fired, state } = run([
      ['A', 0],
      ['A', 10 * 60 * 1000], // 10min gap — discarded
    ]);
    expect(fired).toEqual([]);
    expect(state.accumByCell.A ?? 0).toBe(0);
  });

  it('a gap exactly at the cap still counts', () => {
    const { fired } = run([
      ['A', 0],
      ['A', 5 * 60 * 1000], // == MAX_DWELL_GAP_MS, well over the 20s threshold
    ]);
    expect(fired).toEqual(['A']);
  });

  it('a confirmed cell is cleared from the accumulator to keep state small', () => {
    const { state } = run([
      ['A', 0],
      ['A', 21_000],
    ]);
    expect(state.accumByCell.A).toBeUndefined();
  });

  it('round-trips through JSON (state is serializable)', () => {
    const { state } = run([
      ['A', 0],
      ['A', 5_000],
      ['B', 8_000],
    ]);
    const revived = JSON.parse(JSON.stringify(state)) as DwellState;
    // Continuing from the revived state behaves identically to never reloading.
    const r = applyFix(revived, 'B', 30_000, new Set());
    expect(r.newlyVisited).toBe('B');
  });
});
