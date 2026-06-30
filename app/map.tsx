import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

import { colors, fonts, shadows, type } from "@/theme/tokens";
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
import { landmarkCell } from "@/features/poi/collectedLandmarks";
import { LandmarkSheet } from "@/components/LandmarkSheet";
import { CollectModal } from "@/components/CollectModal";
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
  // Landmark to celebrate in the "collected" modal (set when its cell uncovers).
  const [collectLandmark, setCollectLandmark] = useState<Landmark | null>(null);

  // cell id → landmark, so a freshly-visited cell can fire the collected modal
  // and the sheet can tell whether the selected landmark is collected.
  const landmarkByCell = useMemo(() => {
    const m = new Map<string, Landmark>();
    for (const l of LANDMARKS) m.set(landmarkCell(l), l);
    return m;
  }, []);

  // One persistence adapter for the whole screen lifetime.
  const repo = useMemo(() => new AsyncVisitedRepository(), []);

  // Fog mask: rebuilt only when a cell is visited. Always covers the map.
  const fogFC = useMemo(() => fogMask(visitedCells), [visitedCells]);

  // "N% of Singapore explored" — visited cells over the land-cell denominator.
  const progressPct = Math.min(
    100,
    (visitedCells.length / TOTAL_LAND_CELLS) * 100
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
  // screen's only job is to paint the fog and celebrate the new area.
  const handleVisited = useCallback(
    (cellId: string) => {
      setVisitedCells((prev) =>
        prev.includes(cellId) ? prev : [...prev, cellId]
      );
      // If this newly-uncovered cell holds a landmark, celebrate it instead of
      // the generic toast (the modal already says "+1").
      const lm = landmarkByCell.get(cellId);
      if (lm) {
        setCollectLandmark(lm);
      } else {
        flashToast("New area uncovered · +1 ✦");
      }
    },
    [flashToast, landmarkByCell]
  );

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
    const unsubscribe = locationEvents.onVisited(handleVisited);
    (async () => {
      const saved = await repo.load();
      if (!cancelled) setVisitedCells(saved); // restore the fog
    })();
    return () => {
      cancelled = true;
      unsubscribe();
      stopForegroundFallback();
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, [authorized, repo, handleVisited]);

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
        void repo.load().then(setVisitedCells);
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
  const toggleTracking = useCallback(async () => {
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
  }, [trackingMode, router]);

  // Tap a beacon → open its detail sheet and resolve the live distance from the
  // user's current position. Distance stays null (shows "Calculating…") if the fix
  // fails; reopening retries.
  const openLandmark = useCallback((lm: Landmark) => {
    setSelected(lm);
    setSelectedDistanceM(null);
    getCurrentPosition()
      .then((pos) => {
        setSelectedDistanceM(haversineMeters(pos.lat, pos.lng, lm.lat, lm.lng));
      })
      .catch((e) => console.warn("distance fix failed", e));
  }, []);

  const closeSheet = useCallback(() => setSelected(null), []);

  // "View details" on the collected modal → close it, open that landmark's sheet.
  const viewCollectedDetails = useCallback(() => {
    if (collectLandmark) openLandmark(collectLandmark);
    setCollectLandmark(null);
  }, [collectLandmark, openLandmark]);

  // Is the currently-selected landmark's cell already uncovered?
  const selectedCollected =
    selected != null && visitedCells.includes(landmarkCell(selected));

  // Recenter FAB: glide the camera from wherever the user panned to onto their
  // location. We *fly* (animated) rather than jump — flying to the last-known
  // fix immediately keeps the button responsive, then a fresh fix nudges to the
  // exact spot. (The old jumpTo teleported straight to the last fix, leaving the
  // follow-up flyTo nothing to animate, so it looked like an instant cut.)
  const recenter = useCallback(async () => {
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
      cameraRef.current?.flyTo({
        center: [pos.lng, pos.lat],
        zoom: 16,
        duration: 900,
      });
    } catch (e) {
      console.warn("recenter failed", e);
    }
  }, []);

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
                style={styles.retry}
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
            one opens the detail sheet. */}
        {LANDMARKS.map((lm) => (
          <Marker
            key={lm.id}
            id={lm.id}
            lngLat={[lm.lng, lm.lat]}
            anchor="top"
            onPress={() => openLandmark(lm)}
          >
            <LandmarkPin landmark={lm} />
          </Marker>
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

      {/* Live diagnostic signal (top-right): green = the location pipeline is
          alive end-to-end. See LiveSignal for how to read it. */}
      <LiveSignal style={{ top: insets.top + 12, right: 20 }} />

      {/* "New area uncovered" toast. */}
      <Toast message={toast} />

      {/* Collection pill (bottom-left, above Stats). */}
      <Pressable
        onPress={() => router.push("/collection")}
        accessibilityRole="button"
        accessibilityLabel="View collected landmarks"
        style={[styles.statsBtn, { bottom: insets.bottom + 148 }]}
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
        onPress={() => router.push("/stats")}
        accessibilityRole="button"
        accessibilityLabel="View stats"
        style={[styles.statsBtn, { bottom: insets.bottom + 96 }]}
      >
        <BarsIcon color={colors.blueSoft} size={14} />
        <Text style={styles.pillText}>Stats</Text>
      </Pressable>

      {/* Recenter FAB (bottom-right). */}
      <Pressable
        onPress={recenter}
        accessibilityRole="button"
        accessibilityLabel="Recenter to my location"
        style={[styles.fab, { bottom: insets.bottom + 96 }]}
      >
        <CrosshairIcon color={colors.blueDeep} size={26} />
      </Pressable>

      {/* Tracking toggle (bottom). */}
      <PrimaryButton
        label={tracking ? "Pause Exploring" : "Start Exploring"}
        onPress={toggleTracking}
        style={{ ...styles.walkBtn, bottom: insets.bottom + 20 }}
      />

      {/* "New landmark collected" modal (fires when a landmark's cell uncovers). */}
      <CollectModal
        landmark={collectLandmark}
        onViewDetails={viewCollectedDetails}
        onDismiss={() => setCollectLandmark(null)}
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
