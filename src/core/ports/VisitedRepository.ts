/**
 * Port: durable storage for the set of visited H3 cell ids.
 *
 * Like {@link LocationProvider}, the exploration core never reaches for
 * AsyncStorage (or MMKV, or a remote sync endpoint) directly — it depends only
 * on this interface. The phone app wires in a concrete adapter; a watch sync
 * layer could later implement the same two methods and nothing in the core or
 * the map screen would move.
 *
 * Cell ids are H3 strings at the configured resolution (see explorationConfig).
 */
export interface VisitedRepository {
  /** Load every previously-visited cell id. Empty array on a fresh install. */
  load(): Promise<string[]>;
  /**
   * Union the given cell ids into the stored set (idempotent). Designed so a
   * future watch sync can dump a batch in without clobbering phone progress.
   */
  add(cellIds: string[]): Promise<void>;
  /** Wipe all stored progress (the map's reset button). */
  clear(): Promise<void>;
}
