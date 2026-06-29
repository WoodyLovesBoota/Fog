/**
 * Module-level pub/sub bridge between the location ingest pipeline and the UI.
 *
 * The background location task and the foreground fallback watcher both funnel
 * through one ingest function ({@link ingestLocations}). That function is the
 * single source of truth — it accumulates dwell, writes the visited set, and
 * tallies distance to storage. But while the app is *alive* (foreground, or
 * backgrounded-but-not-killed), the task runs in the app's own JS context, so a
 * plain module singleton is shared with the React tree. That lets the map react
 * live — paint the freshly-cleared cell, flash a toast, pop the collect modal —
 * without polling storage.
 *
 * When the app has been killed and the OS relaunches it headless to deliver a
 * background batch, there simply are no subscribers; ingest still persists
 * everything, and the map repaints from storage when it next becomes active.
 */

export interface FixEvent {
  lat: number;
  lng: number;
  cellId: string;
  accuracy: number;
  timestamp: number;
}

type FixListener = (e: FixEvent) => void;
type VisitedListener = (cellId: string) => void;

const fixListeners = new Set<FixListener>();
const visitedListeners = new Set<VisitedListener>();

export const locationEvents = {
  /** Subscribe to every accepted fix. Returns an unsubscribe fn. */
  onFix(fn: FixListener): () => void {
    fixListeners.add(fn);
    return () => fixListeners.delete(fn);
  },
  /** Subscribe to cells the moment they cross the dwell threshold. */
  onVisited(fn: VisitedListener): () => void {
    visitedListeners.add(fn);
    return () => visitedListeners.delete(fn);
  },
  emitFix(e: FixEvent): void {
    fixListeners.forEach((fn) => fn(e));
  },
  emitVisited(cellId: string): void {
    visitedListeners.forEach((fn) => fn(cellId));
  },
};
