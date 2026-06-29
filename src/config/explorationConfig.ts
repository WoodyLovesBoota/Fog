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

// ---- Background tracking (Step 5) -----------------------------------------

/**
 * Largest gap between two consecutive fixes that still counts toward dwell.
 * Background location is bursty: the OS may sleep for minutes and then deliver
 * a batch. Crediting that whole gap to one cell would falsely "paint" wherever
 * you happened to stop. Anything longer than this is treated as a blank — the
 * time is dropped, not accumulated. (See {@link applyFix}.)
 */
export const MAX_DWELL_GAP_MS = 5 * 60 * 1000;

/**
 * Background distance filter (meters). Unlike the foreground watch this is
 * non-zero on purpose: in the background we can't afford a fix every few
 * seconds. Standing-still dwell still works because the *gap* until the next
 * move-triggered fix is credited to the cell you were sitting in.
 */
export const BG_DISTANCE_M = 10;

/**
 * Battery saver: the OS may batch background fixes and deliver them at most
 * this often, instead of waking the JS task on every single update.
 */
export const BG_DEFERRED_MS = 10_000;

/**
 * A jump larger than this between two accepted fixes is GPS noise / a teleport
 * after a long sleep, not real walking — so it's excluded from distance.
 */
export const MAX_STEP_M = 100;
