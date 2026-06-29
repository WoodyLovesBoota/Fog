import type { ImageSourcePropType } from 'react-native';

/**
 * Singapore landmark beacons.
 *
 * Unlike the old grid-based `POIS` (col/row, prototype only), these live in
 * REAL geographic space (lat/lng) so they drop straight onto the MapLibre map
 * in `app/map.tsx`. Fill `LANDMARKS` with the real attraction list — the shape
 * below is all the renderer + arrival logic need.
 *
 * Everything the detail sheet shows comes from this record: `name`,
 * `description` (blurb), `area`/`hours`/`tip` (the info rows), and `image` (the
 * hero photo). Anything omitted is simply skipped in the sheet.
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
  category: LandmarkCategory;
  /** Geographic position. WGS84 degrees. */
  lat: number;
  lng: number;
  /** Optional pin glyph; falls back to the category default if omitted. */
  emoji?: string;
  /**
   * Hero photo for the detail sheet. Either a bundled asset
   * (`require('../../assets/mbs.jpg')`) or a remote `{ uri }`. When omitted the
   * sheet shows a tinted placeholder with the category emoji.
   */
  image?: ImageSourcePropType;
  /** One-liner shown in the detail sheet hero blurb. */
  description?: string;
  /** Neighborhood / planning area — the "Region" info row. */
  area?: string;
  /** Opening hours — the "Hours" info row. */
  hours?: string;
  /** A "Good to know" tip — the last info row. */
  tip?: string;
};

/**
 * Per-category presentation: beacon color (hex) + fallback emoji + label, plus
 * the two-step soft tints the detail sheet hero / collection cards paint with.
 */
export const CATEGORY_META: Record<
  LandmarkCategory,
  { color: string; emoji: string; label: string; tintA: string; tintB: string }
> = {
  landmark: { color: '#5C8FE0', emoji: '📍', label: 'Landmark', tintA: '#DCE8FB', tintB: '#C9DBF7' },
  nature: { color: '#6FBF73', emoji: '🌳', label: 'Nature', tintA: '#DFF3E2', tintB: '#CDEBD2' },
  culture: { color: '#9E91E0', emoji: '🏛️', label: 'Culture', tintA: '#ECE7FA', tintB: '#DDD4F4' },
  food: { color: '#F2A65A', emoji: '🍜', label: 'Food', tintA: '#FBEBD8', tintB: '#F6DCC0' },
  shopping: { color: '#E0739E', emoji: '🛍️', label: 'Shopping', tintA: '#FBE2EE', tintB: '#F6CFE0' },
  entertainment: { color: '#F4B73D', emoji: '🎡', label: 'Fun', tintA: '#FBF0D8', tintB: '#F7E6BC' },
};

/**
 * Real Singapore attractions. Coordinates are approximate real-world values so
 * the beacons land in roughly the right spots. Keep `id`s stable.
 */
export const LANDMARKS: Landmark[] = [
  {
    id: 'marina-bay-sands',
    name: 'Marina Bay Sands',
    category: 'landmark',
    lat: 1.2834,
    lng: 103.8607,
    emoji: '🏨',
    description:
      'The triple-tower resort crowned by a rooftop SkyPark and infinity pool — the most recognizable silhouette on the bay.',
    area: 'Marina Bay',
    hours: 'SkyPark 11:00–21:00',
    tip: 'Spectra light show at 20:00 & 21:00',
  },
  {
    id: 'merlion-park',
    name: 'Merlion Park',
    category: 'landmark',
    lat: 1.2868,
    lng: 103.8545,
    emoji: '🦁',
    description:
      'The half-lion, half-fish guardian of Singapore, spouting water across Marina Bay since 1972.',
    area: 'Downtown Core',
    hours: 'Open 24 hours',
    tip: 'Best photos at sunrise',
  },
  {
    id: 'gardens-by-the-bay',
    name: 'Gardens by the Bay',
    category: 'nature',
    lat: 1.2816,
    lng: 103.8636,
    emoji: '🌿',
    description:
      'A futuristic waterfront park of towering Supertrees and two cooled glass conservatories.',
    area: 'Marina South',
    hours: '05:00–02:00',
    tip: 'Garden Rhapsody show at 19:45',
  },
  {
    id: 'singapore-flyer',
    name: 'Singapore Flyer',
    category: 'entertainment',
    lat: 1.2893,
    lng: 103.8631,
    description:
      "One of the world's tallest observation wheels, with 30-minute rides 165 m above the city.",
    area: 'Downtown Core',
    hours: '14:00–22:00',
    tip: 'Sunset flights sell out fast',
  },
  {
    id: 'botanic-gardens',
    name: 'Singapore Botanic Gardens',
    category: 'nature',
    lat: 1.3138,
    lng: 103.8159,
    description:
      'UNESCO-listed tropical gardens, home to the National Orchid Garden and rolling heritage lawns.',
    area: 'Tanglin',
    hours: '05:00–24:00',
  },
  {
    id: 'sentosa',
    name: 'Sentosa Island',
    category: 'entertainment',
    lat: 1.2494,
    lng: 103.8303,
    description:
      'A resort island of beaches, theme parks, cable cars and boardwalk fun just off the south coast.',
    area: 'Sentosa',
    hours: 'Always open',
  },
  {
    id: 'chinatown',
    name: 'Chinatown',
    category: 'culture',
    lat: 1.2812,
    lng: 103.8447,
    description:
      'Heritage shophouses, hawker food and the red-and-gold Buddha Tooth Relic Temple.',
    area: 'Outram',
    hours: 'Always open',
    tip: 'Hawker centre busiest at lunch',
  },
  {
    id: 'orchard-road',
    name: 'Orchard Road',
    category: 'shopping',
    lat: 1.3048,
    lng: 103.8318,
    description:
      "Singapore's flagship shopping belt — a 2 km ribbon of malls and department stores.",
    area: 'Orchard',
    hours: 'Malls 10:00–22:00',
  },
  {
    id: 'maxwell-food-centre',
    name: 'Maxwell Food Centre',
    category: 'food',
    lat: 1.2803,
    lng: 103.8447,
    description:
      'A beloved hawker centre in the heart of Chinatown — home of Tian Tian chicken rice.',
    area: 'Chinatown',
    hours: '08:00–22:00',
    tip: 'Go early to beat the queue',
  },
  {
    id: 'singapore-zoo',
    name: 'Singapore Zoo',
    category: 'nature',
    lat: 1.4043,
    lng: 103.793,
    description:
      'An open-concept rainforest zoo famous for its free-ranging orangutans.',
    area: 'Mandai',
    hours: '08:30–18:00',
    tip: 'Try the Jungle Breakfast with orangutans',
  },
];
