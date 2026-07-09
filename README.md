# Fog

> A Singapore fog-of-war exploration app where the map fills in as you walk

![Expo](https://img.shields.io/badge/Expo-SDK_56-000020?logo=expo)
![React Native](https://img.shields.io/badge/React_Native-0.85-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-6-3178C6?logo=typescript&logoColor=white)
![MapLibre](https://img.shields.io/badge/MapLibre-Native-396CB2)
![Vitest](https://img.shields.io/badge/Tested_with-Vitest-6E9F18?logo=vitest&logoColor=white)

<!-- Screenshots / demo GIF coming soon -->

## Overview

A location-based exploration app that brings a game's fog-of-war into the real world.
Open the app and walk around Singapore, and the fog lifts over the areas you actually
pass through — coloring in a personal map of only the places you've truly been.

- The whole city is divided into 42,530 **H3 hexagon cells** (resolution 10, ~125m)
- A cell counts as visited only after **≥20s of cumulative dwell** — a design robust against GPS jitter
- Getting close to any of ~100 Singapore landmarks unlocks a **collection card**
- All location data stays **on-device** — nothing is transmitted externally

## Features

| Screen | Description |
| --- | --- |
| Splash → Permission | Animated mascot, location permission flow (a settings-nudge screen if denied) |
| Map (main) | MapLibre real map + fog overlay, live location, progress badge, landmark pins |
| Stats | Areas explored, distance traveled, day streak, hexagon progress meter |
| Collection | A ~100-landmark encyclopedia — locked "???" cards until collected |

### Core Behavior
- **Background location tracking** on `expo-task-manager`. Foreground and background
  share the **same ingest pipeline**, so the two paths can't drift apart
- **Dwell detection** — per-cell cumulative timers, defense against momentary GPS
  spikes, and background-gap handling
- **Accuracy filtering** — GPS fixes worse than 50m are discarded
- **Offline map pack** — a one-time Singapore tile download means zero runtime tile calls

## Tech Stack

| Area | Technology |
| --- | --- |
| Framework | Expo SDK 56 (New Architecture), React Native 0.85, React 19 |
| Routing | Expo Router (file-based, typed routes) |
| Maps | @maplibre/maplibre-react-native + Stadia Maps tiles |
| Geospatial | h3-js (Uber H3 hexagon indexing) |
| Location | expo-location + expo-task-manager (background tasks) |
| State | A dependency-free store built on `useSyncExternalStore` |
| Storage | AsyncStorage (on-device only, no backend) |
| Animation | Reanimated 4 + worklets, react-native-svg |
| Testing | Vitest — unit tests for the pure logic core (dwell/distance/ingest) |

## Architecture

A **ports & adapters (hexagonal)** layering keeps a framework-agnostic pure core at the center:

```
src/
├── core/exploration/    # pure logic: H3 cells, dwell detection, distance (+ tests)
├── core/ports/          # interfaces (VisitedRepository …)
├── adapters/            # implementations: AsyncStorage repos, background location
├── background/          # shared ingest pipeline for foreground + background
├── features/poi/        # landmark data + proximity discovery logic
├── config/              # exploration tunables, map config
├── theme/tokens.ts      # single source of design tokens (colors/fonts/spacing/shadows)
└── components/          # UI components
scripts/
├── buildLandCells.ts    # pre-generates 42,530 H3 cells from the Singapore land polygon
└── buildCloudTile.py    # generates a tileable fog-cloud texture
```

- The core is pure TypeScript that knows nothing about React/Expo — verified in isolation with Vitest
- The progress denominator (total land cells) is precomputed at build time for zero runtime cost

## Getting Started

```bash
npm install --legacy-peer-deps   # works around SDK 56 native-module hoisting

# Env var: set EXPO_PUBLIC_STADIA_KEY (Stadia Maps API key) in .env

npx expo run:ios      # or npx expo run:android
```

> This is a prebuilt-workflow project that needs native builds (`ios/`, `android/`)
> because of MapLibre + background location. It does not run in Expo Go.

## Scripts

| Command | Description |
| --- | --- |
| `npm start` | Expo dev server |
| `npm run ios` / `npm run android` | Native build & run |
| `npm test` | Vitest unit tests |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run build:land-cells` | Regenerate the H3 land-cell data |

## Docs

- [PRD.md](PRD.md) — MVP requirements spec (FR/NFR)
- [userflow.png](userflow.png) — screen-flow diagram (maps 1:1 to the route structure)
