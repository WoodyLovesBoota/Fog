import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  BackHandler,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  Camera,
  type CameraRef,
  GeoJSONSource,
  Images,
  Layer,
  Map as MapView,
  Marker,
  UserLocation,
} from "@maplibre/maplibre-react-native";

import { colors, fonts, press, shadows, type } from "@/theme/tokens";
import { MAP_STYLE_URL, SINGAPORE_CENTER } from "@/config/mapConfig";
import {
  ensureSingaporePack,
  type DownloadState,
} from "@/map/downloadSingaporePack";
import {
  getCurrentPosition,
  getLastKnownPosition,
  getPermission,
} from "@/services/location";
import { fogMask } from "@/core/exploration/cellGeometry";
import { haversineMeters } from "@/core/exploration/distance";
import { AsyncVisitedRepository } from "@/adapters/storage/VisitedRepository.async";
import {
  enableBackgroundTracking,
  disableBackgroundTracking,
  isBackgroundTrackingActive,
  startForegroundFallback,
  stopForegroundFallback,
} from "@/adapters/location/backgroundTracking";
import { locationEvents } from "@/core/exploration/locationEvents";
import { TOTAL_LAND_CELLS } from "@/data/singaporeLandCells";
import { LandmarkPin } from "@/features/map/LandmarkPin";
import { LANDMARKS, type Landmark } from "@/features/poi/landmarks";
import { newlyDiscovered } from "@/features/poi/discovery";
import { loadCollected, addCollected } from "@/adapters/storage/collectedRepo";
import { DISCOVERY_RADIUS_M } from "@/config/explorationConfig";
import { LandmarkSheet } from "@/components/LandmarkSheet";
import { CollectModal } from "@/components/CollectModal";
import { MultiDiscoverySheet } from "@/components/MultiDiscoverySheet";
import { Hexagon } from "@/components/Hexagon";
import { LiveSignal } from "@/components/LiveSignal";
import { BarsIcon, CrosshairIcon } from "@/components/icons";
import { Toast } from "@/components/Toast";
import { PrimaryButton } from "@/components/PrimaryButton";

const TOAST_MS = 1400;
/** Window after a first back press in which a second press exits the app. */
const BACK_EXIT_MS = 2000;
/** Static initial camera — hoisted so its reference is stable across renders.
    A new object literal here would break <Camera>'s memo every render. */
const INITIAL_VIEW_STATE = { center: SINGAPORE_CENTER, zoom: 15 } as const;
/** Seamless cloud texture tiled across the fog mask (registered via <Images>). */
const CLOUD_TILE = require("../assets/cloud-tile.png");
const CLOUD_IMAGE_ID = "fog-cloud";
/** Static fog paint — hoisted so MapLibre doesn't re-apply the style each render.
    `fill-pattern` paints the cloud texture instead of a flat color; the mask is
    still one feature, so the cloud cover costs nothing per unexplored cell. */
const FOG_PAINT = {
  "fill-pattern": CLOUD_IMAGE_ID,
  "fill-opacity": 0.7,
} as const;
const FOG_IMAGES = { [CLOUD_IMAGE_ID]: CLOUD_TILE } as const;

/** One landmark beacon on the map. Memoized so the frequent screen re-renders
    (toast flashes, tracking toggles, sheet opens) never touch the native
    markers: with a stable `onSelect`, every prop here is reference-equal
    across renders, so MapLibre re-syncs a marker only when the landmark set
    itself changes. The inline closure below is safe — it's inside the memo
    boundary, recreated only when this component actually re-renders. */
const PinMarker = memo(function PinMarker({
  landmark,
  onSelect,
}: {
  landmark: Landmark;
  onSelect: (lm: Landmark) => void;
}) {
  return (
    <Marker
      id={landmark.id}
      lngLat={[landmark.lng, landmark.lat]}
      anchor="top"
      onPress={() => onSelect(landmark)}
    >
      <LandmarkPin landmark={landmark} />
    </Marker>
  );
});

/** The static overlay chrome: Collection/Stats pills + recenter FAB. Memoized
    with stable callbacks so the screen's frequent re-renders (toast flashes,
    fog updates, tracking toggles) never re-render these Pressables — they
    redraw only if the safe-area inset changes. */
const MapChrome = memo(function MapChrome({
  bottomInset,
  onCollection,
  onStats,
  onRecenter,
}: {
  bottomInset: number;
  onCollection: () => void;
  onStats: () => void;
  onRecenter: () => void;
}) {
  return (
    <>
      {/* Collection pill (bottom-left, above Stats). */}
      <Pressable
        onPress={onCollection}
        accessibilityRole="button"
        accessibilityLabel="View collected landmarks"
        style={({ pressed }) => [
          styles.statsBtn,
          { bottom: bottomInset + 148 },
          pressed && press.chip,
        ]}
      >
        <View style={styles.gridIcon}>
          <View style={[styles.gridCell, { backgroundColor: "#7B9CF0" }]} />
          <View style={[styles.gridCell, { backgroundColor: "#9FD6EC" }]} />
          <View style={[styles.gridCell, { backgroundColor: "#A2E3CC" }]} />
          <View style={[styles.gridCell, { backgroundColor: "#B3BEF6" }]} />
        </View>
        <Text style={styles.pillText}>Collection</Text>
      </Pressable>

      {/* Stats pill (bottom-left). */}
      <Pressable
        onPress={onStats}
        accessibilityRole="button"
        accessibilityLabel="View stats"
        style={({ pressed }) => [
          styles.statsBtn,
          { bottom: bottomInset + 96 },
          pressed && press.chip,
        ]}
      >
        <BarsIcon color={colors.blueSoft} size={14} />
        <Text style={styles.pillText}>Stats</Text>
      </Pressable>

      {/* Recenter FAB (bottom-right). */}
      <Pressable
        onPress={onRecenter}
        accessibilityRole="button"
        accessibilityLabel="Recenter to my location"
        style={({ pressed }) => [
          styles.fab,
          { bottom: bottomInset + 96 },
          pressed && press.chip,
        ]}
      >
        <CrosshairIcon color={colors.blueDeep} size={26} />
      </Pressable>
    </>
  );
});

/**
 * Real geographic map screen: MapLibre + Stadia tiles, gated behind a one-time
 * Singapore offline download. Once the pack is cached the map renders fully
 * offline.
 *
 * Fog-of-war: one big mask polygon always covers the whole region; each visited
 * H3 cell is punched out as a hole so the basemap shows through ("cloud
 * cleared"). Because the mask is a single feature, the fog never flickers or
 * "ends" as you pan/zoom — there's no viewport to recompute.
 *
 * Visited cells are persisted (AsyncVisitedRepository): on launch we restore
 * the fog and seed the engine so already-cleared cells don't re-fire, and each
 * new visit is written back.
 *
 * The map itself is untouched chrome; the design's overlay assets ride on top:
 * a hex progress badge, a reset button, a "new area" toast, a Stats pill, a
 * recenter FAB, and a tracking toggle.
 */
export default function MapScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [dl, setDl] = useState<DownloadState>({ status: "idle" });
  const [visitedCells, setVisitedCells] = useState<string[]>([]);
  // 'background' = OS task running (works while away); 'foreground' = fallback
  // watcher (app open only); 'off' = paused.
  const [trackingMode, setTrackingMode] = useState<
    "off" | "foreground" | "background"
  >("off");
  const tracking = trackingMode !== "off";
  const [toast, setToast] = useState<string | null>(null);
  // MapLibre drops camera commands until its style finishes loading, so the
  // initial recenter must wait for this flag (flipped by onDidFinishLoadingMap)
  // rather than firing the instant the download completes.
  const [mapReady, setMapReady] = useState(false);

  // Tapped landmark + its live distance from the user (meters), for the sheet.
  const [selected, setSelected] = useState<Landmark | null>(null);
  const [selectedDistanceM, setSelectedDistanceM] = useState<number | null>(
    null
  );
  // Collected landmark ids (proximity discovery, Step 6) + a ref mirror so the
  // live-fix callback can read the latest set without re-subscribing. This is a
  // separate axis from the visited-cell fog: a landmark is collected by getting
  // within DISCOVERY_RADIUS_M of its coordinate, never by clearing its cell.
  const [collected, setCollected] = useState<Set<string>>(new Set());
  const collectedRef = useRef(collected);
  useEffect(() => {
    collectedRef.current = collected;
  }, [collected]);

  // The batch discovered together and still on screen (Step 6.1). Length decides
  // the presentation: exactly one → the single celebration modal; two or more →
  // the multi-discovery list sheet. A fix in a dense area lands several at once;
  // a fix while the batch is still up merges in (deduped) instead of stacking.
  const [discoveryBatch, setDiscoveryBatch] = useState<Landmark[]>([]);

  // One persistence adapter for the whole screen lifetime.
  const repo = useMemo(() => new AsyncVisitedRepository(), []);

  // Fog mask: rebuilt only when a cell is visited. Always covers the map.
  const fogFC = useMemo(() => fogMask(visitedCells), [visitedCells]);

  // "N% of Singapore explored" — visited cells over the land-cell denominator.
  const progressPct = Math.min(
    100,
    (visitedCells.length / TOTAL_LAND_CELLS) * 100
  );

  // Pins that may render: the 10 anchors (always) + any collected landmark. A
  // hidden landmark's coordinate NEVER reaches the map until it's collected —
  // that's the whole no-spoiler guarantee, so we filter here, not in the JSX.
  const visiblePins = useMemo(
    () => LANDMARKS.filter((l) => l.isAnchor || collected.has(l.id)),
    [collected]
  );

  const cameraRef = useRef<CameraRef>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Mirrors "is a tracking session active?" for the AppState listener, which must
  // read it without re-subscribing on every toggle.
  const trackingRef = useRef(false);
  useEffect(() => {
    trackingRef.current = trackingMode !== "off";
  }, [trackingMode]);

  const flashToast = useCallback((message: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = setTimeout(() => setToast(null), TOAST_MS);
  }, []);

  // A cell crossed the dwell threshold (emitted live by the ingest pipeline).
  // Distance, day streak and persistence now all happen inside ingest, so the
  // screen's only job is to paint the fog and flash the "new area" toast.
  // Landmark collection is a SEPARATE axis (proximity), handled by handleFix —
  // the two fire independently off the same coordinate stream.
  const handleVisited = useCallback(
    (cellId: string) => {
      setVisitedCells((prev) =>
        prev.includes(cellId) ? prev : [...prev, cellId]
      );
      flashToast("New area uncovered · +1 ✦");
    },
    [flashToast]
  );

  // Every accepted fix is also tested for landmark proximity. Anything within
  // DISCOVERY_RADIUS_M of its coordinate (and not already collected) is collected
  // now: we update the set, persist it, and enqueue a discovery card. Reading the
  // set from a ref (not state) keeps this callback stable, so we never resubscribe
  // — and adding to the ref immediately means a still-queued discovery can't be
  // re-enqueued by the next fix while its modal is open.
  const handleFix = useCallback((lat: number, lng: number) => {
    const found = newlyDiscovered(
      { lat, lng },
      LANDMARKS,
      collectedRef.current,
      DISCOVERY_RADIUS_M
    );
    if (found.length === 0) return;
    const next = new Set(collectedRef.current);
    found.forEach((l) => next.add(l.id));
    collectedRef.current = next;
    setCollected(next);
    void addCollected(found.map((l) => l.id));
    // Append to whatever batch is still on screen, skipping any already shown (a
    // still-open batch can pick up more as the user keeps walking), so the same
    // landmark never appears twice. collectedRef already blocks re-discovery, so
    // this only guards duplicates within a single, uninterrupted batch.
    setDiscoveryBatch((prev) => {
      const shown = new Set(prev.map((l) => l.id));
      return [...prev, ...found.filter((l) => !shown.has(l.id))];
    });
  }, []);

  const startDownload = useCallback(() => {
    void ensureSingaporePack(setDl);
  }, []);

  // Hard permission gate: the map is unreachable without location access.
  // Whatever route led here, re-verify; if it's not granted, bounce to the
  // blocked screen instead of rendering the map. `null` = still checking.
  const [authorized, setAuthorized] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const status = await getPermission();
      if (cancelled) return;
      if (status !== "granted") {
        router.replace("/denied");
        return;
      }
      setAuthorized(true);
      startDownload();
    })();
    return () => {
      cancelled = true;
    };
  }, [router, startDownload]);

  // Once authorized: subscribe to live visit events and restore the fog from
  // storage. We deliberately do NOT auto-start tracking here — the app launches
  // in the "off" state and only begins exploring when the user taps "Start
  // Exploring" (see toggleTracking). The ingest pipeline reloads the visited set
  // each batch, so already-cleared cells never re-fire — no seeding needed.
  // We deliberately do NOT stop the background task on unmount: continuing to
  // record while the screen is gone is the entire point of Step 5. Only the
  // screen-scoped foreground fallback is torn down.
  useEffect(() => {
    if (authorized !== true) return;
    let cancelled = false;
    const unsubscribeVisited = locationEvents.onVisited(handleVisited);
    // Proximity discovery rides the same accepted-fix stream the fog uses.
    const unsubscribeFix = locationEvents.onFix((e) => handleFix(e.lat, e.lng));
    (async () => {
      const [savedCells, savedCollected] = await Promise.all([
        repo.load(),
        loadCollected(),
      ]);
      if (cancelled) return;
      setVisitedCells(savedCells); // restore the fog
      const set = new Set(savedCollected);
      collectedRef.current = set;
      setCollected(set); // restore revealed/collected pins
    })();
    return () => {
      cancelled = true;
      unsubscribeVisited();
      unsubscribeFix();
      stopForegroundFallback();
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, [authorized, repo, handleVisited, handleFix]);

  // Android back button: the map is the app's home — backing out of it would
  // otherwise pop to the onboarding/permission screens still on the stack
  // (or close instantly). Instead we swallow the first press with a hint and
  // only exit on a second press within the window — the standard "press back
  // again to exit" pattern. (iOS never fires hardwareBackPress, so this is a
  // no-op there.)
  const lastBackPress = useRef(0);
  useEffect(() => {
    const onBack = () => {
      const now = Date.now();
      if (now - lastBackPress.current < BACK_EXIT_MS) {
        BackHandler.exitApp();
        return true;
      }
      lastBackPress.current = now;
      flashToast("Press back again to exit");
      return true; // block the default pop to onboarding
    };
    const sub = BackHandler.addEventListener("hardwareBackPress", onBack);
    return () => sub.remove();
  }, [flashToast]);

  // A cold start always presents a clean "Start" state. `startLocationUpdatesAsync`
  // persists at the OS level, so a task started in a previous session can outlive
  // a full app kill and keep recording invisibly — which is why a fresh launch
  // would otherwise read "Pause Exploring" (and the fog moved with no one tapping
  // Start). Stop any such orphan so opening the app never means you're secretly
  // already exploring: tracking only runs after an explicit Start in this session.
  // (Backgrounding doesn't remount, so an in-progress session keeps recording —
  // this only fires on a true cold start.)
  useEffect(() => {
    if (authorized !== true) return;
    (async () => {
      if (await isBackgroundTrackingActive()) await disableBackgroundTracking();
    })();
  }, [authorized]);

  // Swap the *live driver* on each app-state change — but never touch the OS task,
  // which stays running for the whole session (that's what keeps the FGS alive and
  // its start out of the forbidden background path). On returning to the foreground
  // we repaint the fog from storage (covers anything the OS task cleared while
  // away) and re-attach the live watcher; on leaving we drop the watcher and hand
  // the baton to the always-on OS task. The watcher flags itself the active driver
  // so exactly one side ingests at a time — no double-count. Only while a session
  // is active (trackingRef), so backgrounding with tracking off does nothing.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") {
        // Keep the previous array identity when nothing changed while away —
        // cells are append-only, so equal length ⇒ same set. This skips the
        // fogMask rebuild + full GeoJSON source re-upload on every foreground.
        void repo
          .load()
          .then((cells) =>
            setVisitedCells((prev) =>
              cells.length === prev.length ? prev : cells
            )
          );
        if (trackingRef.current) void startForegroundFallback();
      } else {
        stopForegroundFallback();
      }
    });
    return () => sub.remove();
  }, [repo]);

  // Snap the camera onto the user as soon as the map is up. We don't wait for
  // the engine's slow high-accuracy first lock: `getLastKnownPosition` returns
  // the OS-cached fix instantly (so the map jumps off the Singapore default
  // immediately), then a fresh `getCurrentPosition` refines it. Only fires once
  // per mount, so the user can pan freely afterwards.
  //
  // We gate on `mapReady` (not just dl.status): MapLibre silently ignores
  // jumpTo/flyTo until its style has loaded, so firing the moment the download
  // finishes would no-op and leave the camera stuck on the Singapore default —
  // the user would then have to tap the recenter FAB to move at all.
  useEffect(() => {
    if (dl.status !== "done" || !mapReady) return;
    let cancelled = false;
    (async () => {
      const last = await getLastKnownPosition();
      if (!cancelled && last) {
        cameraRef.current?.jumpTo({ center: [last.lng, last.lat], zoom: 15 });
      }
      try {
        const pos = await getCurrentPosition();
        if (!cancelled) {
          cameraRef.current?.flyTo({
            center: [pos.lng, pos.lat],
            zoom: 16,
            duration: 500,
          });
        }
      } catch (e) {
        console.warn("initial center failed", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dl.status, mapReady]);

  // Bottom button: pause/resume tracking. Resume re-requests permission and
  // prefers the always-on background task; pause stops whichever driver is live.
  // The busy ref swallows taps while a toggle is still in flight — a double-tap
  // would otherwise race two enable/disable sequences against each other. The
  // mirrored `toggling` state exists purely for the UI: it dims the button and
  // swaps the label ("Starting…"/"Pausing…") so the wait — which can span an OS
  // permission dialog — never reads as an unresponsive tap.
  const togglingRef = useRef(false);
  const [toggling, setToggling] = useState(false);
  const toggleTracking = useCallback(async () => {
    if (togglingRef.current) return;
    togglingRef.current = true;
    setToggling(true);
    try {
      if (trackingMode === "off") {
        // enableBackgroundTracking is our permission gateway; it returns 'ok' when
        // "Always" is granted, 'foreground-only' for "While Using", 'denied' otherwise.
        // On 'ok' it ALSO starts the foreground-service-backed OS task right here —
        // while we're still in the foreground, where starting an FGS is allowed —
        // and we leave it running across background/foreground for the whole
        // session. 'foreground-only' can't run an OS task; the watcher is then its
        // only driver (records only while the app is open).
        const result = await enableBackgroundTracking();
        if (result === "denied") {
          router.replace("/denied");
          return;
        }
        // We're in the foreground now → run the live watcher so the HUD/fog update
        // as you walk with the app open. It marks itself the active driver, so the
        // always-on OS task ('ok' mode) skips ingesting until we background.
        await startForegroundFallback();
        setTrackingMode(result === "ok" ? "background" : "foreground");
      } else {
        stopForegroundFallback();
        await disableBackgroundTracking();
        setTrackingMode("off");
      }
    } finally {
      togglingRef.current = false;
      setToggling(false);
    }
  }, [trackingMode, router]);

  // Tap a beacon → open its detail sheet and resolve the live distance from the
  // user's position. The OS-cached fix fills the distance instantly (no
  // seconds-long "Calculating…" while GPS locks), then a fresh fix refines it.
  // The target ref drops late fixes that belong to a previously-opened
  // landmark, so quickly switching pins can't show the wrong distance.
  const distanceTargetRef = useRef<string | null>(null);
  const openLandmark = useCallback((lm: Landmark) => {
    setSelected(lm);
    setSelectedDistanceM(null);
    distanceTargetRef.current = lm.id;
    const setIfCurrent = (lat: number, lng: number) => {
      if (distanceTargetRef.current !== lm.id) return;
      setSelectedDistanceM(haversineMeters(lat, lng, lm.lat, lm.lng));
    };
    void (async () => {
      const last = await getLastKnownPosition();
      if (last) setIfCurrent(last.lat, last.lng);
      try {
        const pos = await getCurrentPosition();
        setIfCurrent(pos.lat, pos.lng);
      } catch (e) {
        console.warn("distance fix failed", e);
      }
    })();
  }, []);

  const closeSheet = useCallback(() => {
    setSelected(null);
  }, []);

  // A lone discovery drives the single celebration modal; two-or-more routes to
  // the list sheet instead, so `singleDiscovery` is null whenever the sheet owns
  // the batch — the two are mutually exclusive by length.
  const singleDiscovery = discoveryBatch.length === 1 ? discoveryBatch[0] : null;

  // Clearing the batch dismisses whichever surface is up; collection/pins/counter
  // are already committed at discovery time, so this is a pure display dismiss.
  const dismissDiscovery = useCallback(() => setDiscoveryBatch([]), []);

  // Open a landmark's detail from a discovery surface, then dismiss the batch:
  // the single modal's "View details", or a tapped row in the multi sheet.
  const viewDiscoveryDetails = useCallback(
    (lm: Landmark) => {
      openLandmark(lm);
      setDiscoveryBatch([]);
    },
    [openLandmark]
  );

  // Is the currently-selected landmark already collected?
  const selectedCollected = selected != null && collected.has(selected.id);

  // Recenter FAB: glide the camera from wherever the user panned to onto their
  // location. We *fly* (animated) rather than jump — flying to the last-known
  // fix immediately keeps the button responsive, then a fresh fix nudges to the
  // exact spot. (The old jumpTo teleported straight to the last fix, leaving the
  // follow-up flyTo nothing to animate, so it looked like an instant cut.)
  // If the fresh fix lands basically on top of the cached one, skip the second
  // flyTo — restarting the animation mid-glide reads as a stutter for no gain.
  // The in-flight ref swallows repeat taps: without it, mashing the FAB queues
  // overlapping getCurrentPosition calls whose late flyTos restart the glide
  // over and over.
  const recenteringRef = useRef(false);
  const recenter = useCallback(async () => {
    if (recenteringRef.current) return;
    recenteringRef.current = true;
    try {
      const last = await getLastKnownPosition();
      if (last) {
        cameraRef.current?.flyTo({
          center: [last.lng, last.lat],
          zoom: 16,
          duration: 900,
        });
      }
      try {
        const pos = await getCurrentPosition();
        if (last && haversineMeters(pos.lat, pos.lng, last.lat, last.lng) < 25) {
          return;
        }
        cameraRef.current?.flyTo({
          center: [pos.lng, pos.lat],
          zoom: 16,
          duration: 900,
        });
      } catch (e) {
        console.warn("recenter failed", e);
      }
    } finally {
      recenteringRef.current = false;
    }
  }, []);

  // Stable handlers + styles for the memoized chrome/HUD: a new closure or
  // object literal in the JSX would defeat their memo on every re-render.
  const openCollection = useCallback(() => router.push("/collection"), [router]);
  const openStats = useCallback(() => router.push("/stats"), [router]);
  const liveSignalStyle = useMemo(
    () => ({ top: insets.top + 12, right: 20 }),
    [insets.top]
  );
  const walkBtnStyle = useMemo(
    () => ({ ...styles.walkBtn, bottom: insets.bottom + 20 }),
    [insets.bottom]
  );

  if (dl.status !== "done") {
    return (
      <View
        style={[
          styles.center,
          { paddingTop: insets.top, paddingBottom: insets.bottom },
        ]}
      >
        {
          dl.status === "error" ? (
            <>
              <Text style={styles.title}>Couldn't load the map</Text>
              <Text style={styles.subtitle} numberOfLines={2}>
                {dl.message}
              </Text>
              <Pressable
                onPress={startDownload}
                accessibilityRole="button"
                accessibilityLabel="Download map again"
                style={({ pressed }) => [styles.retry, pressed && press.chip]}
              >
                <Text style={styles.retryLabel}>Retry</Text>
              </Pressable>
            </>
          ) : dl.status === "downloading" ? (
            <>
              <ActivityIndicator color={colors.blueDeep} />
              <Text style={styles.subtitle}>
                Preparing Singapore map… {Math.round(dl.progress)}%
              </Text>
            </>
          ) : null /* 'idle': cache check in flight — show a plain background, not
                    a spinner, so returning users don't get a "preparing" flash. */
        }
      </View>
    );
  }

  return (
    <View style={styles.page}>
      {/* After download this renders from the offline cache. */}
      <MapView
        style={styles.map}
        mapStyle={MAP_STYLE_URL}
        attribution
        onDidFinishLoadingMap={() => setMapReady(true)}
      >
        <Camera ref={cameraRef} initialViewState={INITIAL_VIEW_STATE} />
        <UserLocation />

        {/* Register the seamless cloud texture used by the fog fill-pattern. */}
        <Images images={FOG_IMAGES} />

        {/* Fog-of-war: one mask polygon covers the whole region, painted with a
            tiled cloud texture; visited cells are punched out as holes, so the
            basemap shows through there. */}
        <GeoJSONSource id="fog-mask" data={fogFC}>
          <Layer id="fog-fill" type="fill" paint={FOG_PAINT} />
        </GeoJSONSource>

        {/* Landmark beacons — native Markers sit ON TOP of the fog and stay
            visible everywhere, names included. Anchored at the pin head; tapping
            one opens the detail sheet. Only the 10 anchors + already-collected
            landmarks are drawn; the undiscovered 90 are intentionally absent so
            their location can't be read off the map. */}
        {visiblePins.map((lm) => (
          <PinMarker key={lm.id} landmark={lm} onSelect={openLandmark} />
        ))}
      </MapView>

      {/* Progress badge (top-left): hex meter + "% explored". */}
      <View
        style={[styles.progressBadge, { top: insets.top + 12 }]}
        pointerEvents="none"
      >
        <Hexagon
          size={27}
          ratio={30 / 27}
          pct={progressPct}
          inset={5}
          fill={colors.hexFill}
          track={colors.hexTrack}
        />
        <Text style={styles.progressText}>
          {progressPct.toFixed(2)}% explored
        </Text>
      </View>

      {/* Liveness dot (top-right): breathes green while location fixes are
          arriving, rests muted when the pipeline is quiet. */}
      <LiveSignal style={liveSignalStyle} />

      {/* "New area uncovered" toast. */}
      <Toast message={toast} />

      {/* Collection/Stats pills + recenter FAB (memoized chrome). */}
      <MapChrome
        bottomInset={insets.bottom}
        onCollection={openCollection}
        onStats={openStats}
        onRecenter={recenter}
      />

      {/* Tracking toggle (bottom). Disabled while a toggle is in flight, with
          an in-progress label, so the (possibly dialog-length) wait is visible. */}
      <PrimaryButton
        label={
          toggling
            ? trackingMode === "off"
              ? "Starting…"
              : "Pausing…"
            : tracking
              ? "Pause Exploring"
              : "Start Exploring"
        }
        onPress={toggleTracking}
        disabled={toggling}
        style={walkBtnStyle}
      />

      {/* Single discovery → the celebration modal (null when the batch has 2+,
          so it and the sheet below never show together). */}
      <CollectModal
        landmark={singleDiscovery}
        onViewDetails={viewDiscoveryDetails}
        onDismiss={dismissDiscovery}
      />

      {/* 2+ discovered at once → the scrollable list sheet (Step 6.1). Empty
          items keeps it hidden; a tapped row opens that landmark's detail. */}
      <MultiDiscoverySheet
        items={discoveryBatch.length >= 2 ? discoveryBatch : []}
        onSelect={viewDiscoveryDetails}
        onClose={dismissDiscovery}
      />

      {/* Landmark detail bottom sheet (opens on beacon tap / "View details"). */}
      <LandmarkSheet
        landmark={selected}
        distanceM={selectedDistanceM}
        collected={selectedCollected}
        onClose={closeSheet}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.canvas },
  map: { flex: 1 },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    paddingHorizontal: 32,
    backgroundColor: colors.phoneBg,
  },
  title: { ...type.statsTitle, textAlign: "center" },
  subtitle: { ...type.subtitle, textAlign: "center" },
  retry: {
    marginTop: 6,
    paddingVertical: 10,
    paddingHorizontal: 22,
    borderRadius: 999,
    backgroundColor: colors.white,
  },
  retryLabel: { ...type.badge, color: colors.blueDeep },
  progressBadge: {
    position: "absolute",
    left: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    backgroundColor: colors.white,
    borderRadius: 22,
    paddingVertical: 7,
    paddingLeft: 8,
    paddingRight: 15,
    ...shadows.chip,
  },
  progressText: { fontFamily: fonts.display, fontSize: 15, color: colors.ink },
  statsBtn: {
    position: "absolute",
    left: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.white,
    borderRadius: 24,
    paddingVertical: 11,
    paddingHorizontal: 17,
    ...shadows.card,
  },
  pillText: { fontFamily: fonts.display, fontSize: 15, color: colors.ink },
  gridIcon: {
    width: 16,
    height: 16,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 3,
  },
  gridCell: { width: 6.5, height: 6.5, borderRadius: 2 },
  fab: {
    position: "absolute",
    right: 20,
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.white,
    ...shadows.card,
  },
  walkBtn: { position: "absolute", left: 20, right: 20 },
});
