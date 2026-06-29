# Fog — Singapore Exploration Coloring App

Walk around the city and watch the fog lift, coloring in the world you've
actually been to. A *fog-of-war* exploration tracker built with **React Native +
Expo (managed) + Expo Router + TypeScript**.

This repo implements the **frontend** described in [`PRD.md`](PRD.md), wired to
the design in [`handoff/project/prototype.html`](handoff/project/prototype.html)
and the navigation in [`userflow.png`](userflow.png).

## Run it

```bash
npm install --legacy-peer-deps   # see "Install note" below
npx expo start
```

Then press `i` (iOS simulator), `a` (Android), or scan the QR with Expo Go.

Useful scripts:

```bash
npm run typecheck   # tsc --noEmit  (passes clean)
npx expo export --platform ios      # production bundle (verified building)
npx expo export --platform android  # verified building
```

> **Install note:** the project pins SDK 56 native modules. Because a couple of
> transitive peers (`babel-preset-expo`, `react-native-worklets`, `expo-linking`)
> need to be hoisted to the project root, install with `--legacy-peer-deps`.

## Screens & flow

Navigation follows `userflow.png` exactly (Expo Router, file-based):

| Route | Screen | Key actions |
| --- | --- | --- |
| `/` | **Splash** | "Get Started" → Permission |
| `/permission` | **Allow location** | "Allow Location" → requests OS permission → Map (granted) / Denied (refused). "Maybe later" → Denied |
| `/denied` | **Location off** | "Open Settings" (opens OS settings) · "Continue exploring anyway" → Map |
| `/map` | **Map (main)** | fog grid, tap to uncover, "Start walking" demo, progress badge, reset, Stats |
| `/stats` | **Your Exploration** | hex progress meter + stats card, "Back to Map" |

## How it maps to the PRD

- **Fog of war (FR-4/5/6):** every grid cell starts under a cloud; uncovering a
  cell reveals the colorful city beneath. Visited cells persist via
  `AsyncStorage` and survive relaunch.
- **Tracking & coloring (FR-8…13):** real foreground GPS (`expo-location`) feeds
  the store, which drops low-accuracy fixes (>50 m) and requires ~20 s of
  cumulative dwell before a cell counts — with per-cell accumulators so brief
  GPS jitter doesn't reset progress.
- **Demo without walking:** since a simulator never moves, the **Start walking**
  button replays a scripted route (the prototype's `routeArr`) through the same
  coloring pipeline, so every behavior is visible on a desk.
- **Progress & stats (FR-14/15):** visited / total cells drive the `% explored`
  badge and the Stats screen (areas, distance, neighborhoods, streak).
- **Privacy (NFR-5):** location data never leaves the device.

## Architecture

```
app/                       # Expo Router screens (one file per route)
  _layout.tsx              # fonts, splash, Stack navigator
  index / permission / denied / map / stats
src/
  theme/tokens.ts          # all colors, fonts, radii, spacing, shadows (from the handoff)
  components/              # CloudFace, PrimaryButton, Hexagon, Toast, Screen, icons
  features/
    map/                   # grid math + MapBase, PoiLayer, FogLayer, LocationDot (SVG)
    explore/               # store (useSyncExternalStore), seed/route/geo data
  services/                # location (expo-location), storage (AsyncStorage)
```

- **Styling** lives entirely in `src/theme/tokens.ts`; components never hardcode
  a color, radius, or font.
- **State** is a tiny dependency-free store (`useSyncExternalStore`) so the map,
  badge, and stats stay in sync without prop-drilling.
- **The map** is drawn with `react-native-svg` (gradient land/sea/parks, cloud
  cells) over the design's 8×19 offset grid, scaled to any screen.
- **Data layer:** `services/location.ts` is the single seam for GPS — swap the
  real `expo-location` watcher for a mock without touching the UI.

## Notes / interpretations

- "Color the map" is implemented as the prototype intends — fog clouds clear to
  reveal the vivid base map underneath (the color *is* the revealed city).
- The custom in-prototype status bar (`9:41`, battery) is the OS status bar in
  the real app.
- Map tiles are stylized (matching the handoff), not a live tile provider; the
  PRD leaves Mapbox-vs-Google to a later milestone, and the design is a
  stylized city, so no map SDK is pulled in for the MVP.
