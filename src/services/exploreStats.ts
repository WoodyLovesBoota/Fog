import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Derived exploration stats that aren't recoverable from the visited-cell set
 * alone: total distance walked and the consecutive-day exploration streak.
 *
 * Kept on-device next to the visited cells (NFR-5). Areas-colored is *not*
 * stored here — it's just the size of the visited set (AsyncVisitedRepository).
 */
const KEY = 'fog.stats.v1';

export type ExploreStatsData = {
  /** Total ground distance walked, in meters. */
  distanceM: number;
  /** Consecutive calendar days with at least one new area uncovered. */
  dayStreak: number;
  /** Local YYYY-MM-DD of the most recent exploration day, or null. */
  lastVisitDay: string | null;
};

export const EMPTY_STATS: ExploreStatsData = {
  distanceM: 0,
  dayStreak: 0,
  lastVisitDay: null,
};

/** Local calendar day key (YYYY-MM-DD) for a timestamp. */
export function dayKey(ts: number): string {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Pure streak update applied when a new area is uncovered at time `now`:
 * same day → unchanged; the very next day → +1; any gap → reset to 1.
 */
export function bumpStreak(prev: ExploreStatsData, now: number): ExploreStatsData {
  const today = dayKey(now);
  if (prev.lastVisitDay === today) return prev;
  const yesterday = dayKey(now - 86_400_000);
  const dayStreak = prev.lastVisitDay === yesterday ? prev.dayStreak + 1 : 1;
  return { ...prev, dayStreak, lastVisitDay: today };
}

export async function loadStats(): Promise<ExploreStatsData> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return { ...EMPTY_STATS };
    const parsed = JSON.parse(raw);
    return { ...EMPTY_STATS, ...(parsed as Partial<ExploreStatsData>) };
  } catch {
    return { ...EMPTY_STATS };
  }
}

export async function saveStats(stats: ExploreStatsData): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(stats));
  } catch {
    // Best-effort; stats are non-critical.
  }
}

export async function clearStats(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
