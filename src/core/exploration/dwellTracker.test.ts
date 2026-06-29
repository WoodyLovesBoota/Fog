import { describe, it, expect } from 'vitest';

import { DwellTracker } from './dwellTracker';

// Mirrors DWELL_THRESHOLD_MS (20s) from explorationConfig.

describe('DwellTracker', () => {
  it('marks a cell visited once cumulative dwell crosses the threshold', () => {
    const t = new DwellTracker();
    expect(t.push('A', 0)).toBeNull(); // first fix, nothing to credit yet
    expect(t.push('A', 21_000)).toBe('A'); // 21s credited to A -> visited
    expect(t.isVisited('A')).toBe(true);
  });

  it('defends against jitter: a brief hop to a neighbor never marks it visited', () => {
    const t = new DwellTracker();
    // Standing in A, GPS flickers to B for half a second, then back to A.
    t.push('A', 0);
    t.push('A', 5_000); //   A += 5000
    t.push('B', 5_500); //   A += 500  (interval was spent in A)
    t.push('A', 6_000); //   B += 500  (the only time ever credited to B)
    const visited = t.push('A', 26_000); // A += 20000 -> crosses threshold

    expect(visited).toBe('A');
    expect(t.isVisited('A')).toBe(true);
    expect(t.isVisited('B')).toBe(false); // B only ever got 500ms
  });

  it('reports a cell as newly visited only once', () => {
    const t = new DwellTracker();
    t.push('A', 0);
    expect(t.push('A', 21_000)).toBe('A'); // crosses here
    expect(t.push('A', 42_000)).toBeNull(); // still in A, but already visited
    expect(t.push('A', 99_000)).toBeNull();
    expect(t.isVisited('A')).toBe(true);
  });
});
