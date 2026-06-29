import { latLngToCell } from 'h3-js';

import { H3_RESOLUTION } from '../../config/explorationConfig';

/**
 * Convert a geographic coordinate to an H3 cell id at the configured
 * resolution. h3-js is pure JS, so this stays inside the framework-free core.
 *
 * (h3-js v4 API — `latLngToCell`. v3 called this `geoToH3`.)
 */
export const fixToCell = (lat: number, lng: number): string =>
  latLngToCell(lat, lng, H3_RESOLUTION);
