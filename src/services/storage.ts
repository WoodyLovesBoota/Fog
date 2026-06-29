import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Local persistence for visited cells (FR-6: colored cells survive relaunch).
 * MVP keeps everything on-device — no account, no cloud (NFR-5).
 *
 * We store only the set of visited cell ids plus a first/last timestamp,
 * which is all the data model in the PRD requires.
 */

const KEY = 'fog.visitedCells.v1';
const META_KEY = 'fog.meta.v1';

export type VisitedRecord = { firstVisitedAt: number; lastVisitedAt: number };
export type VisitedMap = Record<number, VisitedRecord>;

export type ExploreMeta = {
  /** Rough distance walked in km (derived from cell count in the prototype). */
  lastDayKey: string | null;
  dayStreak: number;
};

export async function loadVisited(): Promise<VisitedMap> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') return parsed as VisitedMap;
    return {};
  } catch {
    return {};
  }
}

export async function saveVisited(map: VisitedMap): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(map));
  } catch {
    // Best-effort; tracking still works in-memory if disk write fails.
  }
}

export async function clearVisited(): Promise<void> {
  try {
    await AsyncStorage.multiRemove([KEY, META_KEY]);
  } catch {
    // ignore
  }
}

export async function loadMeta(): Promise<ExploreMeta> {
  try {
    const raw = await AsyncStorage.getItem(META_KEY);
    if (raw) return JSON.parse(raw) as ExploreMeta;
  } catch {
    // ignore
  }
  return { lastDayKey: null, dayStreak: 0 };
}

export async function saveMeta(meta: ExploreMeta): Promise<void> {
  try {
    await AsyncStorage.setItem(META_KEY, JSON.stringify(meta));
  } catch {
    // ignore
  }
}
