import { PermissionsAndroid, Platform } from 'react-native';
import * as Location from 'expo-location';

import {
  LOCATION_TIME_INTERVAL_MS,
  LOCATION_DISTANCE_M,
  BG_DISTANCE_M,
} from '@/config/explorationConfig';
import { ingestLocations, resetIngestAnchor, setForegroundDriverActive } from '@/background/ingest';
import { BG_LOCATION_TASK } from '@/background/locationTask';

/**
 * Android 13+ (API 33) hides the foreground-service notification — our "탐험 기록
 * 중" indicator — unless POST_NOTIFICATIONS is granted, and some OEMs reap the
 * service sooner without a visible notification. Ask once before starting the
 * task; a denial doesn't block tracking, it just means no visible indicator.
 */
async function ensureNotificationPermission(): Promise<void> {
  if (Platform.OS !== 'android' || Platform.Version < 33) return;
  const perm = PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS;
  if (await PermissionsAndroid.check(perm)) return;
  await PermissionsAndroid.request(perm);
}

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
 *
 * Both drivers use HIGH accuracy + distanceInterval 0 so fixes keep arriving
 * even while standing still (dwell needs that) and pass the accuracy filter.
 */
export type TrackingResult = 'ok' | 'denied' | 'foreground-only';

let foregroundSub: Location.LocationSubscription | null = null;

/**
 * Request permissions and start the background task if "Always" was granted.
 */
export async function enableBackgroundTracking(): Promise<TrackingResult> {
  const fg = await Location.requestForegroundPermissionsAsync();
  if (fg.status !== 'granted') return 'denied';

  // iOS/Android may grant only "When In Use" — that's a foreground-only world.
  const bg = await Location.requestBackgroundPermissionsAsync();
  if (bg.status !== 'granted') return 'foreground-only';

  // The OS task runs as a foreground service; make sure its notification can show.
  await ensureNotificationPermission();

  const already = await Location.hasStartedLocationUpdatesAsync(BG_LOCATION_TASK);
  if (!already) {
    resetIngestAnchor();
    await Location.startLocationUpdatesAsync(BG_LOCATION_TASK, {
      accuracy: Location.Accuracy.High,
      // Background is distance-driven (battery): a fix every BG_DISTANCE_M of
      // movement, not every few seconds. Standing-still dwell still works because
      // applyFix credits the gap until the next move-triggered fix to the cell you
      // were sitting in (see dwellReducer / MAX_DWELL_GAP_MS).
      distanceInterval: BG_DISTANCE_M,
      // No deferredUpdatesInterval: Android holds deferred batches and flushes
      // them when the app next becomes visible — which lands exactly as the
      // foreground gate flips on, so the whole background walk would be dropped.
      // Deliver each fix promptly instead, so cells clear *while* you walk away.
      pausesUpdatesAutomatically: false,
      activityType: Location.ActivityType.Fitness,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: '탐험 기록 중',
        notificationBody: '지나간 곳을 지도에 기록하고 있어요',
        // Stop the service (and clear its notification) when the app is swiped
        // from recents. onTaskRemoved only fires on a true kill, NOT on lock /
        // app-switch — so backgrounding keeps recording, but fully closing the
        // app removes the "탐험 기록 중" notification and ends tracking.
        killServiceOnDestroy: true,
      },
    });
  }
  return 'ok';
}

/**
 * Whether the OS background location task is currently registered & running.
 * `startLocationUpdatesAsync` persists at the OS level across app restarts, so
 * this can return true on a fresh launch — the screen uses it to reconcile its
 * "off"-by-default UI with a task that's actually still recording.
 */
export async function isBackgroundTrackingActive(): Promise<boolean> {
  return Location.hasStartedLocationUpdatesAsync(BG_LOCATION_TASK);
}

/** Stop the background task (e.g. when the user pauses tracking). */
export async function disableBackgroundTracking(): Promise<void> {
  if (await Location.hasStartedLocationUpdatesAsync(BG_LOCATION_TASK)) {
    await Location.stopLocationUpdatesAsync(BG_LOCATION_TASK);
  }
  resetIngestAnchor();
}

/**
 * Live foreground driver: a plain `watchPositionAsync` feeding the same ingest
 * pipeline. High accuracy + distanceInterval 0 so fixes keep arriving (even while
 * standing still) and the HUD/fog update promptly while the screen is open — the
 * always-on OS task defers its batches in the foreground, so without this the fog
 * wouldn't move as you walk with the app open. Marks itself the active driver so
 * the OS task skips ingesting and never double-counts. Safe to call repeatedly.
 */
export async function startForegroundFallback(): Promise<void> {
  setForegroundDriverActive(true);
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
  setForegroundDriverActive(false);
  foregroundSub?.remove();
  foregroundSub = null;
  resetIngestAnchor();
}
