/**
 * Singapore landmark beacons.
 *
 * Unlike the old grid-based `POIS` (col/row, prototype only), these live in
 * REAL geographic space (lat/lng) so they drop straight onto the MapLibre map
 * in `app/map.tsx`. Fill `LANDMARKS` with the real attraction list — the shape
 * below is all the renderer + arrival logic need.
 */

/** Coarse grouping; drives the beacon color + default emoji (see CATEGORY_META). */
export type LandmarkCategory =
  | 'landmark' // iconic sights — Merlion, MBS, Flyer…
  | 'nature' // parks, gardens, reservoirs, the zoo
  | 'culture' // temples, museums, heritage districts
  | 'food' // hawker centres, famous eats
  | 'shopping' // malls, markets, Orchard
  | 'entertainment'; // Sentosa, USS, nightlife

export type Landmark = {
  /** Stable unique id (kebab-case). Used as React key + GeoJSON feature id. */
  id: string;
  /** Display name (English). */
  name: string;
  /** Optional Korean display name (shown if you localize the label later). */
  nameKo?: string;
  category: LandmarkCategory;
  /** Geographic position. WGS84 degrees. */
  lat: number;
  lng: number;
  /** Optional pin glyph; falls back to the category default if omitted. */
  emoji?: string;
  /** Optional one-liner for a future detail/tap sheet. */
  description?: string;
};

/** Per-category presentation: beacon color (hex) + fallback emoji + label. */
export const CATEGORY_META: Record<
  LandmarkCategory,
  { color: string; emoji: string; label: string }
> = {
  landmark: { color: '#5C8FE0', emoji: '📍', label: 'Landmark' },
  nature: { color: '#6FBF73', emoji: '🌳', label: 'Nature' },
  culture: { color: '#9E91E0', emoji: '🏛️', label: 'Culture' },
  food: { color: '#F2A65A', emoji: '🍜', label: 'Food' },
  shopping: { color: '#E0739E', emoji: '🛍️', label: 'Shopping' },
  entertainment: { color: '#F4B73D', emoji: '🎡', label: 'Fun' },
};

/**
 * MOCKUP DATA — replace with the real curated list.
 * Coordinates are approximate real-world values so the beacons render in
 * roughly the right spots while you wire things up. Keep `id`s stable.
 */
export const LANDMARKS: Landmark[] = [
  {
    id: 'marina-bay-sands',
    name: 'Marina Bay Sands',
    nameKo: '마리나 베이 샌즈',
    category: 'landmark',
    lat: 1.2834,
    lng: 103.8607,
    emoji: '🏨',
    description: 'Iconic three-tower hotel with the rooftop SkyPark.',
  },
  {
    id: 'merlion-park',
    name: 'Merlion Park',
    nameKo: '멀라이언 공원',
    category: 'landmark',
    lat: 1.2868,
    lng: 103.8545,
    emoji: '🦁',
  },
  {
    id: 'gardens-by-the-bay',
    name: 'Gardens by the Bay',
    nameKo: '가든스 바이 더 베이',
    category: 'nature',
    lat: 1.2816,
    lng: 103.8636,
    emoji: '🌿',
  },
  {
    id: 'singapore-flyer',
    name: 'Singapore Flyer',
    nameKo: '싱가포르 플라이어',
    category: 'entertainment',
    lat: 1.2893,
    lng: 103.8631,
  },
  {
    id: 'botanic-gardens',
    name: 'Singapore Botanic Gardens',
    nameKo: '싱가포르 보타닉 가든',
    category: 'nature',
    lat: 1.3138,
    lng: 103.8159,
  },
  {
    id: 'sentosa',
    name: 'Sentosa Island',
    nameKo: '센토사 섬',
    category: 'entertainment',
    lat: 1.2494,
    lng: 103.8303,
  },
  {
    id: 'chinatown',
    name: 'Chinatown',
    nameKo: '차이나타운',
    category: 'culture',
    lat: 1.2812,
    lng: 103.8447,
  },
  {
    id: 'orchard-road',
    name: 'Orchard Road',
    nameKo: '오차드 로드',
    category: 'shopping',
    lat: 1.3048,
    lng: 103.8318,
  },
  {
    id: 'maxwell-food-centre',
    name: 'Maxwell Food Centre',
    nameKo: '맥스웰 푸드 센터',
    category: 'food',
    lat: 1.2803,
    lng: 103.8447,
  },
  {
    id: 'singapore-zoo',
    name: 'Singapore Zoo',
    nameKo: '싱가포르 동물원',
    category: 'nature',
    lat: 1.4043,
    lng: 103.793,
  },
];
