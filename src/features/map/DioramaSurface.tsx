import {
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import type { DOMProps } from 'expo/dom';

import { colors, type } from '@/theme/tokens';
import DioramaMap, {
  type DioramaMapHandle,
} from '@/features/map/diorama/DioramaMap';
import type { LatLng, MapSurfaceProps } from '@/features/map/MapSurface';
import { LANDMARKS } from '@/features/poi/landmarks';
import { getLastKnownPosition, watchPosition } from '@/services/location';

/** WebView settings — hoisted so the reference is stable across renders. The
    scene handles pan/pinch itself, so the page around it must stay put. */
const DOM_PROPS: DOMProps = {
  style: { flex: 1, backgroundColor: colors.phoneBg },
  scrollEnabled: false,
  bounces: false,
  overScrollMode: 'never',
  setBuiltInZoomControls: false,
  showsVerticalScrollIndicator: false,
  showsHorizontalScrollIndicator: false,
};

const LANDMARK_BY_ID = new Map(LANDMARKS.map((l) => [l.id, l]));

/**
 * The 3D island map: a WebGL scene in a WebView (see `diorama/DioramaMap`),
 * driven entirely by the screen's state. It needs no tiles and no network.
 *
 * The scene generates its world on load, which takes a moment on a phone; a
 * cover stays up until it reports ready. Until then the WebView can't take
 * commands, so the screen waits for `onReady` before moving the camera and
 * the latest position fix is replayed once it lands.
 */
export const DioramaSurface = memo(function DioramaSurface({
  ref,
  visitedCells,
  pins,
  selectedId,
  onSelectLandmark,
  onReady,
}: MapSurfaceProps) {
  const dom = useRef<DioramaMapHandle>(null);
  const [ready, setReady] = useState(false);

  useImperativeHandle(
    ref,
    () => ({
      jumpTo: ({ lat, lng }) => dom.current?.moveTo(lat, lng, false),
      flyTo: ({ lat, lng }) => dom.current?.moveTo(lat, lng, true),
    }),
    []
  );

  // "You are here": the OS-cached fix right away, then a live watch.
  const position = useRef<LatLng | null>(null);
  const readyRef = useRef(false);
  const showPosition = useCallback((p: LatLng) => {
    position.current = p;
    if (readyRef.current) dom.current?.setUser(p.lat, p.lng);
  }, []);
  useEffect(() => {
    let cancelled = false;
    void getLastKnownPosition().then((last) => {
      if (!cancelled && last && !position.current) showPosition(last);
    });
    const stop = watchPosition(showPosition);
    return () => {
      cancelled = true;
      stop();
    };
  }, [showPosition]);

  const handleReady = useCallback(async () => {
    readyRef.current = true;
    setReady(true);
    const p = position.current;
    if (p) dom.current?.setUser(p.lat, p.lng);
    onReady();
  }, [onReady]);

  const handleSelect = useCallback(
    async (id: string | null) => {
      onSelectLandmark(id ? (LANDMARK_BY_ID.get(id) ?? null) : null);
    },
    [onSelectLandmark]
  );

  const visibleIds = useMemo(() => pins.map((l) => l.id), [pins]);

  return (
    <View style={styles.root}>
      <DioramaMap
        ref={dom}
        dom={DOM_PROPS}
        visitedCells={visitedCells}
        visibleIds={visibleIds}
        selectedId={selectedId}
        onSelect={handleSelect}
        onReady={handleReady}
      />
      {!ready && (
        <View style={styles.cover} pointerEvents="none">
          <ActivityIndicator color={colors.blueDeep} />
          <Text style={styles.coverText}>Building the island…</Text>
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  root: { flex: 1 },
  cover: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    backgroundColor: colors.phoneBg,
  },
  coverText: { ...type.subtitle, textAlign: 'center' },
});
