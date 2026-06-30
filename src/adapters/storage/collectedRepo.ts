import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * AsyncStorage persistence for the set of COLLECTED landmark ids (Step 6).
 *
 * Deliberately separate from the visited-cell fog store: collection is judged by
 * coordinate proximity, not by which fog cells have cleared, so the two are
 * independent axes. Persisting only the ids keeps the discovered set tiny and
 * survives app restarts, so collected pins stay revealed across launches.
 */
const KEY = 'fog.collectedLandmarks.v1';

/** The ids collected so far. Empty array if nothing collected / on any error. */
export async function loadCollected(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
}

/**
 * Union the given ids into the stored set (idempotent: re-adding an already
 * collected id is a no-op, and a no-op write is skipped). Load → merge → save so
 * a headless write doesn't clobber ids collected in another context.
 */
export async function addCollected(ids: string[]): Promise<void> {
  if (!ids.length) return;
  try {
    const set = new Set(await loadCollected());
    const before = set.size;
    ids.forEach((id) => set.add(id));
    if (set.size === before) return; // nothing new
    await AsyncStorage.setItem(KEY, JSON.stringify([...set]));
  } catch {
    // Best-effort; a dropped write just re-fires the discovery next time in range.
  }
}
