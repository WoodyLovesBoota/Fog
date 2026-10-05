import { useEffect, useLayoutEffect, useRef, type ComponentRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { MapControls } from "@react-three/drei/core/MapControls";
import * as THREE from "three";
import { LANDMARK_BY_ID } from "@/diorama/data/landmarks";
import { WORLD } from "@/diorama/lib/geo";
import { clamp } from "@/diorama/lib/noise";
import type { World } from "@/diorama/lib/world";
import { useMap } from "@/diorama/store";

// A fixed, north-up view from the south: the board sits square on the screen.
const AZIMUTH = 0;
/** Tilt away from straight-down. 0 would be a flat plan view; more tilt shows more of the sides. */
const POLAR = THREE.MathUtils.degToRad(56);
const CAMERA_DISTANCE = 140;
export const MAX_ZOOM = 170;
/** Zoom the camera settles at when a landmark is opened (never zooms out to get there). */
const FOCUS_ZOOM = 62;
const PAN_MARGIN = 3;
/** Below this viewport width the info panel is a bottom sheet rather than a side card. */
const NARROW_VIEWPORT = 768;
const PANEL_WIDTH = 420;

/** Where the opening view looks, and the ground (km across, km of screen height) it takes in. */
const HOME = new THREE.Vector3(2.6, 0, -0.6);
const HOME_SPAN = [46, 38] as const;

type Goal = { target: THREE.Vector3; zoom: number };

/** Zoom at which the whole board fits the viewport from the home angle. */
function fitZoom(width: number, height: number): number {
  const right = new THREE.Vector2(Math.cos(AZIMUTH), -Math.sin(AZIMUTH));
  const forward = new THREE.Vector2(-Math.sin(AZIMUTH), -Math.cos(AZIMUTH));
  let halfW = 0;
  let halfH = 0;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const corner = new THREE.Vector2((sx * WORLD.width) / 2, (sz * WORLD.depth) / 2);
      halfW = Math.max(halfW, Math.abs(corner.dot(right)));
      halfH = Math.max(halfH, Math.abs(corner.dot(forward)) * Math.cos(POLAR));
    }
  }
  // The extra height leaves room for the header above and the slab's front face below.
  return Math.min(width / (halfW * 2 + 2), height / (halfH * 2 + 9));
}

export function CameraRig({ world, maxZoom = MAX_ZOOM }: { world: World; maxZoom?: number }) {
  const controls = useRef<ComponentRef<typeof MapControls>>(null);
  const camera = useThree((s) => s.camera) as THREE.OrthographicCamera;
  const size = useThree((s) => s.size);
  const goal = useRef<Goal | null>(null);
  const home = useRef<Goal>({ target: HOME.clone(), zoom: 20 });
  const minZoom = useRef(8);

  const selectedId = useMap((s) => s.selectedId);
  const command = useMap((s) => s.command);

  // Frame the board once, before the first paint.
  const framed = useRef(false);
  useLayoutEffect(() => {
    const fit = fitZoom(size.width, size.height);
    // Open on the island itself, filling the screen; the edge of the board only shows if you zoom out.
    home.current = { target: HOME.clone(), zoom: Math.max(size.width / HOME_SPAN[0], size.height / HOME_SPAN[1]) };
    minZoom.current = fit * 0.8;
    if (framed.current) return;
    framed.current = true;

    const { target, zoom } = home.current;
    camera.position.setFromSphericalCoords(CAMERA_DISTANCE, POLAR, AZIMUTH).add(target);
    camera.zoom = zoom;
    camera.lookAt(target);
    camera.updateProjectionMatrix();
    controls.current!.target.copy(target);
    controls.current!.update();
  }, [camera, size]);

  // Fly to whatever gets selected, leaving room for the info panel.
  useEffect(() => {
    const landmark = selectedId ? LANDMARK_BY_ID.get(selectedId) : null;
    if (!landmark) return;
    const zoom = Math.max(camera.zoom, FOCUS_ZOOM);
    const target = new THREE.Vector3(landmark.x, 0, landmark.z);
    const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
    const up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1).setY(0);
    if (size.width < NARROW_VIEWPORT) {
      // Lift the landmark into the part of the screen the bottom sheet leaves free.
      target.addScaledVector(up.clone().normalize(), -(size.height * 0.22) / (zoom * up.length()));
    } else {
      target.addScaledVector(right, PANEL_WIDTH / 2 / zoom);
    }
    target.y = 0;
    goal.current = { target, zoom };
  }, [selectedId, camera, size, world]);

  useEffect(() => {
    if (!command) return;
    const goHome = (): Goal => ({ target: home.current.target.clone(), zoom: home.current.zoom });
    if (command.kind === "reset") {
      goal.current = goHome();
    } else if (command.kind === "fly") {
      const onBoard =
        command.x > WORLD.minX && command.x < WORLD.maxX && command.z > WORLD.minZ && command.z < WORLD.maxZ;
      const next: Goal = onBoard
        ? {
            target: new THREE.Vector3(command.x, 0, command.z),
            zoom: clamp(command.zoom ?? Math.max(camera.zoom, FOCUS_ZOOM), minZoom.current, maxZoom),
          }
        : goHome();
      if (command.jump) {
        const c = controls.current!;
        camera.position.add(next.target.clone().sub(c.target));
        c.target.copy(next.target);
        camera.zoom = next.zoom;
        camera.updateProjectionMatrix();
        goal.current = null;
      } else {
        goal.current = next;
      }
    } else {
      const from = goal.current ?? { target: controls.current!.target.clone(), zoom: camera.zoom };
      goal.current = { target: from.target, zoom: clamp(from.zoom * command.factor, minZoom.current, maxZoom) };
    }
  }, [command, camera, maxZoom]);

  useFrame((_, dt) => {
    const c = controls.current;
    if (!c) return;
    c.minZoom = minZoom.current;

    const g = goal.current;
    if (g) {
      const k = 1 - Math.exp(-dt * 5.5);
      const step = g.target.clone().sub(c.target).multiplyScalar(k);
      c.target.add(step);
      camera.position.add(step);
      camera.zoom *= Math.pow(g.zoom / camera.zoom, k);
      camera.updateProjectionMatrix();
      if (step.lengthSq() < 1e-8 && Math.abs(g.zoom / camera.zoom - 1) < 0.002) goal.current = null;
    }

    // Keep the board in reach: never let the view centre wander off it.
    const x = clamp(c.target.x, WORLD.minX + PAN_MARGIN, WORLD.maxX - PAN_MARGIN);
    const z = clamp(c.target.z, WORLD.minZ + PAN_MARGIN, WORLD.maxZ - PAN_MARGIN);
    if (x !== c.target.x || z !== c.target.z || c.target.y !== 0) {
      camera.position.x += x - c.target.x;
      camera.position.y -= c.target.y;
      camera.position.z += z - c.target.z;
      c.target.set(x, 0, z);
    }
  });

  return (
    <MapControls
      ref={controls}
      makeDefault
      enableDamping
      dampingFactor={0.14}
      zoomToCursor
      zoomSpeed={1.1}
      maxZoom={maxZoom}
      enableRotate={false}
      touches={{ ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_PAN }}
      // Grabbing the map always wins over an in-flight camera move.
      onStart={() => {
        goal.current = null;
      }}
    />
  );
}
