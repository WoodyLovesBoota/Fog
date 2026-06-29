import AsyncStorage from '@react-native-async-storage/async-storage';
import { OfflineManager } from '@maplibre/maplibre-react-native';

import {
  MAP_STYLE_URL,
  SG_BOUNDS_SW,
  SG_BOUNDS_NE,
  OFFLINE_MIN_ZOOM,
  OFFLINE_MAX_ZOOM,
  OFFLINE_PACK_KEY,
} from '@/config/mapConfig';

/**
 * One-time offline download of the Singapore tile pack. Once it completes the
 * map renders entirely from the on-device cache — zero runtime tile calls, so
 * no billing risk and full airplane-mode operation (NFR: works offline).
 */

export type DownloadState =
  | { status: 'idle' | 'done' }
  | { status: 'downloading'; progress: number }
  | { status: 'error'; message: string };

/** We persist a tiny "done" flag so we never re-download on later launches. */
const DONE_FLAG_KEY = `fog.offlinePack.${OFFLINE_PACK_KEY}`;

async function isPackDownloaded(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(DONE_FLAG_KEY)) === '1';
  } catch {
    return false;
  }
}

async function markPackDownloaded(): Promise<void> {
  try {
    await AsyncStorage.setItem(DONE_FLAG_KEY, '1');
  } catch {
    // Best-effort: a write failure just means we may re-check the pack later.
  }
}

/**
 * Ensure the Singapore pack exists locally, reporting progress through `onState`.
 *
 * Verified against @maplibre/maplibre-react-native v11.3.6:
 *  - `OfflineManager` is a named export (no default `MapLibreGL`).
 *  - createPack options use `mapStyle` (not `styleURL`); the pack id is
 *    auto-generated, so there is no `name` field — we tag it via `metadata`.
 *  - `bounds` is a flat LngLatBounds: [west, south, east, north] (GeoJSON order).
 */
export async function ensureSingaporePack(
  onState: (s: DownloadState) => void,
): Promise<void> {
  if (await isPackDownloaded()) {
    onState({ status: 'done' });
    return;
  }

  onState({ status: 'downloading', progress: 0 });

  try {
    await OfflineManager.createPack(
      {
        mapStyle: MAP_STYLE_URL,
        minZoom: OFFLINE_MIN_ZOOM,
        maxZoom: OFFLINE_MAX_ZOOM,
        bounds: [SG_BOUNDS_SW[0], SG_BOUNDS_SW[1], SG_BOUNDS_NE[0], SG_BOUNDS_NE[1]],
        metadata: { key: OFFLINE_PACK_KEY },
      },
      (_pack, status) => {
        const pct = status.percentage;
        onState({ status: 'downloading', progress: pct });
        if (pct >= 100) {
          void markPackDownloaded();
          onState({ status: 'done' });
        }
      },
      (_pack, error) => {
        onState({ status: 'error', message: error.message });
      },
    );
  } catch (e) {
    onState({ status: 'error', message: String(e) });
  }
}
