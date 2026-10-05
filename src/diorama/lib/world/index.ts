import * as THREE from "three";
import { WORLD } from "@/diorama/lib/geo";
import { buildFields, type Fields } from "./fields";
import { paintGround } from "./paint";
import { scatterProps, type Props } from "./scatter";

export type World = {
  fields: Fields;
  /** Height of the walkable surface: the land, or the water where there is none. */
  groundAt(x: number, z: number): number;
  terrain: THREE.BufferGeometry;
  groundTexture: THREE.CanvasTexture;
  /** Signed distance to the shoreline (km, R channel) for the sea shader. */
  shoreTexture: THREE.DataTexture;
  props: Props;
};

const TERRAIN_CELL = 0.08;

function buildTerrain(fields: Fields): THREE.BufferGeometry {
  const nx = Math.round(WORLD.width / TERRAIN_CELL);
  const nz = Math.round(WORLD.depth / TERRAIN_CELL);
  const positions = new Float32Array((nx + 1) * (nz + 1) * 3);
  const uvs = new Float32Array((nx + 1) * (nz + 1) * 2);
  const submerged = new Uint8Array((nx + 1) * (nz + 1));

  for (let j = 0, v = 0; j <= nz; j++) {
    const z = WORLD.minZ + j * TERRAIN_CELL;
    for (let i = 0; i <= nx; i++, v++) {
      const x = WORLD.minX + i * TERRAIN_CELL;
      positions[v * 3] = x;
      positions[v * 3 + 1] = fields.heightAt(x, z);
      positions[v * 3 + 2] = z;
      uvs[v * 2] = i / nx;
      uvs[v * 2 + 1] = 1 - j / nz;
      submerged[v] = fields.shore.at(x, z) < -0.45 ? 1 : 0;
    }
  }

  // Open sea makes up most of the board; skip the quads nobody can see.
  const indices: number[] = [];
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const a = j * (nx + 1) + i;
      const b = a + 1;
      const c = a + nx + 1;
      const d = c + 1;
      if (submerged[a] && submerged[b] && submerged[c] && submerged[d]) continue;
      indices.push(a, c, b, b, c, d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function buildShoreTexture(fields: Fields): THREE.DataTexture {
  const { width, height, data } = fields.shore;
  const half = new Uint16Array(data.length);
  for (let i = 0; i < data.length; i++) half[i] = THREE.DataUtils.toHalfFloat(data[i]);
  const texture = new THREE.DataTexture(half, width, height, THREE.RedFormat, THREE.HalfFloatType);
  texture.minFilter = texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

/** Generates the whole diorama. Synchronous and browser-only (it draws to canvases). */
export function buildWorld(keepClear: readonly (readonly [number, number])[]): World {
  const fields = buildFields();

  const groundTexture = new THREE.CanvasTexture(paintGround(fields));
  groundTexture.colorSpace = THREE.SRGBColorSpace;
  groundTexture.anisotropy = 8;

  return {
    fields,
    groundAt: (x, z) => Math.max(0, fields.heightAt(x, z)),
    terrain: buildTerrain(fields),
    groundTexture,
    shoreTexture: buildShoreTexture(fields),
    props: scatterProps(fields, keepClear),
  };
}
