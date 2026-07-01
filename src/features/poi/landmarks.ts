import type { ImageSourcePropType } from "react-native";

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
  | "food" // hawker centres, famous eats
  | "landmark" // iconic sights — Merlion, MBS, Flyer…
  | "nature" // parks, gardens, reservoirs, the zoo
  | "culture" // museums, heritage districts
  | "entertainment" // Sentosa, USS, nightlife
  | "shopping" // malls, markets, Orchard
  | "religious"; // temples, mosques, churches, shrines

/** Singapore planning area / neighborhood — the "Region" info row value. */
export type LandmarkArea =
  | "Marina Bay"
  | "Marina South"
  | "Tanglin"
  | "Sentosa"
  | "Mandai"
  | "Chinatown"
  | "Little India"
  | "Singapore River"
  | "Downtown Core"
  | "Civic District"
  | "Changi"
  | "Kampong Glam"
  | "Orchard"
  | "Fort Canning"
  | "Telok Ayer"
  | "Newton"
  | "Mount Faber"
  | "Telok Blangah"
  | "Pasir Panjang"
  | "East Coast"
  | "Tiong Bahru"
  | "Mountbatten"
  | "Central Catchment"
  | "Bukit Timah"
  | "Pulau Ubin"
  | "Bishan"
  | "Jurong East"
  | "Kranji"
  | "Labrador"
  | "HarbourFront"
  | "Bugis"
  | "Marina Centre"
  | "Tanjong Pagar"
  | "River Valley"
  | "Alexandra"
  | "Punggol"
  | "Pasir Ris"
  | "Kallang"
  | "Holland Village"
  | "Joo Chiat"
  | "Geylang";

export type Landmark = {
  /** Stable unique id (kebab-case). Used as React key + GeoJSON feature id. */
  id: string;
  /** Display name (English). */
  name: string;
  category: LandmarkCategory;
  /**
   * Anchor landmarks (the 10 most iconic) are drawn on the map from the very
   * first launch. The other 90 are HIDDEN — their pin (and coordinate) must
   * never render until the user physically discovers them (see Step 6). This
   * flag is the only thing that decides "drawn from the start" vs "hidden until
   * found"; collection itself is identical for all 100.
   */
  isAnchor?: boolean;
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
  area?: LandmarkArea;
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
  food: {
    color: "#F2A65A",
    emoji: "🍜",
    label: "Food",
    tintA: "#FBEBD8",
    tintB: "#F6DCC0",
  },
  landmark: {
    color: "#5C8FE0",
    emoji: "📍",
    label: "Landmark",
    tintA: "#DCE8FB",
    tintB: "#C9DBF7",
  },
  nature: {
    color: "#6FBF73",
    emoji: "🌳",
    label: "Nature",
    tintA: "#DFF3E2",
    tintB: "#CDEBD2",
  },
  culture: {
    color: "#9E91E0",
    emoji: "🏛️",
    label: "Culture",
    tintA: "#ECE7FA",
    tintB: "#DDD4F4",
  },
  entertainment: {
    color: "#F4B73D",
    emoji: "🎡",
    label: "Fun",
    tintA: "#FBF0D8",
    tintB: "#F7E6BC",
  },
  shopping: {
    color: "#E0739E",
    emoji: "🛍️",
    label: "Shopping",
    tintA: "#FBE2EE",
    tintB: "#F6CFE0",
  },
  religious: {
    color: "#C98A5E",
    emoji: "🛕",
    label: "Religious",
    tintA: "#F6E8DA",
    tintB: "#EFD8C2",
  },
};

/**
 * Real Singapore attractions. Coordinates are approximate real-world values so
 * the beacons land in roughly the right spots. Keep `id`s stable.
 *
 * The full catalogue of 100 IS the game (Step 6): the {@link isAnchor} ten are
 * drawn from launch, the other ninety stay hidden until discovered by proximity.
 */
export const ALL_LANDMARKS: Landmark[] = [
  {
    id: "marina-bay-sands",
    image: require("../../../assets/landmarks/marina-bay-sands.webp"),
    name: "Marina Bay Sands",
    category: "landmark",
    isAnchor: true,
    lat: 1.2837575,
    lng: 103.8591065,
    emoji: "🏨",
    description:
      "The iconic three-tower resort crowned by a ship-shaped SkyPark, defining Singapore's skyline since 2010.",
    area: "Marina Bay",
    hours: "Open 24 hours",
    tip: "SkyPark observation deck best at dusk",
  },
  {
    id: "gardens-by-the-bay",
    image: require("../../../assets/landmarks/gardens-by-the-bay.webp"),
    name: "Gardens by the Bay",
    category: "nature",
    lat: 1.2815683,
    lng: 103.8636132,
    emoji: "🌳",
    description:
      "A futuristic waterfront park of towering Supertrees and two cooled glass conservatories.",
    area: "Marina South",
    hours: "05:00–02:00",
    tip: "Garden Rhapsody light show at 19:45 & 20:45",
  },
  {
    id: "merlion-park",
    image: require("../../../assets/landmarks/merlion-park.webp"),
    name: "Merlion Park",
    category: "landmark",
    lat: 1.2867449,
    lng: 103.8543872,
    emoji: "🦁",
    description:
      "The half-lion, half-fish guardian of Singapore, spouting water across Marina Bay since 1972.",
    area: "Marina Bay",
    hours: "Open 24 hours",
    tip: "Best photos at sunrise before crowds",
  },
  {
    id: "singapore-botanic-gardens",
    image: require("../../../assets/landmarks/singapore-botanic-gardens.webp"),
    name: "Singapore Botanic Gardens",
    category: "nature",
    isAnchor: true,
    lat: 1.3138397,
    lng: 103.8159136,
    emoji: "🌸",
    description:
      "Singapore's first UNESCO World Heritage Site, a 160-year-old tropical garden with a famed National Orchid Garden.",
    area: "Tanglin",
    hours: "05:00–24:00",
    tip: "Main garden is free; Orchid Garden is ticketed",
  },
  {
    id: "universal-studios-singapore",
    image: require("../../../assets/landmarks/universal-studios-singapore.webp"),
    name: "Universal Studios Singapore",
    category: "entertainment",
    isAnchor: true,
    lat: 1.2540421,
    lng: 103.8238084,
    emoji: "🎢",
    description:
      "Southeast Asia's first Universal theme park, with seven themed zones and the Battlestar Galactica duelling coasters.",
    area: "Sentosa",
    hours: "10:00–20:00",
    tip: "Buy the Express Pass on peak days",
  },
  {
    id: "sentosa-island",
    image: require("../../../assets/landmarks/sentosa-island.webp"),
    name: "Sentosa Island",
    category: "entertainment",
    lat: 1.2494041,
    lng: 103.8303209,
    emoji: "🏝️",
    description:
      "A resort island of beaches, theme parks, and attractions linked to the mainland by cable car and boardwalk.",
    area: "Sentosa",
    hours: "Open 24 hours",
    tip: "Walk in free via the Sentosa Boardwalk",
  },
  {
    id: "singapore-zoo",
    image: require("../../../assets/landmarks/singapore-zoo.webp"),
    name: "Singapore Zoo",
    category: "nature",
    isAnchor: true,
    lat: 1.4043485,
    lng: 103.793023,
    emoji: "🦒",
    description:
      "A world-renowned open-concept zoo where animals roam in naturalistic, barrier-free habitats.",
    area: "Mandai",
    hours: "08:30–18:00",
    tip: "Arrive at opening to catch animals active",
  },
  {
    id: "singapore-flyer",
    image: require("../../../assets/landmarks/singapore-flyer.webp"),
    name: "Singapore Flyer",
    category: "entertainment",
    lat: 1.2892988,
    lng: 103.8631368,
    emoji: "🎡",
    description:
      "One of Asia's largest observation wheels, offering 30-minute rotations 165m above Marina Bay.",
    area: "Marina Bay",
    hours: "10:00–22:00",
    tip: "Sunset flights give the best skyline light",
  },
  {
    id: "chinatown",
    image: require("../../../assets/landmarks/chinatown.webp"),
    name: "Chinatown",
    category: "culture",
    lat: 1.2814942,
    lng: 103.8448202,
    emoji: "🏮",
    description:
      "A heritage quarter of shophouses, temples, and food streets at the heart of Singapore's Chinese community.",
    area: "Chinatown",
    hours: "Open 24 hours",
    tip: "Pagoda Street stalls liven up by midday",
  },
  {
    id: "little-india",
    image: require("../../../assets/landmarks/little-india.webp"),
    name: "Little India",
    category: "culture",
    isAnchor: true,
    lat: 1.3065597,
    lng: 103.851819,
    emoji: "🛕",
    description:
      "A vibrant, fragrant district of garland stalls, Tamil eateries, and colourful heritage shophouses.",
    area: "Little India",
    hours: "Open 24 hours",
    tip: "Liveliest on Sunday evenings",
  },
  {
    id: "clarke-quay",
    image: require("../../../assets/landmarks/clarke-quay.webp"),
    name: "Clarke Quay",
    category: "entertainment",
    lat: 1.2906024,
    lng: 103.8464742,
    emoji: "🍸",
    description:
      "A riverside quay of colourful restored godowns, now Singapore's buzziest nightlife and dining strip.",
    area: "Singapore River",
    hours: "17:00–02:00",
    tip: "Liveliest after 21:00; quiet by day",
  },
  {
    id: "night-safari",
    image: require("../../../assets/landmarks/night-safari.webp"),
    name: "Night Safari",
    category: "nature",
    lat: 1.4021872,
    lng: 103.7880606,
    emoji: "🌙",
    description:
      "The world's first nocturnal wildlife park, exploring nighttime habitats by tram and walking trail.",
    area: "Mandai",
    hours: "18:15–24:00",
    tip: "Take the tram first, then the trails",
  },
  {
    id: "river-wonders",
    image: require("../../../assets/landmarks/river-wonders.webp"),
    name: "River Wonders",
    category: "nature",
    lat: 1.4038498,
    lng: 103.7906676,
    emoji: "🐼",
    description:
      "A river-themed wildlife park home to giant pandas, manatees, and freshwater giants.",
    area: "Mandai",
    hours: "10:00–19:00",
    tip: "Panda Forest is air-conditioned—great midday escape",
  },
  {
    id: "bird-paradise",
    image: require("../../../assets/landmarks/bird-paradise.webp"),
    name: "Bird Paradise",
    category: "nature",
    lat: 1.4071539,
    lng: 103.7812684,
    emoji: "🦜",
    description:
      "Asia's largest bird park, with walk-through aviaries recreating habitats from rainforest to wetlands.",
    area: "Mandai",
    hours: "09:00–18:00",
    tip: "Catch the Predators on Wings show",
  },
  {
    id: "artscience-museum",
    image: require("../../../assets/landmarks/artscience-museum.webp"),
    name: "ArtScience Museum",
    category: "culture",
    lat: 1.2862738,
    lng: 103.8592663,
    emoji: "🪷",
    description:
      "A lotus-shaped museum at Marina Bay Sands blending art, science, and tech, home to teamLab's Future World.",
    area: "Marina Bay",
    hours: "10:00–19:00",
    tip: "Future World is the permanent highlight",
  },
  {
    id: "esplanade",
    image: require("../../../assets/landmarks/esplanade.webp"),
    name: "Esplanade – Theatres on the Bay",
    category: "culture",
    lat: 1.2897934,
    lng: 103.8558166,
    emoji: "🎭",
    description:
      "Singapore's spiky durian-domed performing arts centre on the bay, with free daily performances.",
    area: "Downtown Core",
    hours: "Open daily (show times vary)",
    tip: "Rooftop terrace has a great bay view",
  },
  {
    id: "national-gallery-singapore",
    image: require("../../../assets/landmarks/national-gallery-singapore.webp"),
    name: "National Gallery Singapore",
    category: "culture",
    lat: 1.2902217,
    lng: 103.8515167,
    emoji: "🖼️",
    description:
      "Southeast Asia's largest art museum, set in the restored former Supreme Court and City Hall.",
    area: "Civic District",
    hours: "10:00–19:00",
    tip: "Padang Deck has skyline views",
  },
  {
    id: "national-museum-singapore",
    image: require("../../../assets/landmarks/national-museum-singapore.webp"),
    name: "National Museum of Singapore",
    category: "culture",
    lat: 1.296613,
    lng: 103.8485091,
    emoji: "🏛️",
    description:
      "Singapore's oldest museum, tracing the nation's story through immersive multimedia galleries.",
    area: "Civic District",
    hours: "10:00–19:00",
    tip: "Don't miss the Glass Rotunda installation",
  },
  {
    id: "jewel-changi-airport",
    image: require("../../../assets/landmarks/jewel-changi-airport.webp"),
    name: "Jewel Changi Airport",
    category: "landmark",
    isAnchor: true,
    lat: 1.3602094,
    lng: 103.9897598,
    emoji: "💧",
    description:
      "A nature-themed complex at Changi Airport centred on the HSBC Rain Vortex, the world's tallest indoor waterfall.",
    area: "Changi",
    hours: "Open 24 hours",
    tip: "Rain Vortex light show runs nightly",
  },
  {
    id: "buddha-tooth-relic-temple",
    image: require("../../../assets/landmarks/buddha-tooth-relic-temple.webp"),
    name: "Buddha Tooth Relic Temple",
    category: "religious",
    lat: 1.2815155,
    lng: 103.8442397,
    emoji: "☸️",
    description:
      "A grand Tang-style Buddhist temple in Chinatown said to house a sacred tooth relic of the Buddha.",
    area: "Chinatown",
    hours: "07:00–17:00",
    tip: "Dress modestly; rooftop orchid garden up top",
  },
  {
    id: "sri-mariamman-temple",
    image: require("../../../assets/landmarks/sri-mariamman-temple.webp"),
    name: "Sri Mariamman Temple",
    category: "religious",
    lat: 1.2829761,
    lng: 103.8449433,
    emoji: "🛕",
    description:
      "Singapore's oldest Hindu temple (1827), famed for its vivid, sculpture-covered gopuram tower in Chinatown.",
    area: "Chinatown",
    hours: "07:00–12:00, 18:00–21:00",
    tip: "Theemithi fire-walking festival in autumn",
  },
  {
    id: "sultan-mosque",
    image: require("../../../assets/landmarks/sultan-mosque.webp"),
    name: "Sultan Mosque",
    category: "religious",
    lat: 1.3022854,
    lng: 103.8589636,
    emoji: "🕌",
    description:
      "Singapore's most important mosque, its golden dome the centrepiece of the Kampong Glam quarter since 1826.",
    area: "Kampong Glam",
    hours: "10:00–12:00, 14:00–16:00 (closed Fri)",
    tip: "Free guided tours; dress modestly",
  },
  {
    id: "haji-lane",
    image: require("../../../assets/landmarks/haji-lane.webp"),
    name: "Haji Lane",
    category: "shopping",
    lat: 1.3007065,
    lng: 103.8591356,
    emoji: "🎨",
    description:
      "A narrow, mural-splashed lane of indie boutiques, cafés, and bars in the heart of Kampong Glam.",
    area: "Kampong Glam",
    hours: "Open 24 hours",
    tip: "Shops open from late morning; bars at night",
  },
  {
    id: "malay-heritage-centre",
    image: require("../../../assets/landmarks/malay-heritage-centre.webp"),
    name: "Malay Heritage Centre",
    category: "culture",
    lat: 1.3027993,
    lng: 103.8599265,
    emoji: "🏯",
    description:
      "A museum in the former Istana Kampong Glam tracing the heritage of Singapore's Malay community.",
    area: "Kampong Glam",
    hours: "10:00–18:00 (closed Mon)",
    tip: "Set in a restored royal palace",
  },
  {
    id: "raffles-hotel",
    image: require("../../../assets/landmarks/raffles-hotel.webp"),
    name: "Raffles Hotel",
    category: "landmark",
    lat: 1.294889,
    lng: 103.854483,
    emoji: "🏨",
    description:
      "A storied 1887 colonial hotel, birthplace of the Singapore Sling and an enduring symbol of old Singapore.",
    area: "Civic District",
    hours: "Open 24 hours",
    tip: "Sip a Singapore Sling at the Long Bar",
  },
  {
    id: "orchard-road",
    image: require("../../../assets/landmarks/orchard-road.webp"),
    name: "Orchard Road",
    category: "shopping",
    isAnchor: true,
    lat: 1.3048205,
    lng: 103.8321984,
    emoji: "🛍️",
    description:
      "Singapore's flagship shopping boulevard, a 2km belt of malls, flagship stores, and festive lights.",
    area: "Orchard",
    hours: "Open 24 hours",
    tip: "Dazzling Christmas light-up Nov–Jan",
  },
  {
    id: "ion-orchard",
    image: require("../../../assets/landmarks/ion-orchard.webp"),
    name: "ION Orchard",
    category: "shopping",
    lat: 1.3039557,
    lng: 103.8319537,
    emoji: "🏬",
    description:
      "A landmark luxury mall above Orchard MRT, topped by the ION Sky observation deck.",
    area: "Orchard",
    hours: "10:00–22:00",
    tip: "Free city views from ION Sky, level 55",
  },
  {
    id: "fort-canning-park",
    image: require("../../../assets/landmarks/fort-canning-park.webp"),
    name: "Fort Canning Park",
    category: "nature",
    lat: 1.2943876,
    lng: 103.8458033,
    emoji: "🌳",
    description:
      "A historic hilltop park of heritage trees, gardens, and the photogenic Fort Canning Tree Tunnel.",
    area: "Fort Canning",
    hours: "Open 24 hours",
    tip: "Tree Tunnel spiral staircase is the photo spot",
  },
  {
    id: "marina-barrage",
    image: require("../../../assets/landmarks/marina-barrage.webp"),
    name: "Marina Barrage",
    category: "nature",
    lat: 1.2805168,
    lng: 103.8714399,
    emoji: "🪁",
    description:
      "A dam with a rooftop green lawn offering sweeping skyline views, popular for picnics and kite-flying.",
    area: "Marina South",
    hours: "Open 24 hours",
    tip: "Sunset on the rooftop lawn is unbeatable",
  },
  {
    id: "singapore-oceanarium",
    image: require("../../../assets/landmarks/singapore-oceanarium.webp"),
    name: "Singapore Oceanarium",
    category: "entertainment",
    lat: 1.2583209,
    lng: 103.8205147,
    emoji: "🐠",
    description:
      "A vastly expanded marine attraction (formerly S.E.A. Aquarium) on Sentosa with one of the world's largest tanks.",
    area: "Sentosa",
    hours: "10:00–20:00",
    tip: "The Open Ocean viewing panel is mesmerising",
  },
  {
    id: "thian-hock-keng-temple",
    image: require("../../../assets/landmarks/thian-hock-keng-temple.webp"),
    name: "Thian Hock Keng Temple",
    category: "religious",
    lat: 1.280939,
    lng: 103.8476354,
    emoji: "⛩️",
    description:
      "One of Singapore's oldest Hokkien temples (1839), built without nails to honour the sea goddess Mazu.",
    area: "Telok Ayer",
    hours: "07:30–17:00",
    tip: "Once stood right on the original shoreline",
  },
  {
    id: "lau-pa-sat",
    image: require("../../../assets/landmarks/lau-pa-sat.webp"),
    name: "Lau Pa Sat",
    category: "food",
    lat: 1.2805121,
    lng: 103.8503809,
    emoji: "🍢",
    description:
      "A historic Victorian cast-iron market hall in the CBD, famous for its evening Satay Street.",
    area: "Downtown Core",
    hours: "Open 24 hours",
    tip: "Satay Street fires up after 19:00",
  },
  {
    id: "maxwell-food-centre",
    image: require("../../../assets/landmarks/maxwell-food-centre.webp"),
    name: "Maxwell Food Centre",
    category: "food",
    lat: 1.2803361,
    lng: 103.844767,
    emoji: "🍜",
    description:
      "A beloved Chinatown hawker centre, home to the legendary Tian Tian Hainanese Chicken Rice.",
    area: "Chinatown",
    hours: "08:00–22:00",
    tip: "Go early; top stalls sell out",
  },
  {
    id: "newton-food-centre",
    image: require("../../../assets/landmarks/newton-food-centre.webp"),
    name: "Newton Food Centre",
    category: "food",
    lat: 1.3119888,
    lng: 103.8395742,
    emoji: "🦐",
    description:
      "An iconic open-air hawker centre best known for BBQ seafood, satay, and chilli crab.",
    area: "Newton",
    hours: "12:00–02:00",
    tip: "Featured in the film Crazy Rich Asians",
  },
  {
    id: "singapore-cable-car",
    image: require("../../../assets/landmarks/singapore-cable-car.webp"),
    name: "Singapore Cable Car",
    category: "entertainment",
    lat: 1.2711448,
    lng: 103.8195992,
    emoji: "🚠",
    description:
      "A scenic cable car linking Mount Faber, HarbourFront, and Sentosa with panoramic harbour views.",
    area: "Mount Faber",
    hours: "08:45–21:30",
    tip: "Glass-floor SkyOrb cabins for a thrill",
  },
  {
    id: "henderson-waves",
    image: require("../../../assets/landmarks/henderson-waves.webp"),
    name: "Henderson Waves",
    category: "nature",
    lat: 1.275866,
    lng: 103.8158303,
    emoji: "🌉",
    description:
      "Singapore's highest pedestrian bridge, a sculptural wave of timber along the Southern Ridges trail.",
    area: "Telok Blangah",
    hours: "Open 24 hours",
    tip: "Lit up at night; great at sunset",
  },
  {
    id: "mount-faber-park",
    image: require("../../../assets/landmarks/mount-faber-park.webp"),
    name: "Mount Faber Park",
    category: "nature",
    lat: 1.2718742,
    lng: 103.8192125,
    emoji: "⛰️",
    description:
      "One of Singapore's oldest hilltop parks, with lush trails and skyline lookouts at Faber Peak.",
    area: "Mount Faber",
    hours: "Open 24 hours",
    tip: "Walk up from HarbourFront MRT",
  },
  {
    id: "helix-bridge",
    image: require("../../../assets/landmarks/helix-bridge.webp"),
    name: "Helix Bridge",
    category: "landmark",
    lat: 1.2874774,
    lng: 103.8606326,
    emoji: "🧬",
    description:
      "A pedestrian bridge across Marina Bay shaped like a DNA double helix, glowing at night.",
    area: "Marina Bay",
    hours: "Open 24 hours",
    tip: "Viewing pods frame Marina Bay Sands",
  },
  {
    id: "haw-par-villa",
    image: require("../../../assets/landmarks/haw-par-villa.webp"),
    name: "Haw Par Villa",
    category: "culture",
    lat: 1.2841526,
    lng: 103.781892,
    emoji: "👹",
    description:
      "A surreal 1937 cultural park of vivid statues depicting Chinese mythology and the Ten Courts of Hell.",
    area: "Pasir Panjang",
    hours: "09:00–18:00",
    tip: "Check current opening before visiting",
  },
  {
    id: "east-coast-park",
    image: require("../../../assets/landmarks/east-coast-park.webp"),
    name: "East Coast Park",
    category: "nature",
    isAnchor: true,
    lat: 1.3007842,
    lng: 103.9121866,
    emoji: "🏖️",
    description:
      "Singapore's longest coastal park, a 15km stretch for cycling, picnics, seafood, and sea breezes.",
    area: "East Coast",
    hours: "Open 24 hours",
    tip: "Rent a bike; East Coast Lagoon food village nearby",
  },
  {
    id: "asian-civilisations-museum",
    image: require("../../../assets/landmarks/asian-civilisations-museum.webp"),
    name: "Asian Civilisations Museum",
    category: "culture",
    lat: 1.2875002,
    lng: 103.8513853,
    emoji: "🏺",
    description:
      "A riverside museum devoted to the cultures and artefacts of Asia, from ceramics to ancient trade.",
    area: "Civic District",
    hours: "10:00–19:00",
    tip: "Free guided tours run daily",
  },
  {
    id: "peranakan-museum",
    image: require("../../../assets/landmarks/peranakan-museum.webp"),
    name: "Peranakan Museum",
    category: "culture",
    lat: 1.2943669,
    lng: 103.8490391,
    emoji: "🫖",
    description:
      "A jewel-box museum celebrating Peranakan culture, with exquisite beadwork, porcelain, and Nyonya heritage.",
    area: "Civic District",
    hours: "10:00–19:00",
    tip: "Stellar gift shop on the ground floor",
  },
  {
    id: "boat-quay",
    image: require("../../../assets/landmarks/boat-quay.webp"),
    name: "Boat Quay",
    category: "entertainment",
    lat: 1.2859916,
    lng: 103.8501667,
    emoji: "🛶",
    description:
      "A historic riverfront row of restored shophouses, now lively waterfront bars and restaurants.",
    area: "Singapore River",
    hours: "Open 24 hours",
    tip: "Sunset river views toward the CBD",
  },
  {
    id: "tekka-centre",
    image: require("../../../assets/landmarks/tekka-centre.webp"),
    name: "Tekka Centre",
    category: "food",
    lat: 1.3063839,
    lng: 103.8507014,
    emoji: "🍛",
    description:
      "Little India's bustling wet market and hawker centre, famed for biryani, prata, and Indian fare.",
    area: "Little India",
    hours: "06:30–21:00",
    tip: "Upstairs has colourful textile shops",
  },
  {
    id: "tiong-bahru-market",
    image: require("../../../assets/landmarks/tiong-bahru-market.webp"),
    name: "Tiong Bahru Market",
    category: "food",
    lat: 1.2850771,
    lng: 103.8328072,
    emoji: "🥟",
    description:
      "A beloved hawker centre in heritage Tiong Bahru, known for chwee kueh, lor mee, and curry rice.",
    area: "Tiong Bahru",
    hours: "06:00–20:00",
    tip: "Pair with a stroll through Art Deco Tiong Bahru",
  },
  {
    id: "chinatown-complex-food-centre",
    image: require("../../../assets/landmarks/chinatown-complex-food-centre.webp"),
    name: "Chinatown Complex Food Centre",
    category: "food",
    lat: 1.2825735,
    lng: 103.8431104,
    emoji: "🍗",
    description:
      "Singapore's largest hawker centre with 260+ stalls, including a Michelin-listed soya sauce chicken.",
    area: "Chinatown",
    hours: "07:00–22:00",
    tip: "Lunchtime has the most stalls open",
  },
  {
    id: "old-airport-road-food-centre",
    image: require("../../../assets/landmarks/old-airport-road-food-centre.webp"),
    name: "Old Airport Road Food Centre",
    category: "food",
    lat: 1.3082405,
    lng: 103.8858445,
    emoji: "🥘",
    description:
      "A local-favourite hawker centre revered for lor mee, Hokkien mee, and kway chap.",
    area: "Mountbatten",
    hours: "06:00–22:30",
    tip: "A true foodie pilgrimage, light on tourists",
  },
  {
    id: "macritchie-reservoir",
    image: require("../../../assets/landmarks/macritchie-reservoir.webp"),
    name: "MacRitchie Reservoir",
    category: "nature",
    lat: 1.3447621,
    lng: 103.8223506,
    emoji: "🐒",
    description:
      "Singapore's oldest reservoir, ringed by rainforest trails and the canopy-level TreeTop Walk.",
    area: "Central Catchment",
    hours: "07:00–19:00",
    tip: "Watch your snacks—macaques are bold",
  },
  {
    id: "bukit-timah-nature-reserve",
    image: require("../../../assets/landmarks/bukit-timah-nature-reserve.webp"),
    name: "Bukit Timah Nature Reserve",
    category: "nature",
    lat: 1.3483883,
    lng: 103.776701,
    emoji: "🥾",
    description:
      "A primary rainforest reserve around Singapore's highest hill, rich with wildlife and hiking trails.",
    area: "Bukit Timah",
    hours: "07:00–19:00",
    tip: "Colour-coded trails by difficulty",
  },
  {
    id: "pulau-ubin",
    image: require("../../../assets/landmarks/pulau-ubin.webp"),
    name: "Pulau Ubin",
    category: "nature",
    lat: 1.4125659,
    lng: 103.9577334,
    emoji: "🚲",
    description:
      "A rustic island offering a glimpse of 1960s kampong Singapore, best explored by bicycle.",
    area: "Pulau Ubin",
    hours: "Open daily (bumboat from Changi)",
    tip: "Bring cash; visit Chek Jawa at low tide",
  },
  {
    id: "sri-veeramakaliamman-temple",
    image: require("../../../assets/landmarks/sri-veeramakaliamman-temple.webp"),
    name: "Sri Veeramakaliamman Temple",
    category: "religious",
    lat: 1.3078878,
    lng: 103.85248,
    emoji: "🪔",
    description:
      "A vivid Little India temple dedicated to the goddess Kali, one of Singapore's oldest Hindu shrines.",
    area: "Little India",
    hours: "05:30–12:00, 17:00–21:00",
    tip: "Most atmospheric during evening prayers",
  },
  {
    id: "masjid-jamae",
    image: require("../../../assets/landmarks/masjid-jamae.webp"),
    name: "Masjid Jamae (Chulia)",
    category: "religious",
    lat: 1.2832261,
    lng: 103.8454284,
    emoji: "☪️",
    description:
      "An 1826 mosque in Chinatown blending South Indian, Islamic, and neoclassical design.",
    area: "Chinatown",
    hours: "10:00–21:00",
    tip: "Striking green-and-white gateway facade",
  },
  {
    id: "kong-meng-san",
    image: require("../../../assets/landmarks/kong-meng-san.webp"),
    name: "Kong Meng San Phor Kark See Monastery",
    category: "religious",
    lat: 1.3615175,
    lng: 103.8358116,
    emoji: "🧘",
    description:
      "Singapore's largest Buddhist monastery, a sprawling complex of halls, gardens, and giant Buddha statues.",
    area: "Bishan",
    hours: "08:00–16:00",
    tip: "Affordable vegetarian canteen on site",
  },
  {
    id: "chijmes",
    image: require("../../../assets/landmarks/chijmes.webp"),
    name: "CHIJMES",
    category: "culture",
    lat: 1.2952923,
    lng: 103.8517863,
    emoji: "🥂",
    description:
      "A restored 19th-century convent and Gothic chapel, now an elegant dining and events courtyard.",
    area: "Civic District",
    hours: "Open 24 hours",
    tip: "Beautifully lit at night; featured in Crazy Rich Asians",
  },
  {
    id: "st-andrews-cathedral",
    image: require("../../../assets/landmarks/st-andrews-cathedral.webp"),
    name: "St Andrew's Cathedral",
    category: "religious",
    lat: 1.2923914,
    lng: 103.8522543,
    emoji: "⛪",
    description:
      "Singapore's largest cathedral, a gleaming white neo-Gothic landmark in the Civic District (1856).",
    area: "Civic District",
    hours: "07:00–20:00",
    tip: "Free entry; peaceful green grounds",
  },
  {
    id: "science-centre-singapore",
    image: require("../../../assets/landmarks/science-centre-singapore.webp"),
    name: "Science Centre Singapore",
    category: "entertainment",
    lat: 1.3331687,
    lng: 103.7356443,
    emoji: "🔬",
    description:
      "A hands-on science museum with 1,000+ interactive exhibits, an OmniTheatre, and rotating shows.",
    area: "Jurong East",
    hours: "10:00–17:00 (closed Mon)",
    tip: "Great rainy-day outing for families",
  },
  {
    id: "jurong-lake-gardens",
    image: require("../../../assets/landmarks/jurong-lake-gardens.webp"),
    name: "Jurong Lake Gardens",
    category: "nature",
    isAnchor: true,
    lat: 1.3348492,
    lng: 103.7264557,
    emoji: "🦦",
    description:
      "A revamped national garden in the west with lakeside trails, wildlife, and a popular play area.",
    area: "Jurong East",
    hours: "Open 24 hours",
    tip: "Otters and monitor lizards are common sightings",
  },
  {
    id: "chinese-garden",
    image: require("../../../assets/landmarks/chinese-garden.webp"),
    name: "Chinese Garden",
    category: "nature",
    lat: 1.3385396,
    lng: 103.7303578,
    emoji: "🐉",
    description:
      "A serene park styled after northern Chinese imperial gardens, with pagodas and the White Rainbow Bridge.",
    area: "Jurong East",
    hours: "05:30–24:00",
    tip: "Sunset light on the pagodas is gorgeous",
  },
  {
    id: "sungei-buloh-wetland-reserve",
    image: require("../../../assets/landmarks/sungei-buloh-wetland-reserve.webp"),
    name: "Sungei Buloh Wetland Reserve",
    category: "nature",
    lat: 1.4464304,
    lng: 103.723404,
    emoji: "🐊",
    description:
      "A mangrove wetland reserve in the northwest, prime for birdwatching, mudskippers, and monitor lizards.",
    area: "Kranji",
    hours: "07:00–19:00",
    tip: "Visit at low tide for the most wildlife",
  },
  {
    id: "labrador-nature-reserve",
    image: require("../../../assets/landmarks/labrador-nature-reserve.webp"),
    name: "Labrador Nature Reserve",
    category: "nature",
    lat: 1.2665094,
    lng: 103.8020649,
    emoji: "🌅",
    description:
      "A coastal nature reserve with sea views to Sentosa, WWII relics, and a breezy waterfront promenade.",
    area: "Labrador",
    hours: "07:00–19:00",
    tip: "Sunset views over the southern islands",
  },
  {
    id: "vivocity",
    image: require("../../../assets/landmarks/vivocity.webp"),
    name: "VivoCity",
    category: "shopping",
    lat: 1.2647139,
    lng: 103.8231658,
    emoji: "🛒",
    description:
      "Singapore's largest mall at HarbourFront, the gateway to Sentosa with a breezy rooftop terrace.",
    area: "HarbourFront",
    hours: "10:00–22:00",
    tip: "Board the Sentosa Express from level 3",
  },
  {
    id: "bugis-street",
    image: require("../../../assets/landmarks/bugis-street.webp"),
    name: "Bugis Street",
    category: "shopping",
    lat: 1.3001991,
    lng: 103.8552015,
    emoji: "👕",
    description:
      "A bustling covered street market packed with cheap fashion, souvenirs, and street snacks.",
    area: "Bugis",
    hours: "10:00–22:00",
    tip: "Haggle politely for better prices",
  },
  {
    id: "mustafa-centre",
    image: require("../../../assets/landmarks/mustafa-centre.webp"),
    name: "Mustafa Centre",
    category: "shopping",
    lat: 1.3099676,
    lng: 103.8554251,
    emoji: "💎",
    description:
      "A sprawling 24-hour department store in Little India selling everything from electronics to gold.",
    area: "Little India",
    hours: "Open 24 hours",
    tip: "Quietest to shop late at night",
  },
  {
    id: "fountain-of-wealth",
    image: require("../../../assets/landmarks/fountain-of-wealth.webp"),
    name: "Fountain of Wealth",
    category: "landmark",
    lat: 1.2947425,
    lng: 103.8589026,
    emoji: "⛲",
    description:
      "Once the world's largest fountain, a feng shui centrepiece of Suntec City believed to bring luck.",
    area: "Marina Centre",
    hours: "10:00–12:00, 14:00–16:00, 18:00–19:30",
    tip: "Walk around the mini fountain for good fortune",
  },
  {
    id: "the-shoppes-mbs",
    image: require("../../../assets/landmarks/the-shoppes-mbs.webp"),
    name: "The Shoppes at Marina Bay Sands",
    category: "shopping",
    lat: 1.2836889,
    lng: 103.8591846,
    emoji: "💳",
    description:
      "A luxury mall beneath Marina Bay Sands with an indoor canal and sampan rides.",
    area: "Marina Bay",
    hours: "10:30–23:00",
    tip: "Catch the Spectra light show outside at the bay",
  },
  {
    id: "singapore-city-gallery",
    image: require("../../../assets/landmarks/singapore-city-gallery.webp"),
    name: "Singapore City Gallery",
    category: "culture",
    lat: 1.2798527,
    lng: 103.845058,
    emoji: "🏙️",
    description:
      "A free gallery on Singapore's urban transformation, centred on a vast city scale model.",
    area: "Tanjong Pagar",
    hours: "09:00–17:00 (closed Sun)",
    tip: "The CBD architectural model is the highlight",
  },
  {
    id: "fort-siloso",
    image: require("../../../assets/landmarks/fort-siloso.webp"),
    name: "Fort Siloso",
    category: "culture",
    lat: 1.259363,
    lng: 103.8086242,
    emoji: "🪖",
    description:
      "Singapore's only preserved coastal fort, a free WWII museum with tunnels, guns, and a skywalk.",
    area: "Sentosa",
    hours: "09:00–18:00",
    tip: "Free; reach it via the Fort Siloso Skywalk",
  },
  {
    id: "skyline-luge-sentosa",
    image: require("../../../assets/landmarks/skyline-luge-sentosa.webp"),
    name: "Skyline Luge Sentosa",
    category: "entertainment",
    lat: 1.2549696,
    lng: 103.8173674,
    emoji: "🛷",
    description:
      "A gravity go-kart ride down winding hillside tracks, paired with a scenic Skyride up.",
    area: "Sentosa",
    hours: "10:00–21:30",
    tip: "Buy multi-ride combos; it's addictive",
  },
  {
    id: "adventure-cove-waterpark",
    image: require("../../../assets/landmarks/adventure-cove-waterpark.webp"),
    name: "Adventure Cove Waterpark",
    category: "entertainment",
    lat: 1.2587643,
    lng: 103.8196847,
    emoji: "🌊",
    description:
      "A waterpark at Resorts World with high-speed slides, a lazy river, and a snorkelling reef.",
    area: "Sentosa",
    hours: "10:00–17:00",
    tip: "Rainbow Reef snorkel is the unique draw",
  },
  {
    id: "siloso-beach",
    image: require("../../../assets/landmarks/siloso-beach.webp"),
    name: "Siloso Beach",
    category: "nature",
    lat: 1.2554915,
    lng: 103.8123885,
    emoji: "🏐",
    description:
      "Sentosa's liveliest beach, lined with beach bars, volleyball nets, and adventure activities.",
    area: "Sentosa",
    hours: "Open 24 hours",
    tip: "Beach clubs and the MegaZip land here",
  },
  {
    id: "robertson-quay",
    image: require("../../../assets/landmarks/robertson-quay.webp"),
    name: "Robertson Quay",
    category: "entertainment",
    lat: 1.2910567,
    lng: 103.8375528,
    emoji: "🍷",
    description:
      "The most relaxed stretch of the Singapore River, lined with riverside cafés, brunch spots, and wine bars.",
    area: "River Valley",
    hours: "Open 24 hours",
    tip: "Best for laid-back weekend brunch",
  },
  {
    id: "sri-srinivasa-perumal-temple",
    image: require("../../../assets/landmarks/sri-srinivasa-perumal-temple.webp"),
    name: "Sri Srinivasa Perumal Temple",
    category: "religious",
    lat: 1.3132706,
    lng: 103.8560729,
    emoji: "🕉️",
    description:
      "A national-monument Hindu temple on Serangoon Road, the start point of the Thaipusam procession.",
    area: "Little India",
    hours: "06:00–12:00, 18:00–21:00",
    tip: "Spectacular during the Thaipusam festival",
  },
  {
    id: "temple-of-1000-lights",
    image: require("../../../assets/landmarks/temple-of-1000-lights.webp"),
    name: "Temple of 1000 Lights",
    category: "religious",
    lat: 1.3147222,
    lng: 103.8569444,
    emoji: "💡",
    description:
      "A Thai-style Buddhist temple (Sakya Muni Buddha Gaya) housing a 15m, 300-tonne seated Buddha.",
    area: "Little India",
    hours: "08:00–16:30",
    tip: "Look for the reclining Buddha chamber behind",
  },
  {
    id: "singapore-art-museum",
    image: require("../../../assets/landmarks/singapore-art-museum.webp"),
    name: "Singapore Art Museum",
    category: "culture",
    lat: 1.2719533,
    lng: 103.836752,
    emoji: "🖌️",
    description:
      "Singapore's contemporary art museum, now in a converted warehouse at Tanjong Pagar Distripark.",
    area: "Tanjong Pagar",
    hours: "10:00–19:00",
    tip: "Enter via the back loading dock—part of the charm",
  },
  {
    id: "gillman-barracks",
    image: require("../../../assets/landmarks/gillman-barracks.webp"),
    name: "Gillman Barracks",
    category: "culture",
    lat: 1.2783333,
    lng: 103.8044444,
    emoji: "🏚️",
    description:
      "A cluster of contemporary art galleries set in restored 1930s colonial military barracks.",
    area: "Alexandra",
    hours: "Galleries 11:00–19:00 (closed Mon)",
    tip: "Free entry; pair with a meal on site",
  },
  {
    id: "coney-island",
    image: require("../../../assets/landmarks/coney-island.webp"),
    name: "Coney Island Park",
    category: "nature",
    isAnchor: true,
    lat: 1.4092951,
    lng: 103.9216496,
    emoji: "🌴",
    description:
      "A rustic, undeveloped island park in the northeast with beaches, mangroves, and cycling trails.",
    area: "Punggol",
    hours: "07:00–19:00",
    tip: "No facilities inside—bring water",
  },
  {
    id: "changi-beach-park",
    image: require("../../../assets/landmarks/changi-beach-park.webp"),
    name: "Changi Beach Park",
    category: "nature",
    lat: 1.3912863,
    lng: 103.9905464,
    emoji: "✈️",
    description:
      "A tranquil eastern beach park with views of Pulau Ubin and low-flying planes landing at Changi.",
    area: "Changi",
    hours: "Open 24 hours",
    tip: "Great plane-spotting near the runway end",
  },
  {
    id: "pasir-ris-park",
    image: require("../../../assets/landmarks/pasir-ris-park.webp"),
    name: "Pasir Ris Park",
    category: "nature",
    lat: 1.3720588,
    lng: 103.95268,
    emoji: "🎣",
    description:
      "A large coastal park in the east with a mangrove boardwalk, fishing pond, and cycling tracks.",
    area: "Pasir Ris",
    hours: "Open 24 hours",
    tip: "Mangrove boardwalk is good for wildlife",
  },
  {
    id: "bishan-ang-mo-kio-park",
    image: require("../../../assets/landmarks/bishan-ang-mo-kio-park.webp"),
    name: "Bishan-Ang Mo Kio Park",
    category: "nature",
    lat: 1.3634088,
    lng: 103.8435614,
    emoji: "🐢",
    description:
      "A heartland park with a naturalised meandering river, popular for walks, otters, and turtles.",
    area: "Bishan",
    hours: "Open 24 hours",
    tip: "Spot the resident otter family at dawn",
  },
  {
    id: "national-stadium",
    image: require("../../../assets/landmarks/national-stadium.webp"),
    name: "National Stadium",
    category: "entertainment",
    lat: 1.3044376,
    lng: 103.8743321,
    emoji: "🏟️",
    description:
      "The centrepiece of the Singapore Sports Hub, a domed stadium hosting major concerts and sports.",
    area: "Kallang",
    hours: "Event days vary",
    tip: "Directly linked to Stadium MRT",
  },
  {
    id: "palawan-beach",
    image: require("../../../assets/landmarks/palawan-beach.webp"),
    name: "Palawan Beach",
    category: "nature",
    lat: 1.2482777,
    lng: 103.8225374,
    emoji: "⛱️",
    description:
      "A family-friendly Sentosa beach with a suspension bridge to the 'southernmost point of continental Asia'.",
    area: "Sentosa",
    hours: "Open 24 hours",
    tip: "Cross the rope bridge to the islet lookout",
  },
  {
    id: "skypark-observation-deck",
    image: require("../../../assets/landmarks/skypark-observation-deck.webp"),
    name: "SkyPark Observation Deck",
    category: "landmark",
    lat: 1.2852044,
    lng: 103.8610313,
    emoji: "🌃",
    description:
      "The observation deck atop Marina Bay Sands, with 360° views 200m above the bay.",
    area: "Marina Bay",
    hours: "10:00–22:00",
    tip: "Sunset slots sell out—book ahead",
  },
  {
    id: "cavenagh-bridge",
    image: require("../../../assets/landmarks/cavenagh-bridge.webp"),
    name: "Cavenagh Bridge",
    category: "landmark",
    lat: 1.2865459,
    lng: 103.8523588,
    emoji: "🏞️",
    description:
      "Singapore's oldest bridge in original form (1869), a pedestrian suspension span by the Fullerton.",
    area: "Civic District",
    hours: "Open 24 hours",
    tip: "Glasgow-made ironwork; lovely lit at night",
  },
  {
    id: "parliament-house",
    image: require("../../../assets/landmarks/parliament-house.webp"),
    name: "Parliament House",
    category: "landmark",
    lat: 1.2891543,
    lng: 103.8504863,
    emoji: "🏢",
    description:
      "Singapore's seat of government by the river, blending colonial and modern architecture.",
    area: "Civic District",
    hours: "08:30–18:00 (Mon–Fri)",
    tip: "Public can watch sittings when in session",
  },
  {
    id: "the-istana",
    image: require("../../../assets/landmarks/the-istana.webp"),
    name: "The Istana",
    category: "landmark",
    lat: 1.3067039,
    lng: 103.8431002,
    emoji: "🏰",
    description:
      "The official residence of Singapore's President, set in vast gardens off Orchard Road.",
    area: "Orchard",
    hours: "Open house on select public holidays",
    tip: "Only open to public on a few holidays a year",
  },
  {
    id: "dempsey-hill",
    image: require("../../../assets/landmarks/dempsey-hill.webp"),
    name: "Dempsey Hill",
    category: "food",
    lat: 1.3039916,
    lng: 103.8098603,
    emoji: "🍴",
    description:
      "A leafy former barracks turned lifestyle enclave of acclaimed restaurants, cafés, and galleries.",
    area: "Tanglin",
    hours: "Daily (venue hours vary)",
    tip: "Great brunch and durian stalls",
  },
  {
    id: "holland-village",
    image: require("../../../assets/landmarks/holland-village.webp"),
    name: "Holland Village",
    category: "food",
    lat: 1.310912,
    lng: 103.7951937,
    emoji: "🍻",
    description:
      "A relaxed expat-favourite enclave of casual eateries, bars, and shops west of the city.",
    area: "Holland Village",
    hours: "Open 24 hours",
    tip: "Lola's and Lorong Mambong for evening drinks",
  },
  {
    id: "peranakan-houses-joo-chiat",
    image: require("../../../assets/landmarks/peranakan-houses-joo-chiat.webp"),
    name: "Koon Seng Road Peranakan Houses",
    category: "culture",
    lat: 1.3103748,
    lng: 103.9024728,
    emoji: "🏘️",
    description:
      "A row of pastel Peranakan shophouses in Joo Chiat, among Singapore's most photogenic heritage facades.",
    area: "Joo Chiat",
    hours: "Open 24 hours",
    tip: "Best photos in late-afternoon golden light",
  },
  {
    id: "geylang-serai-market",
    image: require("../../../assets/landmarks/geylang-serai-market.webp"),
    name: "Geylang Serai Market",
    category: "food",
    lat: 1.3167284,
    lng: 103.8982767,
    emoji: "🍲",
    description:
      "A vibrant Malay wet market and food centre, the heart of Singapore's Malay-Muslim community.",
    area: "Geylang",
    hours: "07:00–22:00 (stalls vary)",
    tip: "Best nasi padang; magical during Ramadan bazaar",
  },
  {
    id: "wild-wild-wet",
    image: require("../../../assets/landmarks/wild-wild-wet.webp"),
    name: "Wild Wild Wet",
    category: "entertainment",
    lat: 1.3775946,
    lng: 103.9544243,
    emoji: "💦",
    description:
      "One of Singapore's largest waterparks, in the east with a wave pool and thrill slides.",
    area: "Pasir Ris",
    hours: "12:00–18:00 (closed Tue)",
    tip: "Weekday afternoons have the shortest queues",
  },
  {
    id: "tanjong-beach",
    image: require("../../../assets/landmarks/tanjong-beach.webp"),
    name: "Tanjong Beach",
    category: "nature",
    lat: 1.241666,
    lng: 103.8294151,
    emoji: "🐚",
    description:
      "The quietest, most laid-back of Sentosa's beaches, home to the stylish Tanjong Beach Club.",
    area: "Sentosa",
    hours: "Open 24 hours",
    tip: "Calmest spot for a relaxed beach day",
  },
  {
    id: "armenian-church",
    image: require("../../../assets/landmarks/armenian-church.webp"),
    name: "Armenian Church",
    category: "religious",
    lat: 1.2930717,
    lng: 103.8494467,
    emoji: "✝️",
    description:
      "Singapore's oldest church (1835), an elegant white landmark with a serene memorial garden.",
    area: "Civic District",
    hours: "10:00–18:00",
    tip: "The garden holds the grave of the Vanda Miss Joaquim breeder",
  },
  {
    id: "sri-thendayuthapani-temple",
    image: require("../../../assets/landmarks/sri-thendayuthapani-temple.webp"),
    name: "Sri Thendayuthapani Temple",
    category: "religious",
    lat: 1.2943222,
    lng: 103.843047,
    emoji: "🔱",
    description:
      "A national-monument Hindu temple (1859) on Tank Road dedicated to Lord Murugan, end point of Thaipusam.",
    area: "River Valley",
    hours: "07:00–12:00, 17:30–20:30",
    tip: "Thaipusam kavadi procession ends here",
  },
  {
    id: "changi-chapel-museum",
    image: require("../../../assets/landmarks/changi-chapel-museum.webp"),
    name: "Changi Chapel and Museum",
    category: "culture",
    lat: 1.362212,
    lng: 103.974025,
    emoji: "🕯️",
    description:
      "A moving museum honouring the WWII POWs and civilians interned at Changi Prison.",
    area: "Changi",
    hours: "09:30–17:30 (closed Mon)",
    tip: "Book the free guided tour for context",
  },
  {
    id: "the-intan",
    image: require("../../../assets/landmarks/the-intan.webp"),
    name: "The Intan",
    category: "culture",
    lat: 1.3146307,
    lng: 103.9009827,
    emoji: "🪞",
    description:
      "A private Peranakan home museum in Joo Chiat, a treasure trove of antiques shared by its passionate owner.",
    area: "Joo Chiat",
    hours: "By appointment only",
    tip: "Book the tea-and-kueh tour in advance",
  },
  {
    id: "skyhelix-sentosa",
    image: require("../../../assets/landmarks/skyhelix-sentosa.webp"),
    name: "SkyHelix Sentosa",
    category: "entertainment",
    lat: 1.2549381,
    lng: 103.817616,
    emoji: "🔭",
    description:
      "Singapore's highest open-air panoramic ride, a gently rotating gondola 79m above Sentosa.",
    area: "Sentosa",
    hours: "10:00–21:15",
    tip: "Go at dusk for day-to-night views",
  },
  {
    id: "wings-of-time",
    image: require("../../../assets/landmarks/wings-of-time.webp"),
    name: "Wings of Time",
    category: "entertainment",
    lat: 1.2513337,
    lng: 103.8170772,
    emoji: "🎆",
    description:
      "A nightly outdoor show on Siloso Beach blending water, lasers, fire, and fireworks over the sea.",
    area: "Sentosa",
    hours: "Shows at 19:40 & 20:40",
    tip: "Premium seats are front and centre",
  },
  {
    id: "pinnacle-duxton-skybridge",
    image: require("../../../assets/landmarks/pinnacle-duxton-skybridge.webp"),
    name: "Pinnacle@Duxton Skybridge",
    category: "landmark",
    lat: 1.2757339,
    lng: 103.8412111,
    emoji: "🌇",
    description:
      "A 50th-storey sky garden atop a landmark public housing complex, with sweeping city and harbour views.",
    area: "Tanjong Pagar",
    hours: "09:00–21:00",
    tip: "Cheap entry with an EZ-Link tap; sunset is best",
  },
  {
    id: "changi-jurassic-mile",
    image: require("../../../assets/landmarks/changi-jurassic-mile.webp"),
    name: "Changi Jurassic Mile",
    category: "entertainment",
    lat: 1.3348184,
    lng: 103.9835053,
    emoji: "🦕",
    description:
      "A free outdoor cycling and walking trail near Changi Airport lined with life-sized dinosaur figures.",
    area: "Changi",
    hours: "Open 24 hours",
    tip: "Rent a bike at Changi Airport's Hub & Spoke",
  },
  {
    id: "tiong-bahru-estate",
    image: require("../../../assets/landmarks/tiong-bahru-estate.webp"),
    name: "Tiong Bahru Estate",
    category: "culture",
    lat: 1.2844955,
    lng: 103.8336334,
    emoji: "🧱",
    description:
      "Singapore's oldest housing estate, a charming 1930s Art Deco enclave of curved low-rises, cafés, and bookshops.",
    area: "Tiong Bahru",
    hours: "Open 24 hours",
    tip: "Wander Eng Hoon and Yong Siak Streets",
  },
];

/**
 * The active landmark set — all 100. The discovery game spans the whole
 * catalogue; what differs per landmark is only {@link isAnchor} (drawn from the
 * start) vs hidden (revealed on discovery), never which ones are "in play".
 */
export const LANDMARKS: Landmark[] = ALL_LANDMARKS;

/** The ten iconic anchors — drawn on the map from the very first launch. */
export const ANCHORS: Landmark[] = ALL_LANDMARKS.filter((l) => l.isAnchor);

/** How many landmarks stay hidden until discovered (the 90). The counter's denominator. */
export const TOTAL_HIDDEN = ALL_LANDMARKS.length - ANCHORS.length;
