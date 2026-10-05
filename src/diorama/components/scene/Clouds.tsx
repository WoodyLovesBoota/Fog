import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { WORLD } from "@/diorama/lib/geo";
import { mulberry32, smoothstep } from "@/diorama/lib/noise";
import { PALETTE } from "@/diorama/lib/palette";

const COUNT = 6;
const DRIFT_KM_PER_S = 0.22;
/** Clouds shrink away as you zoom in, so they never sit between you and a landmark. */
const FADE_ZOOM = [40, 60] as const;
const MARGIN = 6;

type Cloud = { x: number; y: number; z: number; size: number; puffs: [number, number, number, number][] };

function makeClouds(): Cloud[] {
  const rand = mulberry32(7);
  return Array.from({ length: COUNT }, (_, i) => {
    const puffCount = 4 + ((rand() * 3) | 0);
    return {
      x: WORLD.minX + ((i + rand() * 0.8) / COUNT) * WORLD.width,
      y: 4.2 + rand() * 2.2,
      // Two lanes, one along the northern edge and one over the southern straits, so
      // clouds drift past the island rather than parking on top of the landmarks.
      z: i % 3 === 0 ? WORLD.minZ + rand() * 2 : WORLD.maxZ - 2 - rand() * 6.5,
      size: 0.6 + rand() * 0.5,
      // x, y, z, radius — a row of overlapping puffs, biggest in the middle
      puffs: Array.from({ length: puffCount }, (_, p): [number, number, number, number] => {
        const t = puffCount === 1 ? 0 : p / (puffCount - 1) - 0.5;
        return [t * 3.4, rand() * 0.35, (rand() - 0.5) * 0.9, 0.75 + (0.5 - Math.abs(t)) * 1.1 + rand() * 0.2];
      }),
    };
  });
}

export function Clouds() {
  const clouds = useMemo(makeClouds, []);
  const refs = useRef<(THREE.Group | null)[]>([]);
  const span = WORLD.width + MARGIN * 2;

  useFrame(({ camera, clock }) => {
    const shown = 1 - smoothstep(FADE_ZOOM[0], FADE_ZOOM[1], camera.zoom);
    clouds.forEach((cloud, i) => {
      const group = refs.current[i];
      if (!group) return;
      const travelled = cloud.x - WORLD.minX + MARGIN + clock.elapsedTime * DRIFT_KM_PER_S;
      group.position.x = WORLD.minX - MARGIN + (travelled % span);
      group.position.y = cloud.y + Math.sin(clock.elapsedTime * 0.4 + i) * 0.12;
      group.visible = shown > 0.01;
      group.scale.setScalar(cloud.size * shown);
    });
  });

  return (
    <>
      {clouds.map((cloud, i) => (
        <group
          key={i}
          ref={(g) => {
            refs.current[i] = g;
          }}
          position={[cloud.x, cloud.y, cloud.z]}
        >
          {cloud.puffs.map(([x, y, z, r], p) => (
            <mesh key={p} position={[x, y, z]} scale={[r, r * 0.82, r]} castShadow raycast={() => null}>
              <sphereGeometry args={[1, 18, 14]} />
              <meshLambertMaterial color={PALETTE.cloud} emissive="#B9B6DC" emissiveIntensity={0.35} />
            </mesh>
          ))}
        </group>
      ))}
    </>
  );
}
