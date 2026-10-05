import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Line } from "@react-three/drei/core/Line";
import * as THREE from "three";
import { AREAS, areaAt, type Area } from "@/diorama/data/areas";
import { PLAIN_HEIGHT } from "@/diorama/lib/world/fields";
import { useMap } from "@/diorama/store";

/** Height the pointer is projected to, and the highlight drawn at: the level of the plain. */
const LEVEL = PLAIN_HEIGHT + 0.02;

function fillGeometry(area: Area): THREE.BufferGeometry {
  const shapes = area.polygons.map(([outer, ...holes]) => {
    // Shapes are drawn in (x, -z) so that rotating them flat lands them on the map.
    const shape = new THREE.Shape(outer.map(([x, z]) => new THREE.Vector2(x, -z)));
    shape.holes = holes.map((hole) => new THREE.Path(hole.map(([x, z]) => new THREE.Vector2(x, -z))));
    return shape;
  });
  return new THREE.ShapeGeometry(shapes).rotateX(-Math.PI / 2);
}

/**
 * Planning areas: finds the one under the pointer and lights it up. The name tag
 * itself is DOM (see `AreaTag`); this publishes which area is hovered.
 */
export function Regions() {
  const gl = useThree((s) => s.gl);
  const hoveredArea = useMap((s) => s.hoveredArea);
  const area = useMemo(() => AREAS.find((a) => a.name === hoveredArea) ?? null, [hoveredArea]);

  // Built on first hover and kept: 55 areas, a few hundred vertices each.
  const cache = useRef(new Map<string, THREE.BufferGeometry>());
  const fill = useMemo(() => {
    if (!area) return null;
    if (!cache.current.has(area.name)) cache.current.set(area.name, fillGeometry(area));
    return cache.current.get(area.name)!;
  }, [area]);

  // Where the pointer is, in NDC, and whether it is over the map at all.
  const pointer = useRef({ x: 0, y: 0, inside: false, dirty: false });
  useEffect(() => {
    const el = gl.domElement;
    const move = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      pointer.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      pointer.current.inside = true;
      pointer.current.dirty = true;
    };
    const leave = () => {
      pointer.current.inside = false;
      pointer.current.dirty = true;
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerdown", move);
    el.addEventListener("pointerleave", leave);
    return () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerdown", move);
      el.removeEventListener("pointerleave", leave);
    };
  }, [gl]);

  const scratch = useMemo(
    () => ({
      raycaster: new THREE.Raycaster(),
      plane: new THREE.Plane(new THREE.Vector3(0, 1, 0), -LEVEL),
      hit: new THREE.Vector3(),
      ndc: new THREE.Vector2(),
      lastCamera: new THREE.Matrix4(),
    }),
    [],
  );

  useFrame(({ camera }) => {
    // On the MRT tab the pointer names stations instead (see `Mrt`).
    if (useMap.getState().filter === "mrt") {
      if (useMap.getState().hoveredArea) useMap.getState().hoverArea(null);
      pointer.current.dirty = true;
      return;
    }
    const p = pointer.current;
    // Re-test only when the pointer or the camera moved (panning slides the map under a still pointer).
    const cameraMoved = !scratch.lastCamera.equals(camera.matrixWorld) || camera.zoom !== scratch.lastCamera.elements[15];
    if (!p.dirty && !cameraMoved) return;
    p.dirty = false;
    scratch.lastCamera.copy(camera.matrixWorld);
    scratch.lastCamera.elements[15] = camera.zoom;

    let name: string | null = null;
    if (p.inside) {
      scratch.raycaster.setFromCamera(scratch.ndc.set(p.x, p.y), camera);
      if (scratch.raycaster.ray.intersectPlane(scratch.plane, scratch.hit)) {
        name = areaAt(scratch.hit.x, scratch.hit.z)?.name ?? null;
      }
    }
    if (name !== useMap.getState().hoveredArea) useMap.getState().hoverArea(name);
  });

  if (!area || !fill) return null;
  return (
    <group position-y={LEVEL}>
      {/* Drawn over the scenery without depth, so hills and towers inside the area are tinted too. */}
      <mesh geometry={fill} renderOrder={0.5} raycast={() => null}>
        <meshBasicMaterial color="#5C7CE0" transparent opacity={0.26} depthTest={false} depthWrite={false} />
      </mesh>
      {area.polygons.flat().map((ring, i) => (
        <Line
          key={`${area.name}-${i}`}
          points={[...ring, ring[0]].map(([x, z]) => [x, 0, z] as [number, number, number])}
          color="#FFFFFF"
          lineWidth={3}
          transparent
          depthTest={false}
          renderOrder={0.6}
          raycast={() => null}
        />
      ))}
    </group>
  );
}
