import { DWELL_THRESHOLD_MS, MAX_DWELL_GAP_MS } from '../../config/explorationConfig';

/**
 * Serializable dwell accumulator for the background location pipeline.
 *
 * The background location task runs in a short-lived, often headless JS context
 * that is spun up per batch and torn down again, with no shared memory between
 * invocations. So the entire dwell state has to be plain JSON that we load →
 * fold the new fixes in → save, every time the task fires.
 *
 * The jitter-defense trick: the elapsed time since the previous fix is credited
 * to the cell we were *in during that interval* (`prevCell`), not the cell we
 * just landed on. The one addition for the background world is
 * {@link MAX_DWELL_GAP_MS}: a gap longer than that is a sleep, not dwell, and its
 * time is discarded instead of dumped onto one cell.
 */
export interface DwellState {
  /** cell id → accumulated dwell ms, for cells not yet visited. */
  accumByCell: Record<string, number>;
  /** The cell occupied during the interval ending at `lastTime`. */
  prevCell: string | null;
  /** Timestamp (ms epoch) of the most recent fix folded in. */
  lastTime: number | null;
}

export const emptyDwellState = (): DwellState => ({
  accumByCell: {},
  prevCell: null,
  lastTime: null,
});

/**
 * Pure fold of one already-cell-mapped fix into the dwell state. `visited` is
 * the set of cells already cleared (loaded from storage) so a cell never
 * re-fires after a relaunch. Returns the next state plus the cell id if *this*
 * fix is the moment a cell first crosses the dwell threshold.
 */
export function applyFix(
  state: DwellState,
  cellId: string,
  timestamp: number,
  visited: Set<string>,
): { state: DwellState; newlyVisited: string | null } {
  let newlyVisited: string | null = null;
  const next: DwellState = { ...state, accumByCell: { ...state.accumByCell } };

  if (state.lastTime != null && state.prevCell != null) {
    const dt = timestamp - state.lastTime;
    // A huge dt is a background sleep, not real dwell — drop it (don't pile the
    // whole gap onto one cell). A non-positive dt is an out-of-order fix.
    if (dt > 0 && dt <= MAX_DWELL_GAP_MS) {
      const accum = (state.accumByCell[state.prevCell] ?? 0) + dt;
      next.accumByCell[state.prevCell] = accum;
      if (accum >= DWELL_THRESHOLD_MS && !visited.has(state.prevCell)) {
        newlyVisited = state.prevCell;
        // Confirmed cells leave the accumulator so the state stays small.
        delete next.accumByCell[state.prevCell];
      }
    }
  }

  next.lastTime = timestamp;
  next.prevCell = cellId;
  return { state: next, newlyVisited };
}
