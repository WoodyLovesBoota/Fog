import { AppState } from 'react-native';
import * as TaskManager from 'expo-task-manager';

import { ingestLocations, isForegroundDriverActive, type IngestFix } from './ingest';

/**
 * Background location task (Step 5). MUST be defined at module top level — when
 * the OS relaunches the app headless to deliver a batch, it looks the task up
 * by name in a fresh JS context, so registration can't live inside a component.
 * Importing this module once at app start (see app/_layout.tsx) is what wires it
 * up.
 *
 * The task is deliberately thin: all the real work (dwell, visited, distance,
 * stats, live events) lives in the shared {@link ingestLocations} pipeline, so
 * the background and foreground paths can never drift apart.
 */
export const BG_LOCATION_TASK = 'fog.bg-location-task';

interface LocationTaskData {
  locations?: IngestFix[];
}

TaskManager.defineTask(BG_LOCATION_TASK, async ({ data, error }) => {
  if (error) {
    console.warn('bg location task error', error.message);
    return;
  }
  // Avoid double-counting ONLY when we're truly in the foreground with the live
  // watcher running — then it's the driver and the OS task should stay quiet.
  // Gating on AppState (not just the flag) is the safety net: in the background
  // (or a headless relaunch) currentState is never 'active', so the OS task always
  // ingests — a stale flag can never silently swallow a real background walk.
  if (AppState.currentState === 'active' && isForegroundDriverActive()) return;
  const locations = (data as LocationTaskData | undefined)?.locations ?? [];
  if (!locations.length) return;
  try {
    await ingestLocations(locations);
  } catch (e) {
    console.warn('bg location ingest failed', e);
  }
});
