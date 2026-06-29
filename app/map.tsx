import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
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
import { ExplorationEngine } from "@/core/exploration/explorationEngine";
import { PhoneLocationProvider } from "@/adapters/location/PhoneLocationProvider";
import { fogMask } from "@/core/exploration/cellGeometry";
import { haversineMeters } from "@/core/exploration/distance";
import { AsyncVisitedRepository } from "@/adapters/storage/VisitedRepository.async";
import {
  bumpStreak,
  EMPTY_STATS,
  loadStats,
  saveStats,
  type ExploreStatsData,
} from "@/services/exploreStats";
import { TOTAL_LAND_CELLS } from "@/data/singaporeLandCells";
import { LandmarkPin } from "@/features/map/LandmarkPin";
import { LANDMARKS, type Landmark } from "@/features/poi/landmarks";
import { landmarkCell } from "@/features/poi/collectedLandmarks";
import { LandmarkSheet } from "@/components/LandmarkSheet";
import { CollectModal } from "@/components/CollectModal";
import { Hexagon } from "@/components/Hexagon";
import { BarsIcon, CrosshairIcon } from "@/components/icons";
import { Toast } from "@/components/Toast";
import { PrimaryButton } from "@/components/PrimaryButton";

const TOAST_MS = 1400;
/** Static initial camera — hoisted so its reference is stable across renders.
    A new object literal here would break <Camera>'s memo every render. */
const INITIAL_VIEW_STATE = { center: SINGAPORE_CENTER, zoom: 15 } as const;
/** Static fog paint — hoisted so MapLibre doesn't re-apply the style each render. */
const FOG_PAINT = {
  "fill-color": colors.fogGradient[0],
  "fill-opacity": 0.7,
} as const;
/** GPS jumps larger than this between accepted fixes are noise, not walking. */
const MAX_STEP_M = 100;
/** Persist accumulated distance after this much new ground (avoids per-fix writes). */
const DISTANCE_FLUSH_M = 25;

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
  const [tracking, setTracking] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Tapped landmark + its live distance from the user (meters), for the sheet.
  const [selected, setSelected] = useState<Landmark | null>(null);
  const [selectedDistanceM, setSelectedDistanceM] = useState<number | null>(null);
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
  const progressPct = Math.min(100, (visitedCells.length / TOTAL_LAND_CELLS) * 100);

  const cameraRef = useRef<CameraRef>(null);
  const engineRef = useRef<ExplorationEngine | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Derived stats (distance + day streak), accumulated live and persisted.
  const statsRef = useRef<ExploreStatsData>({ ...EMPTY_STATS });
  const lastCoordRef = useRef<{ lat: number; lng: number } | null>(null);
  const savedDistanceRef = useRef(0);

  const persistStats = useCallback(() => {
    void saveStats(statsRef.current);
    savedDistanceRef.current = statsRef.current.distanceM;
  }, []);

  const flashToast = useCallback((message: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = setTimeout(() => setToast(null), TOAST_MS);
  }, []);

  // Spin up the engine seeded with `seed` (already-visited cells). Each new
  // visit colors the fog, persists, and flashes a toast.
  const startEngine = useCallback(
    (seed: string[]) => {
      const engine = new ExplorationEngine(
        new PhoneLocationProvider(),
        (cellId) => {
          setVisitedCells((prev) =>
            prev.includes(cellId) ? prev : [...prev, cellId]
          );
          void repo.add([cellId]);
          // A new area today extends the day streak; persist the whole stat blob.
          statsRef.current = bumpStreak(statsRef.current, Date.now());
          persistStats();
          // If this newly-uncovered cell holds a landmark, celebrate it instead
          // of the generic toast (the modal already says "+1").
          const lm = landmarkByCell.get(cellId);
          if (lm) {
            setCollectLandmark(lm);
          } else {
            flashToast("New area uncovered · +1 ✦");
          }
        },
        ({ lat, lng }) => {
          // Accumulate real walked distance between consecutive accepted fixes.
          const prev = lastCoordRef.current;
          if (prev) {
            const step = haversineMeters(prev.lat, prev.lng, lat, lng);
            if (step > 0 && step < MAX_STEP_M) {
              statsRef.current.distanceM += step;
              if (statsRef.current.distanceM - savedDistanceRef.current >= DISTANCE_FLUSH_M) {
                persistStats();
              }
            }
          }
          lastCoordRef.current = { lat, lng };
        },
        seed
      );
      engineRef.current = engine;
      engine.start().catch((e) => console.warn("engine start failed", e));
      setTracking(true);
    },
    [repo, flashToast, persistStats, landmarkByCell]
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

  // Restore saved progress + stats once authorized, then start the engine seeded.
  useEffect(() => {
    if (authorized !== true) return;
    let cancelled = false;
    (async () => {
      const [saved, stats] = await Promise.all([repo.load(), loadStats()]);
      if (cancelled) return;
      statsRef.current = stats;
      savedDistanceRef.current = stats.distanceM;
      setVisitedCells(saved); // restore the fog
      startEngine(saved); // seed so restored cells don't re-fire
    })();
    return () => {
      cancelled = true;
      engineRef.current?.stop();
      engineRef.current = null;
      lastCoordRef.current = null;
      if (toastTimer.current) clearTimeout(toastTimer.current);
      persistStats(); // flush any unsaved distance
    };
  }, [authorized, repo, startEngine, persistStats]);

  // Snap the camera onto the user as soon as the map is up. We don't wait for
  // the engine's slow high-accuracy first lock: `getLastKnownPosition` returns
  // the OS-cached fix instantly (so the map jumps off the Singapore default
  // immediately), then a fresh `getCurrentPosition` refines it. Only fires once
  // per mount, so the user can pan freely afterwards.
  useEffect(() => {
    if (dl.status !== "done") return;
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
  }, [dl.status]);

  // Bottom button: pause/resume live GPS tracking (really stops/starts the watch).
  const toggleTracking = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.stop();
      engineRef.current = null;
      lastCoordRef.current = null; // don't bridge a gap across the pause
      persistStats();
      setTracking(false);
    } else {
      startEngine(visitedCells);
    }
  }, [startEngine, visitedCells, persistStats]);

  // Tap a beacon → open its detail sheet and resolve the live distance from the
  // user's current position. Distance stays null (shows "계산 중…") if the fix
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

  // Recenter FAB: fly the camera back to the current position.
  const recenter = useCallback(async () => {
    try {
      const pos = await getCurrentPosition();
      cameraRef.current?.flyTo({ center: [pos.lng, pos.lat], zoom: 15, duration: 600 });
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
        {dl.status === "error" ? (
          <>
            <Text style={styles.title}>지도를 불러오지 못했어요</Text>
            <Text style={styles.subtitle} numberOfLines={2}>
              {dl.message}
            </Text>
            <Pressable
              onPress={startDownload}
              accessibilityRole="button"
              accessibilityLabel="지도 다시 다운로드"
              style={styles.retry}
            >
              <Text style={styles.retryLabel}>다시 시도</Text>
            </Pressable>
          </>
        ) : dl.status === "downloading" ? (
          <>
            <ActivityIndicator color={colors.blueDeep} />
            <Text style={styles.subtitle}>
              싱가포르 지도 준비 중… {Math.round(dl.progress)}%
            </Text>
          </>
        ) : null /* 'idle': cache check in flight — show a plain background, not
                    a spinner, so returning users don't get a "준비 중" flash. */}
      </View>
    );
  }

  return (
    <View style={styles.page}>
      {/* After download this renders from the offline cache. */}
      <MapView style={styles.map} mapStyle={MAP_STYLE_URL} attribution>
        <Camera ref={cameraRef} initialViewState={INITIAL_VIEW_STATE} />
        <UserLocation />

        {/* Fog-of-war: one mask polygon covers the whole region; visited cells
            are punched out as holes, so the basemap shows through there. */}
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
      <View style={[styles.progressBadge, { top: insets.top + 12 }]} pointerEvents="none">
        <Hexagon
          size={27}
          ratio={30 / 27}
          pct={progressPct}
          inset={5}
          fill={colors.hexFill}
          track={colors.hexTrack}
        />
        <Text style={styles.progressText}>{progressPct.toFixed(2)}% explored</Text>
      </View>

      {/* "New area uncovered" toast. */}
      <Toast message={toast} />

      {/* Collection pill (bottom-left, above Stats). */}
      <Pressable
        onPress={() => router.push("/collection")}
        accessibilityRole="button"
        accessibilityLabel="수집한 랜드마크 보기"
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
        accessibilityLabel="통계 보기"
        style={[styles.statsBtn, { bottom: insets.bottom + 96 }]}
      >
        <BarsIcon color={colors.blueSoft} size={14} />
        <Text style={styles.pillText}>Stats</Text>
      </Pressable>

      {/* Recenter FAB (bottom-right). */}
      <Pressable
        onPress={recenter}
        accessibilityRole="button"
        accessibilityLabel="내 위치로 이동"
        style={[styles.fab, { bottom: insets.bottom + 90 }]}
      >
        <CrosshairIcon color={colors.blueDeep} size={26} />
      </Pressable>

      {/* Tracking toggle (bottom). */}
      <PrimaryButton
        label={tracking ? "탐험 일시정지" : "탐험 시작"}
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
  gridIcon: { width: 16, height: 16, flexDirection: "row", flexWrap: "wrap", gap: 3 },
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
