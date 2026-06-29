import AsyncStorage from '@react-native-async-storage/async-storage';

import type { VisitedRepository } from '@/core/ports/VisitedRepository';

/**
 * AsyncStorage-backed {@link VisitedRepository}: visited H3 cells survive a
 * relaunch (FR-6), stored on-device only (NFR-5). MVP keeps this dead simple —
 * a JSON array of cell id strings under one key.
 *
 * Distinct from the prototype grid store in `services/storage.ts` (which is
 * keyed by numeric grid ids). This one owns the *geographic* H3 cell set used
 * by the real map. To move to MMKV later, implement the same interface with
 * `mmkv.getString/set` — no other file changes.
 */
const KEY = 'fog.visitedCells.h3.v1';

export class AsyncVisitedRepository implements VisitedRepository {
  async load(): Promise<string[]> {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as string[]) : [];
    } catch {
      // Corrupt/unreadable store shouldn't crash startup; treat as empty.
      return [];
    }
  }

  async add(cellIds: string[]): Promise<void> {
    if (cellIds.length === 0) return;
    try {
      const set = new Set(await this.load());
      cellIds.forEach((c) => set.add(c)); // union — safe for batch/watch sync
      await AsyncStorage.setItem(KEY, JSON.stringify([...set]));
    } catch {
      // Best-effort persistence; in-memory tracking still works if disk fails.
    }
  }

  async clear(): Promise<void> {
    try {
      await AsyncStorage.removeItem(KEY);
    } catch {
      // ignore
    }
  }
}
