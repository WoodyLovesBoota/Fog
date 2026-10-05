import { Suspense, useEffect, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { LANDMARKS } from "@/diorama/data/landmarks";
import { buildWorld, type World } from "@/diorama/lib/world";
import { useMap } from "@/diorama/store";
import { Boats } from "./Boats";
import { CameraRig } from "./CameraRig";
import { Clouds } from "./Clouds";
import { FogCover, type Clearing } from "./FogCover";
import { Landmarks } from "./Landmarks";
import { Mrt } from "./Mrt";
import { Regions } from "./Regions";
import { Scenery } from "./Scenery";
import { Sea } from "./Sea";
import { Terrain } from "./Terrain";
import { Traffic } from "./Traffic";
import { UserMarker } from "./UserMarker";

// Generated once per page load; survives React re-mounts (strict mode, fast refresh).
let cachedWorld: World | null = null;
const getWorld = () => (cachedWorld ??= buildWorld(LANDMARKS.map((l) => [l.x, l.z] as const)));

/** Pointer travel (px) beyond which a press on empty map counts as a drag. */
const CLICK_SLOP = 6;

/**
 * Everything the app drives. With no props at all this is a plain landmark map;
 * the rest turns it into the exploration map.
 */
export type SceneProps = {
  /** Fog of war: the patches already explored. Omit for a map with no fog at all. */
  clearings?: readonly Clearing[];
  /** "You are here", in world space. */
  user?: { x: number; z: number } | null;
  /** Ids of the landmarks to draw. Omit to draw them all. */
  visibleLandmarks?: ReadonlySet<string>;
  /** Where the landmark sprite atlas lives, for hosts that do not serve `/public`. */
  atlasUrl?: string;
  /** How far in the camera may go (px per km). */
  maxZoom?: number;
  /** Side of the sun's shadow map; phones want less than a desktop does. */
  shadowMapSize?: number;
  /** Pointer-hover niceties (planning-area highlight). Pointless under a finger. */
  hover?: boolean;
};

function Lights({ shadowMapSize }: { shadowMapSize: number }) {
  return (
    <>
      <hemisphereLight args={["#FFFFFF", "#C9CCF2", 1.95]} />
      <directionalLight
        color="#FFF3DC"
        intensity={1.75}
        position={[-38, 62, 24]}
        castShadow
        shadow-mapSize={[shadowMapSize, shadowMapSize]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.03}
        shadow-camera-left={-46}
        shadow-camera-right={46}
        shadow-camera-top={36}
        shadow-camera-bottom={-36}
        shadow-camera-near={10}
        shadow-camera-far={160}
      />
    </>
  );
}

export default function Scene({
  clearings,
  user,
  visibleLandmarks,
  atlasUrl,
  maxZoom,
  shadowMapSize = 4096,
  hover = true,
}: SceneProps) {
  const world = getWorld();
  const pressedAt = useRef<[number, number]>([0, 0]);

  useEffect(() => {
    // Two frames: one to mount the scene, one so it is actually on screen.
    const id = requestAnimationFrame(() => requestAnimationFrame(() => useMap.getState().setReady()));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <Canvas
      orthographic
      flat
      shadows
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true }}
      camera={{ near: 1, far: 900, position: [60, 80, 80], zoom: 20 }}
      onPointerDown={(e) => {
        pressedAt.current = [e.clientX, e.clientY];
      }}
      onPointerMissed={(e) => {
        const [x, y] = pressedAt.current;
        if (Math.hypot(e.clientX - x, e.clientY - y) < CLICK_SLOP) useMap.getState().select(null);
      }}
    >
      <Lights shadowMapSize={shadowMapSize} />
      <CameraRig world={world} maxZoom={maxZoom} />
      <Sea world={world} />
      <Terrain world={world} />
      <Scenery world={world} />
      <Traffic world={world} />
      <Boats world={world} />
      {/* Under fog the sky is already full of cloud. */}
      {clearings ? <FogCover clearings={clearings} /> : <Clouds />}
      {hover && <Regions />}
      <Mrt />
      <Suspense fallback={null}>
        <Landmarks world={world} visible={visibleLandmarks} atlasUrl={atlasUrl} />
      </Suspense>
      {user && <UserMarker world={world} x={user.x} z={user.z} />}
    </Canvas>
  );
}
