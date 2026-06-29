import { fixToCell } from '@/core/exploration/h3';
import { type Landmark } from '@/features/poi/landmarks';

/**
 * Derives "which landmarks have I collected?" from the existing fog-of-war
 * progress — there is no separate collection store. A landmark counts as
 * COLLECTED once the H3 cell containing it has been uncovered (added to the
 * visited set in `AsyncVisitedRepository`).
 *
 * Pure: no React, no storage, no map. The screen loads the visited cells and
 * runs them through here.
 */

export type LandmarkWithStatus = Landmark & {
  /** H3 cell this landmark sits in (at the app's exploration resolution). */
  cellId: string;
  /** True once that cell has been uncovered. */
  collected: boolean;
};

/** The H3 cell a landmark falls in, at the configured exploration resolution. */
export function landmarkCell(l: Landmark): string {
  return fixToCell(l.lat, l.lng);
}

/**
 * Annotate every landmark with its cell + collected flag, given the set of
 * uncovered cells. Order is preserved from the input list.
 */
export function annotateLandmarks(
  landmarks: Landmark[],
  visitedCells: Iterable<string>,
): LandmarkWithStatus[] {
  const visited = visitedCells instanceof Set ? visitedCells : new Set(visitedCells);
  return landmarks.map((l) => {
    const cellId = landmarkCell(l);
    return { ...l, cellId, collected: visited.has(cellId) };
  });
}

/** Just the collected landmarks, in input order. */
export function selectCollected(
  landmarks: Landmark[],
  visitedCells: Iterable<string>,
): LandmarkWithStatus[] {
  return annotateLandmarks(landmarks, visitedCells).filter((l) => l.collected);
}

/** How many of the given landmarks have been collected. */
export function countCollected(
  landmarks: Landmark[],
  visitedCells: Iterable<string>,
): number {
  const visited = visitedCells instanceof Set ? visitedCells : new Set(visitedCells);
  let n = 0;
  for (const l of landmarks) if (visited.has(landmarkCell(l))) n += 1;
  return n;
}
