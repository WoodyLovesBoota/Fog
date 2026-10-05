import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { LANDMARKS } from "@/diorama/data/landmarks";
import { mulberry32 } from "@/diorama/lib/noise";
import { PALETTE } from "@/diorama/lib/palette";
import type { World } from "@/diorama/lib/world";
import { ROADS } from "@/diorama/data/roads";

const BUS_COUNT = 30;
const MIN_ROUTE_KM = 5;
const BUS_LENGTH = 0.27;
const BUS_COLORS = ["#E5484D", "#E5484D", "#3FA86B", "#F2B43A", "#6E91EE"];

const WALKER_COUNT = 26;
const WALKER_HEIGHT = 0.15;
const SHIRTS = [...PALETTE.roof, "#FFFFFF", "#F8C84E"];
const SKIN = ["#F6D3B3", "#E2B08A", "#C68E63", "#8E5F42"];

/** A road as a polyline you can walk by distance. */
type Route = { points: [number, number][]; lengths: number[]; total: number };

/** Bus routes: every expressway, plus the arterials long enough to be worth a trip. */
function buildRoutes(): Route[] {
  return [...ROADS.expressway, ...ROADS.arterial]
    .map((points) => {
      const lengths = [0];
      for (let i = 1; i < points.length; i++) {
        lengths.push(lengths[i - 1] + Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]));
      }
      return { points, lengths, total: lengths[lengths.length - 1] };
    })
    .filter((route) => route.total > MIN_ROUTE_KM);
}

type Bus = { route: Route; at: number; speed: number; direction: 1 | -1; color: string };
type Walker = { x: number; z: number; radius: number; angle: number; speed: number; shirt: string; skin: string };

function makeBuses(routes: Route[]): Bus[] {
  const rand = mulberry32(11);
  const totalLength = routes.reduce((sum, r) => sum + r.total, 0);
  const buses: Bus[] = [];
  // Longer roads get more buses.
  for (const route of routes) {
    const share = Math.round((route.total / totalLength) * BUS_COUNT);
    for (let i = 0; i < share; i++) {
      buses.push({
        route,
        at: ((i + rand()) / share) * route.total,
        speed: 0.32 + rand() * 0.2,
        direction: rand() < 0.5 ? 1 : -1,
        color: BUS_COLORS[(rand() * BUS_COLORS.length) | 0],
      });
    }
  }
  return buses;
}

function makeWalkers(world: World): Walker[] {
  const rand = mulberry32(23);
  // People stroll in loops around landmarks that have dry ground all the way round.
  const spots = LANDMARKS.filter((l) => world.fields.shore.at(l.x, l.z) > 0.7);
  return Array.from({ length: WALKER_COUNT }, (_, i) => {
    const spot = spots[(i * 7) % spots.length];
    return {
      x: spot.x,
      z: spot.z,
      radius: 0.3 + rand() * 0.14,
      angle: rand() * Math.PI * 2,
      speed: (rand() < 0.5 ? 1 : -1) * (0.1 + rand() * 0.08),
      shirt: SHIRTS[(rand() * SHIRTS.length) | 0],
      skin: SKIN[(rand() * SKIN.length) | 0],
    };
  });
}

/** Buses running the main roads and people strolling around the sights. */
export function Traffic({ world }: { world: World }) {
  const { buses, walkers, parts } = useMemo(() => {
    return {
      buses: makeBuses(buildRoutes()),
      walkers: makeWalkers(world),
      // Unit-length bus pointing along +x, and a unit-tall person, both standing on y = 0.
      parts: {
        busBody: new RoundedBoxGeometry(1, 0.4, 0.36, 2, 0.06).translate(0, 0.25, 0),
        busWindows: new THREE.BoxGeometry(0.86, 0.13, 0.37).translate(0, 0.31, 0),
        busRoof: new RoundedBoxGeometry(0.9, 0.05, 0.3, 1, 0.02).translate(0, 0.46, 0),
        body: new THREE.CapsuleGeometry(0.17, 0.3, 4, 8).translate(0, 0.36, 0),
        head: new THREE.SphereGeometry(0.17, 10, 8).translate(0, 0.83, 0),
        glass: new THREE.MeshLambertMaterial({ color: "#3B4A7A" }),
        white: new THREE.MeshLambertMaterial({ color: "#FFFFFF" }),
      },
    };
  }, [world]);

  const busRefs = useRef<(THREE.Group | null)[]>([]);
  const walkerRefs = useRef<(THREE.Group | null)[]>([]);

  useFrame(({ clock }, dt) => {
    // A background tab can hand back a huge dt; don't let anything teleport.
    const step = Math.min(dt, 0.1);

    buses.forEach((bus, i) => {
      const group = busRefs.current[i];
      if (!group) return;
      const { points, lengths, total } = bus.route;
      bus.at += bus.speed * bus.direction * step;
      // Turn around at either end of the road.
      if (bus.at > total) {
        bus.at = total;
        bus.direction = -1;
      } else if (bus.at < 0) {
        bus.at = 0;
        bus.direction = 1;
      }
      let seg = 1;
      while (seg < lengths.length - 1 && lengths[seg] < bus.at) seg++;
      const [ax, az] = points[seg - 1];
      const [bx, bz] = points[seg];
      const t = (bus.at - lengths[seg - 1]) / (lengths[seg] - lengths[seg - 1]);
      const dx = ((bx - ax) / (lengths[seg] - lengths[seg - 1])) * bus.direction;
      const dz = ((bz - az) / (lengths[seg] - lengths[seg - 1])) * bus.direction;
      const x = ax + (bx - ax) * t;
      const z = az + (bz - az) * t;
      group.position.set(x, world.groundAt(x, z), z);
      group.rotation.y = Math.atan2(-dz, dx);
    });

    walkers.forEach((walker, i) => {
      const group = walkerRefs.current[i];
      if (!group) return;
      walker.angle += (walker.speed / walker.radius) * step;
      const x = walker.x + Math.cos(walker.angle) * walker.radius;
      const z = walker.z + Math.sin(walker.angle) * walker.radius;
      const hop = Math.abs(Math.sin(clock.elapsedTime * 7 + i)) * 0.012;
      group.position.set(x, world.groundAt(x, z) + hop, z);
    });
  });

  return (
    <>
      {buses.map((bus, i) => (
        <group
          key={i}
          ref={(g) => {
            busRefs.current[i] = g;
          }}
          scale={BUS_LENGTH}
        >
          <mesh geometry={parts.busBody} castShadow raycast={() => null}>
            <meshLambertMaterial color={bus.color} />
          </mesh>
          <mesh geometry={parts.busWindows} material={parts.glass} raycast={() => null} />
          <mesh geometry={parts.busRoof} material={parts.white} raycast={() => null} />
        </group>
      ))}
      {walkers.map((walker, i) => (
        <group
          key={i}
          ref={(g) => {
            walkerRefs.current[i] = g;
          }}
          scale={WALKER_HEIGHT}
        >
          <mesh geometry={parts.body} castShadow raycast={() => null}>
            <meshLambertMaterial color={walker.shirt} />
          </mesh>
          <mesh geometry={parts.head} raycast={() => null}>
            <meshLambertMaterial color={walker.skin} />
          </mesh>
        </group>
      ))}
    </>
  );
}
