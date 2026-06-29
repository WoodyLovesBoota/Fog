import { useSyncExternalStore } from 'react';

import {
  clearVisited,
  loadMeta,
  loadVisited,
  saveMeta,
  saveVisited,
  type VisitedMap,
} from '@/services/storage';
import { watchPosition, type Reading } from '@/services/location';
import { TOTAL_CELLS } from '@/features/map/grid';
import {
  DEMO_ROUTE,
  DEMO_START_CELL,
  INITIAL_EXPLORED,
  geoToCell,
} from '@/features/explore/data';

/** Coordinates with accuracy worse than this (meters) are dropped (FR-9). */
const ACCURACY_LIMIT_M = 50;
/** Cumulative dwell in the same cell before it counts as visited (FR-11). */
const DWELL_THRESHOLD_MS = 20_000;
/** Demo walk cadence — one cell colored per tick. */
const DEMO_STEP_MS = 720;
const TOAST_MS = 1200;

export type ExploreState = {
  hydrated: boolean;
  visited: VisitedMap;
  walking: boolean;
  tracking: boolean;
  toast: string | null;
  /** Cell the user/dot is currently on (drives the location dot). */
  dotCell: number;
  dayStreak: number;
};

type Listener = () => void;

let state: ExploreState = {
  hydrated: false,
  visited: {},
  walking: false,
  tracking: false,
  toast: null,
  dotCell: DEMO_START_CELL,
  dayStreak: 4,
};

const listeners = new Set<Listener>();

function set(patch: Partial<ExploreState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

function subscribe(l: Listener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

function getSnapshot(): ExploreState {
  return state;
}

// ---- timers & accumulators (kept out of render state) ----
let demoTimer: ReturnType<typeof setInterval> | null = null;
let demoPos = 0;
let toastTimer: ReturnType<typeof setTimeout> | null = null;
let stopWatcher: (() => void) | null = null;
const dwell = new Map<number, number>(); // cellId -> accumulated ms
let lastReadingAt: number | null = null;

function flashToast(message: string) {
  if (toastTimer) clearTimeout(toastTimer);
  set({ toast: message });
  toastTimer = setTimeout(() => set({ toast: null }), TOAST_MS);
}

function dayKey(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10);
}

function persist() {
  void saveVisited(state.visited);
}

/** Mark a cell visited immediately (used by taps and the demo walk). */
function visitCell(id: number, opts: { toast?: boolean } = {}) {
  const now = Date.now();
  if (state.visited[id]) {
    set({ dotCell: id });
    return;
  }
  const visited: VisitedMap = {
    ...state.visited,
    [id]: { firstVisitedAt: now, lastVisitedAt: now },
  };
  set({ visited, dotCell: id });
  persist();
  if (opts.toast !== false) flashToast('New area uncovered · +1 ✦');
}

export const explore = {
  async hydrate() {
    if (state.hydrated) return;
    const [visited, meta] = await Promise.all([loadVisited(), loadMeta()]);
    // Seed the starter cluster the first time the user ever opens the app.
    let next = visited;
    if (Object.keys(visited).length === 0) {
      const now = Date.now();
      next = {};
      for (const id of INITIAL_EXPLORED) next[id] = { firstVisitedAt: now, lastVisitedAt: now };
      void saveVisited(next);
    }
    // Day streak bookkeeping.
    const today = dayKey(Date.now());
    let streak = meta.dayStreak || 0;
    if (meta.lastDayKey !== today) {
      streak = meta.lastDayKey ? streak + 1 : Math.max(streak, 1);
      void saveMeta({ lastDayKey: today, dayStreak: streak });
    }
    set({
      visited: next,
      hydrated: true,
      dayStreak: Math.max(streak, 4),
      dotCell: INITIAL_EXPLORED.includes(state.dotCell) ? state.dotCell : DEMO_START_CELL,
    });
  },

  /** Tap-to-color (prototype lets you tap fog to uncover it). */
  tapCell(id: number) {
    if (!state.visited[id]) visitCell(id);
  },

  /** Feed a real GPS reading through the accuracy filter + dwell accumulator. */
  feedReading(reading: Reading) {
    if (reading.accuracy > ACCURACY_LIMIT_M) return; // FR-9
    const cell = geoToCell(reading.lat, reading.lng);
    if (cell == null) return;
    set({ dotCell: cell });
    if (state.visited[cell]) return;

    const now = reading.timestamp || Date.now();
    const dt = lastReadingAt == null ? 0 : Math.min(now - lastReadingAt, 5000);
    lastReadingAt = now;
    // Accumulate dwell on the current cell; other cells keep their tallies so a
    // brief jitter away and back doesn't reset progress (FR-13).
    const acc = (dwell.get(cell) ?? 0) + dt;
    dwell.set(cell, acc);
    if (acc >= DWELL_THRESHOLD_MS) {
      dwell.delete(cell);
      visitCell(cell);
    }
  },

  toggleWalk() {
    if (state.walking) {
      explore.stopWalk();
    } else {
      explore.startWalk();
    }
  },

  startWalk() {
    if (state.walking) return;
    if (demoPos >= DEMO_ROUTE.length) demoPos = 0;
    set({ walking: true });
    demoTimer = setInterval(() => {
      if (demoPos >= DEMO_ROUTE.length) {
        explore.stopWalk();
        set({ toast: null });
        return;
      }
      const id = DEMO_ROUTE[demoPos];
      demoPos += 1;
      visitCell(id);
    }, DEMO_STEP_MS);
  },

  stopWalk() {
    if (demoTimer) {
      clearInterval(demoTimer);
      demoTimer = null;
    }
    set({ walking: false });
  },

  /** Whether the scripted demo route still has cells left to play. */
  get walkExhausted() {
    return demoPos >= DEMO_ROUTE.length;
  },

  /** Begin real foreground GPS tracking (FR-8). Safe to call repeatedly. */
  async startTracking() {
    if (stopWatcher) return;
    try {
      stopWatcher = await watchPosition((r) => explore.feedReading(r));
      set({ tracking: true });
    } catch {
      set({ tracking: false });
    }
  },

  stopTracking() {
    if (stopWatcher) {
      stopWatcher();
      stopWatcher = null;
    }
    lastReadingAt = null;
    set({ tracking: false });
  },

  reset() {
    explore.stopWalk();
    demoPos = 0;
    dwell.clear();
    lastReadingAt = null;
    const now = Date.now();
    const seeded: VisitedMap = {};
    for (const id of INITIAL_EXPLORED) seeded[id] = { firstVisitedAt: now, lastVisitedAt: now };
    set({ visited: seeded, dotCell: DEMO_START_CELL, toast: null });
    void clearVisited();
    void saveVisited(seeded);
  },
};

// ---- React bindings ----
export function useExplore(): ExploreState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export type ExploreStats = {
  exploredCount: number;
  total: number;
  pct: number;
  pctLabel: string;
  distKm: string;
  hoods: number;
  dayStreak: number;
};

export function selectStats(s: ExploreState): ExploreStats {
  const exploredCount = Object.keys(s.visited).length;
  const total = TOTAL_CELLS;
  const pct = Math.min(100, (exploredCount / total) * 100);
  return {
    exploredCount,
    total,
    pct,
    pctLabel: pct.toFixed(1),
    distKm: (exploredCount * 0.045).toFixed(1),
    hoods: Math.max(1, Math.ceil(exploredCount / 9)),
    dayStreak: s.dayStreak,
  };
}
