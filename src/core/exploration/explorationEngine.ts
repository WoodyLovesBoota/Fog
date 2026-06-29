import { MAX_ACCURACY_M } from '../../config/explorationConfig';
import type { LocationProvider, LocationFix } from '../ports/LocationProvider';
import { DwellTracker } from './dwellTracker';
import { fixToCell } from './h3';

/**
 * The exploration "engine": wires a LocationProvider stream through the
 * accuracy filter, H3 conversion, and dwell tracker, emitting a callback the
 * first time a cell becomes "visited".
 *
 * It depends only on the LocationProvider *port* and pure helpers — no RN, no
 * expo-location, no map. Swap in a watch provider later and nothing here moves.
 */
export class ExplorationEngine {
  private tracker = new DwellTracker();

  constructor(
    private provider: LocationProvider,
    private onVisited: (cellId: string) => void,
    /** Optional per-fix hook, handy for console verification. */
    private onFix?: (info: { cellId: string; accuracy: number }) => void,
  ) {}

  async start(): Promise<void> {
    await this.provider.start((fix: LocationFix) => {
      if (fix.accuracy > MAX_ACCURACY_M) return; // drop noisy fixes
      const cell = fixToCell(fix.lat, fix.lng);
      this.onFix?.({ cellId: cell, accuracy: fix.accuracy });
      const visited = this.tracker.push(cell, fix.timestamp);
      if (visited) this.onVisited(visited);
    });
  }

  stop(): void {
    this.provider.stop();
  }
}
