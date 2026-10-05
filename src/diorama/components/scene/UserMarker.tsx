import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { World } from "@/diorama/lib/world";

// On-screen radii, whatever the zoom.
const CORE_PX = 6.5;
const RIM_PX = 9.5;
const HALO_PX = [10, 30] as const;
const PULSE_SECONDS = 2.2;
/** Drawn without depth, over everything else on the map. */
const ORDER = 9;

/** "You are here": a blue puck lying on the ground, with a slow ripple around it. */
export function UserMarker({ world, x, z }: { world: World; x: number; z: number }) {
  const group = useRef<THREE.Group>(null);
  const rim = useRef<THREE.Mesh>(null);
  const core = useRef<THREE.Mesh>(null);
  const halo = useRef<THREE.Mesh>(null);
  const placed = useRef(false);

  const assets = useMemo(() => {
    const overlay = { transparent: true, depthTest: false, depthWrite: false } as const;
    return {
      disc: new THREE.CircleGeometry(1, 32).rotateX(-Math.PI / 2),
      rimMaterial: new THREE.MeshBasicMaterial({ ...overlay, color: "#FFFFFF" }),
      coreMaterial: new THREE.MeshBasicMaterial({ ...overlay, color: "#4F7BEF" }),
      haloMaterial: new THREE.MeshBasicMaterial({ ...overlay, color: "#4F7BEF" }),
    };
  }, []);

  useFrame(({ camera, clock }, dt) => {
    const g = group.current!;
    // Fixes arrive every few seconds; glide between them instead of hopping.
    const k = placed.current ? 1 - Math.exp(-dt * 5) : 1;
    placed.current = true;
    g.position.x += (x - g.position.x) * k;
    g.position.z += (z - g.position.z) * k;
    g.position.y = world.groundAt(g.position.x, g.position.z) + 0.04;

    const unit = 1 / camera.zoom;
    const t = (clock.elapsedTime / PULSE_SECONDS) % 1;
    rim.current!.scale.setScalar(RIM_PX * unit);
    core.current!.scale.setScalar(CORE_PX * unit);
    halo.current!.scale.setScalar((HALO_PX[0] + (HALO_PX[1] - HALO_PX[0]) * t) * unit);
    assets.haloMaterial.opacity = 0.35 * (1 - t);
  });

  return (
    <group ref={group}>
      <mesh ref={halo} geometry={assets.disc} material={assets.haloMaterial} renderOrder={ORDER} raycast={() => null} />
      <mesh ref={rim} geometry={assets.disc} material={assets.rimMaterial} renderOrder={ORDER + 1} raycast={() => null} />
      <mesh ref={core} geometry={assets.disc} material={assets.coreMaterial} renderOrder={ORDER + 2} raycast={() => null} />
    </group>
  );
}
