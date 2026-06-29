import * as Location from 'expo-location';

import {
  BG_DISTANCE_M,
  BG_DEFERRED_MS,
  LOCATION_TIME_INTERVAL_MS,
  LOCATION_DISTANCE_M,
} from '@/config/explorationConfig';
import { ingestLocations, resetIngestAnchor } from '@/background/ingest';
import { BG_LOCATION_TASK } from '@/background/locationTask';

/**
 * Tracking control for Step 5. Two mutually-exclusive drivers feed the one
 * {@link ingestLocations} pipeline; exactly one runs at a time, so there is
 * never double counting:
 *
 *  - `background`  — `startLocationUpdatesAsync` delivers to BG_LOCATION_TASK in
 *                    both foreground and background. Requires "Always" location.
 *  - `foreground`  — fallback `watchPositionAsync` for when the user grants only
 *                    "When In Use". Tracks while the app is open; nothing in the
 *                    background. No OS task started, so it can't collide.
 */
export type TrackingResult = 'ok' | 'denied' | 'foreground-only';

let foregroundSub: Location.LocationSubscription | null = null;

/**
 * Request permissions and start the background task if "Always" was granted.
 * Returns:
 *  - 'ok'             → background tracking is running
 *  - 'foreground-only'→ only "When In Use"; caller should start the fallback
 *  - 'denied'         → no location access at all
 */
export async function enableBackgroundTracking(): Promise<TrackingResult> {
  const fg = await Location.requestForegroundPermissionsAsync();
  if (fg.status !== 'granted') return 'denied';

  // iOS/Android may grant only "When In Use" — that's a foreground-only world.
  const bg = await Location.requestBackgroundPermissionsAsync();
  if (bg.status !== 'granted') return 'foreground-only';

  const already = await Location.hasStartedLocationUpdatesAsync(BG_LOCATION_TASK);
  if (!already) {
    resetIngestAnchor();
    await Location.startLocationUpdatesAsync(BG_LOCATION_TASK, {
      accuracy: Location.Accuracy.Balanced,
      distanceInterval: BG_DISTANCE_M,
      deferredUpdatesInterval: BG_DEFERRED_MS,
      pausesUpdatesAutomatically: false,
      activityType: Location.ActivityType.Fitness,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: '탐험 기록 중',
        notificationBody: '지나간 곳을 지도에 기록하고 있어요',
      },
    });
  }
  return 'ok';
}

/** Stop the background task (e.g. when the user pauses tracking). */
export async function disableBackgroundTracking(): Promise<void> {
  if (await Location.hasStartedLocationUpdatesAsync(BG_LOCATION_TASK)) {
    await Location.stopLocationUpdatesAsync(BG_LOCATION_TASK);
  }
  resetIngestAnchor();
}

/**
 * Foreground-only fallback driver: a plain `watchPositionAsync` feeding the same
 * ingest pipeline. distanceInterval 0 + a short timeInterval so standing-still
 * dwell still works while the screen is open. Safe to call repeatedly.
 */
export async function startForegroundFallback(): Promise<void> {
  if (foregroundSub) return;
  resetIngestAnchor();
  foregroundSub = await Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.High,
      timeInterval: LOCATION_TIME_INTERVAL_MS,
      distanceInterval: LOCATION_DISTANCE_M,
    },
    (loc) => {
      void ingestLocations([loc]);
    },
  );
}

export function stopForegroundFallback(): void {
  foregroundSub?.remove();
  foregroundSub = null;
  resetIngestAnchor();
}
