import {
  MAX_ACCURACY_M,
  MAX_STEP_M,
} from '@/config/explorationConfig';
import { applyFix } from '@/core/exploration/dwellReducer';
import { fixToCell } from '@/core/exploration/h3';
import { haversineMeters } from '@/core/exploration/distance';
import { locationEvents } from '@/core/exploration/locationEvents';
import { loadDwellState, saveDwellState } from '@/adapters/storage/dwellStateRepo';
import { AsyncVisitedRepository } from '@/adapters/storage/VisitedRepository.async';
import { bumpStreak, loadStats, saveStats } from '@/services/exploreStats';

/**
 * Single ingest pipeline shared by the background location task and the
 * foreground fallback watcher (Step 5). Whichever driver is active — and only
 * one ever is at a time — hands its fixes here, so there is exactly one place
 * that accumulates dwell, writes the visited set, tallies distance, and bumps
 * the day streak. One pipeline ⇒ no double counting by construction.
 *
 * Everything it touches is persisted (dwell state, visited cells, stats), so it
 * works identically whether the app is alive or relaunched headless. When the
 * app *is* alive it also emits live events for the map to react to.
 */

/** Minimal shape of an expo-location fix — avoids importing RN into this seam. */
export interface IngestFix {
  coords: { latitude: number; longitude: number; accuracy: number | null };
  timestamp: number;
}

const visitedRepo = new AsyncVisitedRepository();

/**
 * Last accepted coordinate, kept in module memory to measure the step between
 * consecutive fixes for distance. It survives across task invocations while the
 * app is alive; a headless relaunch resets it to null, which at worst drops the
 * one step spanning that boundary — a negligible distance loss.
 */
let lastCoord: { lat: number; lng: number } | null = null;

/**
 * Serialization queue. Each ingest does an async load → mutate → save cycle, and
 * the foreground watcher fires one call *per fix*. Without serialization two
 * overlapping calls would both read the pre-update state and the later save
 * would clobber the earlier one, silently dropping dwell/distance. Chaining every
 * call onto a single promise guarantees one full cycle finishes before the next
 * begins. (The background task delivers batches, but this also covers the rare
 * case of two batches arriving back-to-back.)
 */
let queue: Promise<void> = Promise.resolve();

/**
 * Which driver is feeding the pipeline right now. While the app is in the
 * FOREGROUND a plain watchPositionAsync runs in this JS context and delivers
 * fixes promptly (live HUD + live fog); the always-on OS task, meanwhile, keeps
 * running for the background case but defers/withholds its batches while we're
 * open. If BOTH fed ingest at once we'd double-count distance/dwell — so the
 * foreground watcher sets this flag and the OS task skips ingesting while it's
 * set. A headless relaunch (app killed) starts with it false, so the OS task is
 * the sole driver there, exactly as intended.
 */
let foregroundDriverActive = false;

export function setForegroundDriverActive(active: boolean): void {
  foregroundDriverActive = active;
}

export function isForegroundDriverActive(): boolean {
  return foregroundDriverActive;
}

export function ingestLocations(locations: IngestFix[]): Promise<void> {
  // The `.catch` MUST be part of the stored chain: a rejected `queue` would make
  // the next `.then(onFulfilled)` skip its callback entirely, silently dropping
  // every subsequent batch. Catching here keeps the chain perpetually resolved.
  queue = queue.then(() => ingestLocationsSerial(locations)).catch((e) => {
    console.warn('ingest failed', e);
  });
  return queue;
}

async function ingestLocationsSerial(locations: IngestFix[]): Promise<void> {
  if (!locations.length) return;

  // Load the current persisted state once for the whole batch.
  const [state0, visitedArr, stats0] = await Promise.all([
    loadDwellState(),
    visitedRepo.load(),
    loadStats(),
  ]);

  let state = state0;
  let stats = stats0;
  const visited = new Set(visitedArr);
  const newCells: string[] = [];

  for (const loc of locations) {
    const acc = loc.coords.accuracy ?? 9999;
    // Surface the raw fix to any live HUD *before* filtering, so "GPS alive but
    // too noisy" is visibly distinct from "no GPS at all".
    const accepted = acc <= MAX_ACCURACY_M;
    locationEvents.emitRawFix({ accuracy: acc, accepted, timestamp: loc.timestamp });
    if (!accepted) continue; // drop noisy fixes

    const lat = loc.coords.latitude;
    const lng = loc.coords.longitude;

    // Distance: credit the step from the previous accepted fix, ignoring GPS
    // teleports / post-sleep jumps larger than MAX_STEP_M.
    if (lastCoord) {
      const step = haversineMeters(lastCoord.lat, lastCoord.lng, lat, lng);
      if (step > 0 && step < MAX_STEP_M) {
        stats = { ...stats, distanceM: stats.distanceM + step };
      }
    }
    lastCoord = { lat, lng };

    const cell = fixToCell(lat, lng);
    const { state: nextState, newlyVisited } = applyFix(state, cell, loc.timestamp, visited);
    state = nextState;

    locationEvents.emitFix({ lat, lng, cellId: cell, accuracy: acc, timestamp: loc.timestamp });

    if (newlyVisited) {
      visited.add(newlyVisited);
      newCells.push(newlyVisited);
      stats = bumpStreak(stats, loc.timestamp);
      locationEvents.emitVisited(newlyVisited);
    }
  }

  await saveDwellState(state);
  if (newCells.length) await visitedRepo.add(newCells);
  await saveStats(stats);
}

/** Forget the cross-fix distance anchor (e.g. when tracking is paused). */
export function resetIngestAnchor(): void {
  lastCoord = null;
}
