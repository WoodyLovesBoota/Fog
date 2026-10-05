/**
 * Hand-placed geography that the land outline alone doesn't carry: inland water,
 * hills, and where the forests and towns are. (Roads are real data: see `src/data/roads.ts`.) Everything is in
 * `[lat, lng]` and deliberately approximate — this is a toy diorama, not a GIS
 * layer — so tweak freely.
 */

import estates from "@/diorama/data/sg-estates.json";

type LatLng = readonly [lat: number, lng: number];

/** A blob of influence: `amp` at the centre, falling off over `radius` km. */
export type Blob = { at: LatLng; radius: number; amp: number; stretch?: readonly [x: number, z: number] };

/** Water cut out of the land polygon. `width` is the channel width in km. */
export type WaterPath = { path: readonly LatLng[]; width: number };

export const WATER: WaterPath[] = [
  // Marina Bay, the link under the Helix Bridge, and Marina Channel / Kallang Basin
  { path: [[1.2866, 103.8562], [1.2856, 103.858]], width: 0.66 },
  { path: [[1.2866, 103.8575], [1.2872, 103.8625], [1.2872, 103.867]], width: 0.22 },
  { path: [[1.3075, 103.8718], [1.302, 103.8695], [1.295, 103.869], [1.2872, 103.8678], [1.2808, 103.8712], [1.2765, 103.8745]], width: 0.34 },
  // Central catchment reservoirs
  { path: [[1.3405, 103.8345], [1.3445, 103.826], [1.3475, 103.818], [1.3445, 103.811]], width: 0.42 },
  { path: [[1.3705, 103.826], [1.3735, 103.817], [1.3695, 103.811]], width: 0.32 },
  { path: [[1.3695, 103.803], [1.3765, 103.797], [1.384, 103.789]], width: 0.42 },
  { path: [[1.3765, 103.797], [1.3705, 103.79]], width: 0.36 },
  { path: [[1.4085, 103.809], [1.4025, 103.8035], [1.3975, 103.7985]], width: 0.36 },
  { path: [[1.4025, 103.8035], [1.4085, 103.7985]], width: 0.3 },
  { path: [[1.398, 103.822], [1.405, 103.83], [1.412, 103.838], [1.4175, 103.846]], width: 0.36 },
  // Kranji and the western reservoirs
  { path: [[1.4385, 103.7375], [1.4275, 103.7385], [1.4165, 103.7335], [1.404, 103.728]], width: 0.36 },
  { path: [[1.4275, 103.7385], [1.4215, 103.7475]], width: 0.3 },
  { path: [[1.4285, 103.688]], width: 0.5 },
  { path: [[1.4045, 103.672], [1.396, 103.681]], width: 0.34 },
  { path: [[1.378, 103.662], [1.372, 103.672]], width: 0.38 },
  { path: [[1.349, 103.648], [1.3385, 103.6505], [1.345, 103.657]], width: 0.32 },
  // Pandan, Jurong Lake, Bedok
  { path: [[1.3165, 103.737], [1.3125, 103.742]], width: 0.75 },
  { path: [[1.346, 103.7245], [1.3395, 103.727], [1.3325, 103.7285], [1.327, 103.734]], width: 0.24 },
  { path: [[1.3415, 103.922], [1.3415, 103.929]], width: 0.5 },
  // Punggol and Serangoon reservoirs
  { path: [[1.4165, 103.9015], [1.405, 103.9005], [1.395, 103.9035], [1.385, 103.896]], width: 0.18 },
  { path: [[1.4115, 103.928], [1.398, 103.922], [1.385, 103.917], [1.376, 103.908]], width: 0.18 },
];

/** Narrow rivers: painted onto the land rather than cut out of it. */
export const RIVERS: (readonly LatLng[])[] = [
  [[1.2868, 103.8538], [1.2876, 103.8505], [1.2893, 103.8468], [1.2905, 103.8425], [1.2915, 103.8385], [1.2925, 103.833]],
  [[1.3075, 103.8718], [1.318, 103.866], [1.33, 103.862], [1.345, 103.852], [1.3635, 103.8455], [1.3705, 103.834]],
  [[1.3075, 103.8718], [1.3135, 103.879], [1.322, 103.884]],
  [[1.327, 103.734], [1.318, 103.7385]],
];

/** Hills. `amp` is the peak height in world units — heavily exaggerated on purpose. */
export const HILLS: Blob[] = [
  { at: [1.3547, 103.7764], radius: 0.8, amp: 2.0 }, // Bukit Timah
  { at: [1.349, 103.763], radius: 0.5, amp: 0.7 }, // Bukit Batok
  { at: [1.362, 103.756], radius: 0.5, amp: 0.85 }, // Bukit Gombak
  { at: [1.362, 103.789], radius: 1.3, amp: 0.5 },
  { at: [1.385, 103.805], radius: 1.4, amp: 0.45 },
  { at: [1.353, 103.803], radius: 1.0, amp: 0.4 },
  { at: [1.392, 103.777], radius: 1.1, amp: 0.45 },
  { at: [1.412, 103.776], radius: 1.0, amp: 0.45 }, // Mandai
  { at: [1.2735, 103.8175], radius: 0.42, amp: 0.7 }, // Mount Faber
  { at: [1.279, 103.811], radius: 0.4, amp: 0.5 }, // Telok Blangah Hill
  { at: [1.2845, 103.8], radius: 0.45, amp: 0.45 },
  { at: [1.2895, 103.786], radius: 0.6, amp: 0.5 }, // Kent Ridge
  { at: [1.2945, 103.846], radius: 0.25, amp: 0.3 }, // Fort Canning
  { at: [1.37, 103.69], radius: 1.3, amp: 0.5 }, // Western catchment
  { at: [1.395, 103.7], radius: 1.1, amp: 0.42 },
  { at: [1.412, 103.693], radius: 0.9, amp: 0.35 },
  { at: [1.352, 103.675], radius: 0.9, amp: 0.38 },
  { at: [1.318, 103.708], radius: 0.3, amp: 0.4 }, // Jurong Hill
  { at: [1.411, 103.948], radius: 0.5, amp: 0.6 }, // Pulau Ubin
  { at: [1.407, 103.972], radius: 0.6, amp: 0.38 },
  { at: [1.41, 104.045], radius: 1.1, amp: 0.45 }, // Pulau Tekong
  { at: [1.2545, 103.816], radius: 0.36, amp: 0.45 }, // Sentosa, Mount Imbiah
];

/** Where the trees are. Anything above ~0.5 after summing reads as forest. */
export const FORESTS: Blob[] = [
  { at: [1.368, 103.802], radius: 2.6, amp: 1.25 }, // Central Catchment
  { at: [1.392, 103.79], radius: 1.8, amp: 1.0 },
  { at: [1.354, 103.777], radius: 0.9, amp: 1.2 }, // Bukit Timah
  { at: [1.35, 103.762], radius: 0.6, amp: 0.9 }, // Bukit Batok
  { at: [1.41, 103.778], radius: 1.5, amp: 1.0 }, // Mandai
  { at: [1.378, 103.688], radius: 3.0, amp: 1.2 }, // Western catchment
  { at: [1.412, 103.695], radius: 2.0, amp: 1.0 },
  { at: [1.435, 103.712], radius: 1.6, amp: 0.8 }, // Lim Chu Kang
  { at: [1.446, 103.728], radius: 0.8, amp: 1.0 }, // Sungei Buloh
  { at: [1.412, 103.957], radius: 1.1, amp: 1.5, stretch: [2.6, 1] }, // Pulau Ubin
  { at: [1.405, 104.045], radius: 2.6, amp: 1.3 }, // Pulau Tekong
  { at: [1.2515, 103.825], radius: 1.0, amp: 0.85, stretch: [1.6, 1] }, // Sentosa
  { at: [1.28, 103.805], radius: 0.8, amp: 0.95, stretch: [2.2, 1] }, // Southern Ridges
  { at: [1.2665, 103.802], radius: 0.4, amp: 1.0 }, // Labrador
  { at: [1.3138, 103.8159], radius: 0.5, amp: 1.0 }, // Botanic Gardens
  { at: [1.2945, 103.846], radius: 0.3, amp: 0.9 }, // Fort Canning
  { at: [1.2816, 103.8655], radius: 0.4, amp: 0.8 }, // Gardens by the Bay
  { at: [1.3635, 103.8455], radius: 0.5, amp: 0.8 }, // Bishan-AMK Park
  { at: [1.302, 103.915], radius: 0.4, amp: 0.8, stretch: [6, 1] }, // East Coast Park
  { at: [1.381, 103.951], radius: 0.4, amp: 0.8, stretch: [3, 1] }, // Pasir Ris Park
  { at: [1.4095, 103.921], radius: 0.4, amp: 1.2, stretch: [2.4, 1] }, // Coney Island
  { at: [1.389, 103.986], radius: 0.9, amp: 0.8 }, // Changi
  { at: [1.34, 103.7285], radius: 0.5, amp: 0.8 }, // Jurong Lake Gardens
  { at: [1.2255, 103.86], radius: 3.5, amp: 0.9 }, // southern islands
  { at: [1.21, 103.76], radius: 2.5, amp: 0.8 },
];

/** The city centre: built up, but not public housing, so the estate data below doesn't cover it. */
const CITY_CENTRE: Blob[] = [
  { at: [1.2835, 103.851], radius: 1.1, amp: 1.5 }, // Downtown
  { at: [1.298, 103.855], radius: 0.9, amp: 1.1 }, // Bugis / Civic
  { at: [1.304, 103.832], radius: 0.9, amp: 1.1 }, // Orchard
  { at: [1.3115, 103.855], radius: 0.8, amp: 0.9 }, // Little India
  { at: [1.32, 103.843], radius: 0.8, amp: 0.9 }, // Novena
  { at: [1.279, 103.836], radius: 0.9, amp: 1.0 }, // Tanjong Pagar / Tiong Bahru
  { at: [1.326, 103.808], radius: 1.2, amp: 0.55 }, // Bukit Timah Road
];

const MOST_BLOCKS = Math.max(...estates.map((e) => e.blocks));

/**
 * Housing estates, from real data: every existing HDB block in Singapore clustered
 * into estates (see `scripts/sync-hdb.mjs`). Bigger estates read as denser towns.
 */
const ESTATES: Blob[] = estates.map((e) => ({
  at: [e.lat, e.lng],
  radius: e.spreadKm,
  amp: 0.85 + 0.35 * Math.sqrt(e.blocks / MOST_BLOCKS),
}));

/** Built-up areas. */
export const TOWNS: Blob[] = [...CITY_CENTRE, ...ESTATES];

/** The glass-tower core. Drives building height. */
export const SKYLINE: Blob[] = [
  { at: [1.2815, 103.8505], radius: 0.75, amp: 1.25 },
  { at: [1.2935, 103.8565], radius: 0.4, amp: 0.6 },
  { at: [1.304, 103.833], radius: 0.4, amp: 0.5 },
  { at: [1.3335, 103.7425], radius: 0.3, amp: 0.4 },
];

/** Ports, refineries and industrial estates: low, wide sheds. */
export const INDUSTRY: Blob[] = [
  { at: [1.305, 103.638], radius: 2.2, amp: 1.2 }, // Tuas
  { at: [1.265, 103.63], radius: 2.0, amp: 1.0 },
  { at: [1.322, 103.675], radius: 1.6, amp: 1.0 }, // Pioneer
  { at: [1.31, 103.71], radius: 1.3, amp: 0.9 }, // Jurong port
  { at: [1.265, 103.7], radius: 2.4, amp: 1.2 }, // Jurong Island
  { at: [1.228, 103.745], radius: 1.0, amp: 1.0 }, // Pulau Bukom
  { at: [1.277, 103.775], radius: 0.7, amp: 1.0, stretch: [3, 1] }, // Pasir Panjang terminal
  { at: [1.267, 103.84], radius: 0.6, amp: 0.9 }, // Tanjong Pagar terminal
  { at: [1.445, 103.755], radius: 0.9, amp: 0.7 }, // Woodlands / Kranji
  { at: [1.46, 103.835], radius: 0.8, amp: 0.8 }, // Sembawang shipyard
  { at: [1.39, 104.005], radius: 1.0, amp: 0.6 }, // Changi cargo
];

/** Changi's runways, as `[start, end]`. */
export const RUNWAYS: (readonly [LatLng, LatLng])[] = [
  [[1.329, 103.973], [1.364, 103.9865]],
  [[1.326, 103.991], [1.361, 104.0045]],
];

/** Clear ground around the airport so nothing grows on the runways. */
export const AIRFIELD: Blob[] = [{ at: [1.345, 103.9885], radius: 1.4, amp: 1.4, stretch: [1, 1.8] }];
