/**
 * Tunables for the exploration "engine" (Step 2).
 *
 * These are deliberately framework-free constants so the pure exploration core
 * (`src/core/exploration/*`) can import them without dragging in React Native,
 * the map, or expo-location. The phone GPS adapter reads the watch cadence
 * values; the core reads the H3 / dwell / accuracy values.
 */

/** H3 cell resolution. 10 ≈ ~125m cell edge (good for walking); 11 is finer. */
export const H3_RESOLUTION = 10;

/** Cumulative time in the same cell before it counts as "visited". */
export const DWELL_THRESHOLD_MS = 20_000;

/** Horizontal accuracy (meters) worse than this means the fix is dropped. */
export const MAX_ACCURACY_M = 50;

/** Foreground watch cadence — emit at most one fix per this interval. */
export const LOCATION_TIME_INTERVAL_MS = 3_000;

/**
 * Foreground watch distance filter. MUST be 0: dwell detection needs fixes to
 * keep arriving while you stand still, but a non-zero distanceInterval tells
 * Android "don't report unless the user moves this far" — which starves the
 * dwell accumulator and VISITED never fires. 0 = purely time-based updates.
 */
export const LOCATION_DISTANCE_M = 0;
