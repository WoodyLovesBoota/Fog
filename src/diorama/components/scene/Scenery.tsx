import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { PALETTE } from "@/diorama/lib/palette";
import type { World } from "@/diorama/lib/world";
import type { Instances } from "@/diorama/lib/world/scatter";

/** Bakes one flat colour into a geometry's vertices so merged parts keep their own colour. */
function tinted(geometry: THREE.BufferGeometry, hex: string): THREE.BufferGeometry {
  const color = new THREE.Color(hex);
  const count = geometry.getAttribute("position").count;
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) color.toArray(colors, i * 3);
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return geometry;
}

// All prop geometry is authored at unit size with its base on y = 0; instances scale it.
function roundTreeGeometry() {
  return mergeGeometries([
    tinted(new THREE.CylinderGeometry(0.13, 0.17, 0.6, 6).translate(0, 0.3, 0), PALETTE.trunk),
    tinted(new THREE.SphereGeometry(1, 10, 7).scale(1, 0.92, 1).translate(0, 1.25, 0), "#FFFFFF"),
    tinted(new THREE.SphereGeometry(0.62, 8, 6).translate(0.55, 0.95, 0.3), "#F1F1F1"),
  ]);
}

function coneTreeGeometry() {
  return mergeGeometries([
    tinted(new THREE.CylinderGeometry(0.12, 0.15, 0.5, 6).translate(0, 0.25, 0), PALETTE.trunk),
    tinted(new THREE.ConeGeometry(1, 1.5, 9).translate(0, 1.1, 0), "#F1F1F1"),
    tinted(new THREE.ConeGeometry(0.72, 1.3, 9).translate(0, 1.95, 0), "#FFFFFF"),
  ]);
}

function palmGeometry() {
  const fronds = Array.from({ length: 7 }, (_, i) =>
    // A flattened cone, tipped outwards and drooping, fanned around the crown.
    tinted(new THREE.ConeGeometry(0.2, 1.05, 4).scale(1, 1, 0.3).rotateZ(-Math.PI / 2 - 0.42).translate(0.5, 1.72, 0), "#FFFFFF").rotateY(
      (i / 7) * Math.PI * 2,
    ),
  );
  return mergeGeometries([
    tinted(new THREE.CylinderGeometry(0.06, 0.1, 1.85, 6).translate(0, 0.92, 0), PALETTE.trunk),
    tinted(new THREE.SphereGeometry(0.17, 8, 6).translate(0, 1.85, 0), "#F1F1F1"),
    ...fronds,
  ]);
}

/**
 * Lambert with rows of windows drawn on the sides of anything tall enough to have
 * them. The pattern is laid out in real-world size from each instance's own scale,
 * so a tower gets more floors rather than taller windows.
 */
function buildingMaterial() {
  const material = new THREE.MeshLambertMaterial();
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vBlock;\nvarying vec3 vBlockNormal;\nvarying float vBlockHeight;")
      .replace(
        "#include <begin_vertex>",
        /* glsl */ `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec3 blockScale = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
        #else
          vec3 blockScale = vec3(1.0);
        #endif
        vBlock = position * blockScale;
        vBlockNormal = normal;
        vBlockHeight = blockScale.y;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vBlock;\nvarying vec3 vBlockNormal;\nvarying float vBlockHeight;")
      .replace(
        "#include <color_fragment>",
        /* glsl */ `#include <color_fragment>
        if (abs(vBlockNormal.y) < 0.5 && vBlockHeight > 0.15) {
          float along = abs(vBlockNormal.x) > abs(vBlockNormal.z) ? vBlock.z : vBlock.x;
          vec2 grid = vec2(along / 0.05, (vBlock.y - 0.035) / 0.062);
          vec2 cell = fract(grid);
          float pane = step(0.2, cell.x) * step(cell.x, 0.8) * step(0.22, cell.y) * step(cell.y, 0.74);
          pane *= step(0.035, vBlock.y) * step(vBlock.y, vBlockHeight - 0.03);
          // Far away the panes shrink below a pixel; blend to their average tone instead of shimmering.
          float crisp = 1.0 - smoothstep(0.3, 0.8, fwidth(grid.x) + fwidth(grid.y));
          diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.5, 0.64, 0.95), mix(0.3, pane, crisp) * 0.85);
        }`,
      );
  };
  return material;
}

function InstancedProps({
  data,
  geometry,
  material,
}: {
  data: Instances;
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current!;
    mesh.instanceMatrix.array.set(data.matrices);
    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor = new THREE.InstancedBufferAttribute(data.colors, 3);
  }, [data]);

  // The instances cover the whole board, so per-mesh culling would only ever cost time.
  return (
    <instancedMesh
      ref={ref}
      args={[geometry, material, data.count]}
      castShadow
      receiveShadow
      frustumCulled={false}
      raycast={() => null}
    />
  );
}

/** Trees, palms and buildings. */
export function Scenery({ world }: { world: World }) {
  const assets = useMemo(
    () => ({
      roundTree: roundTreeGeometry(),
      coneTree: coneTreeGeometry(),
      palm: palmGeometry(),
      block: new RoundedBoxGeometry(1, 1, 1, 2, 0.07).translate(0, 0.5, 0),
      roof: new THREE.ConeGeometry(Math.SQRT1_2, 1, 4).rotateY(Math.PI / 4).translate(0, 0.5, 0),
      foliage: new THREE.MeshLambertMaterial({ vertexColors: true }),
      building: buildingMaterial(),
      plain: new THREE.MeshLambertMaterial(),
    }),
    [],
  );
  const { props } = world;

  return (
    <>
      <InstancedProps data={props.roundTrees} geometry={assets.roundTree} material={assets.foliage} />
      <InstancedProps data={props.coneTrees} geometry={assets.coneTree} material={assets.foliage} />
      <InstancedProps data={props.palms} geometry={assets.palm} material={assets.foliage} />
      <InstancedProps data={props.blocks} geometry={assets.block} material={assets.building} />
      <InstancedProps data={props.roofs} geometry={assets.roof} material={assets.plain} />
    </>
  );
}
