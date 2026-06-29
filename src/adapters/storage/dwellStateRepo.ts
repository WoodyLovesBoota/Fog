import AsyncStorage from '@react-native-async-storage/async-storage';

import { type DwellState, emptyDwellState } from '@/core/exploration/dwellReducer';

/**
 * AsyncStorage persistence for the serialized {@link DwellState}.
 *
 * This is the in-progress, not-yet-visited accumulation — distinct from the
 * confirmed visited set (AsyncVisitedRepository) and the derived stats blob.
 * The background task loads → folds new fixes → saves on every invocation, so
 * dwell progress survives the task's context being torn down between bursts.
 */
const KEY = 'fog.dwellState.v1';

export async function loadDwellState(): Promise<DwellState> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return emptyDwellState();
    const parsed = JSON.parse(raw) as Partial<DwellState>;
    // Defend against a partial/corrupt blob — fall back to the empty shape.
    return {
      accumByCell: parsed.accumByCell ?? {},
      prevCell: parsed.prevCell ?? null,
      lastTime: parsed.lastTime ?? null,
    };
  } catch {
    return emptyDwellState();
  }
}

export async function saveDwellState(state: DwellState): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Best-effort; a dropped write just loses a little dwell progress.
  }
}

export async function clearDwellState(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
