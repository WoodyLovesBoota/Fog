import { haversineMeters } from '@/core/exploration/distance';
import type { Landmark } from '@/features/poi/landmarks';

/**
 * Pure proximity-discovery logic (Step 6). No React, no storage, no map.
 *
 * A landmark is DISCOVERED (≡ collected) when a location fix lands within
 * {@link import('@/config/explorationConfig').DISCOVERY_RADIUS_M} of its real
 * coordinate. This is judged against the landmark's exact lat/lng, NOT the fog
 * cell it sits in: a ~125m cell would let you "discover" a place from a block
 * away, which the design explicitly forbids.
 *
 * Identical for all 100 landmarks — anchors and hidden ones are collected the
 * same way; the only difference (anchor = drawn from launch) lives elsewhere.
 */

/**
 * The landmarks newly discovered by this fix: every one not already collected
 * whose coordinate is within `radiusM`. Returns `[]` when nothing is in range,
 * so callers can cheaply bail. A dense area can return several at once — the
 * caller is responsible for showing those, not dropping them.
 *
 * Returns the landmark objects (not just ids) so the caller can render them
 * without a second scan to recover each from its id.
 */
export function newlyDiscovered(
  fix: { lat: number; lng: number },
  landmarks: Landmark[],
  collected: ReadonlySet<string>,
  radiusM: number,
): Landmark[] {
  const found: Landmark[] = [];
  for (const lm of landmarks) {
    if (collected.has(lm.id)) continue;
    if (haversineMeters(fix.lat, fix.lng, lm.lat, lm.lng) <= radiusM) {
      found.push(lm);
    }
  }
  return found;
}
