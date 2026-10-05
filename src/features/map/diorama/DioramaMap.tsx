'use dom';

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type Ref,
} from 'react';
import {
  useDOMImperativeHandle,
  type DOMImperativeFactory,
  type DOMProps,
} from 'expo/dom';
import { cellToBoundary } from 'h3-js';

import { labelElements } from '@/diorama/components/labelRegistry';
import type { Clearing } from '@/diorama/components/scene/FogCover';
import Scene from '@/diorama/components/scene/Scene';
import { ATLAS_DATA_URL } from '@/diorama/data/atlas';
import { LANDMARKS } from '@/diorama/data/landmarks';
import { toWorld } from '@/diorama/lib/geo';
import { useMap } from '@/diorama/store';

/**
 * The 3D island, running in a WebView (an Expo DOM component). Everything
 * under `@/diorama` is the scene itself (three.js, no knowledge of the app);
 * this file is the adapter that feeds it Fog's state and reports taps back.
 *
 * Runs in a browser context: no React Native imports here, and every prop
 * crosses a JSON bridge (functions become async calls into the app).
 */

/** Camera zoom (px per km) for "show me where I am": about a kilometre across a phone. */
const FOLLOW_ZOOM = 220;
/** A visited cell is ~130 m across, so the camera needs to get far closer than the web map lets it. */
const MAX_ZOOM = 320;
/** Half the desktop default — plenty at phone size, and a quarter of the memory. */
const SHADOW_MAP_SIZE = 2048;

export interface DioramaMapHandle extends DOMImperativeFactory {
  /** `(lat, lng, animated)` — centre the camera on a position. */
  moveTo: DOMImperativeFactory[string];
  /** `(lat, lng)` — place the "you are here" marker. */
  setUser: DOMImperativeFactory[string];
}

type Props = {
  ref?: Ref<DioramaMapHandle>;
  dom?: DOMProps;
  visitedCells: string[];
  /** Ids of the landmarks to draw (anchors + collected). */
  visibleIds: string[];
  selectedId: string | null;
  onSelect: (id: string | null) => Promise<void>;
  onReady: () => Promise<void>;
};

/**
 * An H3 cell's outline in the scene's world space. Cached, and not only for
 * speed: the scene punches each clearing into its fog mask once, telling them
 * apart by identity — so a cell must map to the same array every time, even
 * though `visitedCells` arrives as a fresh array whenever it crosses the bridge.
 */
const outlines = new Map<string, Clearing>();
function cellClearing(cellId: string): Clearing {
  let outline = outlines.get(cellId);
  if (!outline) {
    // `true` = [lng, lat] order.
    outline = cellToBoundary(cellId, true).flatMap(([lng, lat]) => toWorld(lng, lat));
    outlines.set(cellId, outline);
  }
  return outline;
}

export default function DioramaMap({
  ref,
  visitedCells,
  visibleIds,
  selectedId,
  onSelect,
  onReady,
}: Props) {
  const clearings = useMemo(() => visitedCells.map(cellClearing), [visitedCells]);

  const visible = useMemo(() => new Set(visibleIds), [visibleIds]);
  // Position fixes arrive through the handle, not as a prop: a prop change
  // re-sends every prop across the bridge, visited cells included.
  const [user, setUser] = useState<{ x: number; z: number } | null>(null);

  useDOMImperativeHandle(
    ref as Ref<DioramaMapHandle>,
    () => ({
      moveTo: (lat, lng, animated) => {
        const [x, z] = toWorld(lng as number, lat as number);
        useMap.getState().send({ kind: 'fly', x, z, zoom: FOLLOW_ZOOM, jump: !animated });
      },
      setUser: (lat, lng) => {
        const [x, z] = toWorld(lng as number, lat as number);
        setUser({ x, z });
      },
    }),
    []
  );

  // Selection is owned by the app (it decides whether a sheet opens). The scene
  // keeps its own copy for the highlight + camera glide; mirror the app's into
  // it, and report only the changes that started in here — i.e. taps.
  const appSelectedId = useRef(selectedId);
  useEffect(() => {
    appSelectedId.current = selectedId;
    if (useMap.getState().selectedId !== selectedId) useMap.getState().select(selectedId);
  }, [selectedId]);
  useEffect(
    () =>
      useMap.subscribe((state, previous) => {
        if (state.selectedId === previous.selectedId) return;
        if (state.selectedId !== appSelectedId.current) void onSelect(state.selectedId);
      }),
    [onSelect]
  );

  const ready = useMap((s) => s.ready);
  useEffect(() => {
    if (ready) void onReady();
  }, [ready, onReady]);

  return (
    <div style={styles.page}>
      <Scene
        clearings={clearings}
        user={user}
        visibleLandmarks={visible}
        atlasUrl={ATLAS_DATA_URL}
        maxZoom={MAX_ZOOM}
        shadowMapSize={SHADOW_MAP_SIZE}
        hover={false}
      />
      {/* Name tags: the scene moves and shows these itself, one per landmark. */}
      <div style={styles.labels}>
        {LANDMARKS.map((l) => (
          <div
            key={l.id}
            ref={(el) => {
              if (el) labelElements.set(l.id, el);
              else labelElements.delete(l.id);
            }}
            style={styles.label}
          >
            {l.name}
          </div>
        ))}
      </div>
    </div>
  );
}

const styles: Record<'page' | 'labels' | 'label', CSSProperties> = {
  page: {
    position: 'fixed',
    inset: 0,
    overflow: 'hidden',
    // The scene handles every gesture itself; the page must never scroll or zoom.
    touchAction: 'none',
    userSelect: 'none',
    WebkitUserSelect: 'none',
    WebkitTouchCallout: 'none',
    background: 'linear-gradient(180deg, #F1EFFB 0%, #DCD8F0 100%)',
  },
  labels: { position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' },
  label: {
    position: 'absolute',
    top: 0,
    left: 0,
    opacity: 0,
    transition: 'opacity 200ms',
    willChange: 'transform',
    whiteSpace: 'nowrap',
    padding: '2px 10px',
    borderRadius: 999,
    background: 'rgba(255, 255, 255, 0.92)',
    boxShadow: '0 3px 10px rgba(70, 80, 140, 0.22)',
    color: '#2C2F60',
    font: '600 11.5px/20px ui-rounded, system-ui, sans-serif',
  },
};
