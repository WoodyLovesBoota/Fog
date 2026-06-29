import * as Location from 'expo-location';

import {
  LOCATION_TIME_INTERVAL_MS,
  LOCATION_DISTANCE_M,
} from '@/config/explorationConfig';
import type { LocationProvider, LocationFix } from '@/core/ports/LocationProvider';

/**
 * Phone GPS implementation of the LocationProvider port (Expo / foreground).
 *
 * This is the only place in the exploration path that touches expo-location.
 * The core engine sees the `LocationProvider` interface and nothing else, so a
 * future watch-GPS adapter drops in with no changes upstream.
 */
export class PhoneLocationProvider implements LocationProvider {
  private sub: Location.LocationSubscription | null = null;

  async start(onFix: (fix: LocationFix) => void): Promise<void> {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') throw new Error('Location permission denied');

    this.sub = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: LOCATION_TIME_INTERVAL_MS,
        distanceInterval: LOCATION_DISTANCE_M,
      },
      (loc) =>
        onFix({
          lat: loc.coords.latitude,
          lng: loc.coords.longitude,
          accuracy: loc.coords.accuracy ?? 9999,
          timestamp: loc.timestamp,
        }),
    );
  }

  stop(): void {
    this.sub?.remove();
    this.sub = null;
  }
}
