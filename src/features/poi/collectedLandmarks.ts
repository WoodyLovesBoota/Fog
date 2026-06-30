import { type Landmark } from '@/features/poi/landmarks';

/**
 * Derives "which landmarks have I collected?" from the persisted collected-id
 * set (see `collectedRepo`). Collection is judged by coordinate proximity
 * (Step 6), so the source of truth is a set of landmark ids — NOT the fog cells.
 *
 * Pure: no React, no storage, no map. Screens load the collected ids and run
 * them through here.
 */

export type LandmarkWithStatus = Landmark & {
  /** True once this landmark has been discovered (within range at least once). */
  collected: boolean;
};

/** Coerce an id iterable to a Set once, so repeated lookups are O(1). */
function toSet(ids: Iterable<string>): Set<string> {
  return ids instanceof Set ? ids : new Set(ids);
}

/**
 * Annotate every landmark with its collected flag, given the set of collected
 * ids. Order is preserved from the input list.
 */
export function annotateLandmarks(
  landmarks: Landmark[],
  collectedIds: Iterable<string>,
): LandmarkWithStatus[] {
  const collected = toSet(collectedIds);
  return landmarks.map((l) => ({ ...l, collected: collected.has(l.id) }));
}

/** How many of the given landmarks have been collected. */
export function countCollected(
  landmarks: Landmark[],
  collectedIds: Iterable<string>,
): number {
  const collected = toSet(collectedIds);
  let n = 0;
  for (const l of landmarks) if (collected.has(l.id)) n += 1;
  return n;
}
