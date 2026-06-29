import { DWELL_THRESHOLD_MS } from '../../config/explorationConfig';

/**
 * Pure dwell accumulator with jitter defense.
 *
 * The trick: when a new fix arrives, the elapsed time since the previous fix is
 * credited to the cell we were *in during that interval* (`prevCell`), not the
 * cell we just landed on. So a GPS reading that briefly jumps to a neighboring
 * cell and back only ever credits that neighbor a tiny `dt`, which never
 * reaches the threshold. Standing still in one real cell, by contrast, keeps
 * crediting that one cell until it crosses the line and is marked visited.
 *
 * No React Native, no clocks of its own — time is supplied by the caller, which
 * makes the whole thing deterministic and unit-testable.
 */
export class DwellTracker {
  private accumByCell = new Map<string, number>();
  private visited = new Set<string>();
  private prevCell: string | null = null;
  private lastTime: number | null = null;

  /**
   * Feed one fix's (cell, timestamp). Returns the cell id if *this* call is the
   * moment it first crosses the dwell threshold, otherwise null.
   */
  push(cellId: string, timestamp: number): string | null {
    let newlyVisited: string | null = null;

    if (this.lastTime != null && this.prevCell != null) {
      const dt = timestamp - this.lastTime;
      if (dt > 0) {
        // Credit the interval to the cell we were sitting in, not the new one.
        const accum = (this.accumByCell.get(this.prevCell) ?? 0) + dt;
        this.accumByCell.set(this.prevCell, accum);
        if (accum >= DWELL_THRESHOLD_MS && !this.visited.has(this.prevCell)) {
          this.visited.add(this.prevCell);
          newlyVisited = this.prevCell;
        }
      }
    }

    this.lastTime = timestamp;
    this.prevCell = cellId;
    return newlyVisited;
  }

  isVisited(cellId: string): boolean {
    return this.visited.has(cellId);
  }
}
