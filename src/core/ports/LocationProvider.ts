/**
 * Port: a source of location fixes.
 *
 * The exploration core never talks to the phone GPS (or, later, the watch GPS)
 * directly — it only depends on this interface. Any concrete source (phone,
 * watch, a recorded test track) implements `LocationProvider` and the core is
 * none the wiser. This is the seam that keeps the engine RN-free and testable.
 */

export interface LocationFix {
  lat: number;
  lng: number;
  /** Horizontal accuracy in meters. */
  accuracy: number;
  /** Milliseconds since epoch. */
  timestamp: number;
}

export interface LocationProvider {
  /** Begin streaming fixes to `onFix`. Resolves once the stream is wired up. */
  start(onFix: (fix: LocationFix) => void): Promise<void>;
  /** Stop streaming and release any underlying subscription. */
  stop(): void;
}
