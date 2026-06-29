import * as Location from 'expo-location';

/**
 * Thin wrapper over expo-location so the rest of the app talks to one small
 * interface. MVP is foreground-only (A4 / FR-8): we watch position while the
 * map screen is mounted and the app is in the foreground.
 */

export type PermissionStatus = 'granted' | 'denied' | 'undetermined';

export type Reading = {
  lat: number;
  lng: number;
  /** Horizontal accuracy in meters (used by the store's accuracy filter). */
  accuracy: number;
  timestamp: number;
};

export type ReadingListener = (reading: Reading) => void;

function mapStatus(s: Location.PermissionStatus): PermissionStatus {
  if (s === Location.PermissionStatus.GRANTED) return 'granted';
  if (s === Location.PermissionStatus.DENIED) return 'denied';
  return 'undetermined';
}

export async function getPermission(): Promise<PermissionStatus> {
  const { status } = await Location.getForegroundPermissionsAsync();
  return mapStatus(status);
}

export async function requestPermission(): Promise<PermissionStatus> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  return mapStatus(status);
}

/** One-shot current position — used by the map's "recenter on me" button. */
export async function getCurrentPosition(): Promise<Reading> {
  const pos = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });
  return {
    lat: pos.coords.latitude,
    lng: pos.coords.longitude,
    accuracy: pos.coords.accuracy ?? 999,
    timestamp: pos.timestamp,
  };
}

/**
 * Instant best-effort fix from the OS location cache. Never waits on a fresh
 * GPS lock, so it returns in milliseconds (or `null` if the OS has nothing
 * cached). Used to center the map immediately on launch while a real fix is
 * still being acquired — avoids the "stuck on the default view" feeling.
 */
export async function getLastKnownPosition(): Promise<Reading | null> {
  const pos = await Location.getLastKnownPositionAsync();
  if (!pos) return null;
  return {
    lat: pos.coords.latitude,
    lng: pos.coords.longitude,
    accuracy: pos.coords.accuracy ?? 999,
    timestamp: pos.timestamp,
  };
}

/**
 * Subscribe to foreground position updates. Returns an async stop function.
 * Tuned for a balance of responsiveness and battery (NFR-1): ~3s / 10m.
 */
export async function watchPosition(onReading: ReadingListener): Promise<() => void> {
  const sub = await Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: 3000,
      distanceInterval: 10,
    },
    (pos) => {
      onReading({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy ?? 999,
        timestamp: pos.timestamp,
      });
    },
  );
  return () => sub.remove();
}
