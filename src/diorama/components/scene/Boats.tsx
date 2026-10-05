import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { WORLD } from "@/diorama/lib/geo";
import { mulberry32 } from "@/diorama/lib/noise";
import { PALETTE } from "@/diorama/lib/palette";
import type { World } from "@/diorama/lib/world";

const COUNT = 12;
/** Boats only spawn in open water at least this far (km) from any shore. */
const MIN_OFFSHORE = 1.2;
const SAILS = [PALETTE.roof[0], PALETTE.roof[2], "#FFFFFF", PALETTE.roof[3], "#FFFFFF"];

type Boat = { x: number; z: number; heading: number; size: number; phase: number; sail: string };

function placeBoats(world: World): Boat[] {
  const rand = mulberry32(42);
  const boats: Boat[] = [];
  for (let tries = 0; boats.length < COUNT && tries < 2000; tries++) {
    const x = WORLD.minX + 2 + rand() * (WORLD.width - 4);
    const z = WORLD.minZ + 2 + rand() * (WORLD.depth - 4);
    const boat = { x, z, heading: rand() * Math.PI * 2, size: 0.26 + rand() * 0.1, phase: rand() * 10, sail: SAILS[boats.length % SAILS.length] };
    const apart = boats.every((b) => Math.hypot(b.x - x, b.z - z) > 4);
    if (apart && world.fields.shore.at(x, z) < -MIN_OFFSHORE) boats.push(boat);
  }
  return boats;
}

function triangle(points: [number, number][]): THREE.BufferGeometry {
  return new THREE.ShapeGeometry(new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y))));
}

/** A little dinghy, bow towards +x: tapered hull, coloured waterline, mast, mainsail and jib. */
function boatParts() {
  const hull = new THREE.CapsuleGeometry(0.3, 1.1, 6, 12).rotateZ(Math.PI / 2).scale(1, 0.55, 0.9).translate(0, 0.16, 0);
  return {
    hull,
    keel: hull.clone().scale(1.02, 0.5, 1.03).translate(0, -0.02, 0),
    mast: new THREE.CylinderGeometry(0.035, 0.035, 2.1, 5).translate(0.1, 1.3, 0),
    mainsail: triangle([[0.04, 0.5], [0.04, 2.3], [-0.95, 0.5]]),
    jib: triangle([[0.17, 0.45], [0.17, 2.0], [0.85, 0.45]]),
  };
}

/** A handful of sailboats bobbing in the straits, to give the open water some life. */
export function Boats({ world }: { world: World }) {
  const boats = useMemo(() => placeBoats(world), [world]);
  const parts = useMemo(boatParts, []);
  const refs = useRef<(THREE.Group | null)[]>([]);

  useFrame(({ clock }) => {
    boats.forEach((boat, i) => {
      const group = refs.current[i];
      if (!group) return;
      const t = clock.elapsedTime + boat.phase;
      group.position.y = Math.sin(t * 1.4) * 0.025;
      group.rotation.x = Math.sin(t * 1.1) * 0.07;
    });
  });

  return (
    <>
      {boats.map((boat, i) => (
        <group key={i} position={[boat.x, 0, boat.z]} rotation-y={boat.heading} scale={boat.size}>
          <group
            ref={(g) => {
              refs.current[i] = g;
            }}
          >
            <mesh geometry={parts.hull} castShadow raycast={() => null}>
              <meshLambertMaterial color="#FFFFFF" />
            </mesh>
            <mesh geometry={parts.keel} raycast={() => null}>
              <meshLambertMaterial color={boat.sail} />
            </mesh>
            <mesh geometry={parts.mast} raycast={() => null}>
              <meshLambertMaterial color={PALETTE.trunk} />
            </mesh>
            <mesh geometry={parts.mainsail} castShadow raycast={() => null}>
              <meshLambertMaterial color="#FFFFFF" side={THREE.DoubleSide} />
            </mesh>
            <mesh geometry={parts.jib} castShadow raycast={() => null}>
              <meshLambertMaterial color={boat.sail} side={THREE.DoubleSide} />
            </mesh>
          </group>
        </group>
      ))}
    </>
  );
}
