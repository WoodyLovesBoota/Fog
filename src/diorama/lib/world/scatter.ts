import * as THREE from "three";
import { WORLD } from "@/diorama/lib/geo";
import { mulberry32, valueNoise } from "@/diorama/lib/noise";
import { PALETTE } from "@/diorama/lib/palette";
import { BANK, type Fields } from "./fields";
import { nearRunway } from "./paint";

/** Per-instance transforms and colours, ready to hand to an `InstancedMesh`. */
export type Instances = { count: number; matrices: Float32Array; colors: Float32Array };

export type Props = {
  roundTrees: Instances;
  coneTrees: Instances;
  /** Palms along the beaches. */
  palms: Instances;
  /** Unit boxes (base at y = 0) scaled into towers, slabs, houses and sheds. */
  blocks: Instances;
  /** Unit pyramids sitting on the low-rise houses. */
  roofs: Instances;
};

class InstanceList {
  private matrices: number[] = [];
  private colors: number[] = [];
  private dummy = new THREE.Object3D();
  private color = new THREE.Color();

  add(x: number, y: number, z: number, sx: number, sy: number, sz: number, rotY: number, hex: string, shade = 1) {
    const { dummy, color } = this;
    dummy.position.set(x, y, z);
    dummy.rotation.set(0, rotY, 0);
    dummy.scale.set(sx, sy, sz);
    dummy.updateMatrix();
    this.matrices.push(...dummy.matrix.elements);
    color.set(hex).multiplyScalar(shade);
    this.colors.push(color.r, color.g, color.b);
  }

  build(): Instances {
    return {
      count: this.colors.length / 3,
      matrices: new Float32Array(this.matrices),
      colors: new Float32Array(this.colors),
    };
  }
}

const TREE_SPACING = 0.2;
const BLOCK_SPACING = 0.3;
const STREET_ANGLES = [0.18, -0.42, 0.7];

/**
 * Plants trees and buildings from the density fields.
 * `keepClear` are spots (landmarks) that should stay unobstructed.
 */
export function scatterProps(fields: Fields, keepClear: readonly (readonly [number, number])[]): Props {
  const rand = mulberry32(20261005);
  const pick = <T,>(list: readonly T[]) => list[(rand() * list.length) | 0];
  const isClear = (x: number, z: number, radius: number) =>
    keepClear.every(([cx, cz]) => (x - cx) ** 2 + (z - cz) ** 2 > radius * radius);

  const roundTrees = new InstanceList();
  const coneTrees = new InstanceList();
  const palms = new InstanceList();
  const blocks = new InstanceList();
  const roofs = new InstanceList();
  const { shore, coast, forest, urban, skyline, industry, airfield, heightAt } = fields;

  // Jittered grids: even coverage without visible rows.
  for (let gz = WORLD.minZ; gz < WORLD.maxZ; gz += TREE_SPACING) {
    for (let gx = WORLD.minX; gx < WORLD.maxX; gx += TREE_SPACING) {
      const x = gx + rand() * TREE_SPACING;
      const z = gz + rand() * TREE_SPACING;
      const jitter = rand();
      const roll = rand();
      const sizeRoll = rand();
      const d = shore.at(x, z);
      if (d > 0.04 && d < BANK[0] - 0.01 && coast.at(x, z) < BANK[0]) {
        // On the sand: the odd palm, away from the docks.
        if (roll < 0.17 && industry.at(x, z) < 0.35 && isClear(x, z, 0.24)) {
          const size = 0.2 + sizeRoll * 0.08;
          palms.add(x, heightAt(x, z), z, size, size, size, jitter * 40, pick(PALETTE.palm));
        }
        continue;
      }
      if (d < BANK[1] + 0.04) continue;

      const f = forest.at(x, z) + (valueNoise(x * 1.9, z * 1.9, 1) - 0.5) * 0.3;
      const built = Math.max(urban.at(x, z), industry.at(x, z));
      const chance = f > 0.55 ? 0.43 : (0.035 + Math.max(0, f) * 0.2) * (1 - Math.min(1, built) * 0.75);
      if (roll > chance || airfield.at(x, z) > 0.45 || !isClear(x, z, 0.24)) continue;

      const size = (f > 0.55 ? 0.15 : 0.12) + sizeRoll * 0.08;
      const y = heightAt(x, z);
      if (jitter < 0.22) coneTrees.add(x, y, z, size * 0.9, size * 1.25, size * 0.9, jitter * 40, pick(PALETTE.treeCone));
      else roundTrees.add(x, y, z, size, size * (0.85 + jitter * 0.3), size, jitter * 40, pick(PALETTE.treeRound));
    }
  }

  for (let gz = WORLD.minZ; gz < WORLD.maxZ; gz += BLOCK_SPACING) {
    for (let gx = WORLD.minX; gx < WORLD.maxX; gx += BLOCK_SPACING) {
      const x = gx + (0.2 + rand() * 0.6) * BLOCK_SPACING;
      const z = gz + (0.2 + rand() * 0.6) * BLOCK_SPACING;
      const roll = rand();
      const a = rand();
      const b = rand();
      const turn = rand() < 0.5 ? 0 : Math.PI / 2;
      if (shore.at(x, z) < BANK[1] + 0.07 || forest.at(x, z) > 0.5 || nearRunway(x, z) || !isClear(x, z, 0.24)) continue;

      const u = urban.at(x, z);
      const ind = industry.at(x, z);
      const sky = skyline.at(x, z);
      const y = heightAt(x, z) - 0.01;
      const rot = STREET_ANGLES[Math.min(2, (valueNoise(x * 0.16, z * 0.16, 3) * 3) | 0)] + turn;
      const house = () => {
        const w = 0.15 + b * 0.05;
        blocks.add(x, y, z, w, 0.09, w, rot, pick(PALETTE.wall));
        roofs.add(x, y + 0.09, z, w * 1.14, 0.1, w * 1.14, rot, pick(PALETTE.roof));
      };

      if (sky > 0.3 && roll < 0.9) {
        // Glass towers
        const w = 0.15 + a * 0.08;
        const h = Math.min(1.45, 0.4 + sky * (0.3 + b * b * 0.9));
        // The taller the tower, the further it has to stand from a landmark to not hide it.
        if (isClear(x, z, 0.24 + h * 0.3)) blocks.add(x, y, z, w, h, w * (0.8 + b * 0.4), rot, pick(PALETTE.glass));
      } else if (ind > 0.55 && ind > u) {
        // Sheds and warehouses
        if (roll < 0.55) {
          const w = 0.22 + a * 0.1;
          const d = 0.15 + b * 0.07;
          const h = 0.07 + b * 0.06;
          blocks.add(x, y, z, w, h, d, rot, pick(PALETTE.shed));
          if (a < 0.4) blocks.add(x, y + h, z, w * 1.04, 0.025, d * 1.04, rot, pick(PALETTE.roof));
        }
      } else if (u > 0.5) {
        if (roll < Math.min(0.85, (u - 0.25) * 1.2)) {
          if (a < 0.6) {
            // Housing slabs with a coloured roof deck
            const w = 0.22 + b * 0.07;
            const d = 0.1 + b * 0.03;
            const h = 0.2 + a * 0.55 + sky * 0.3;
            blocks.add(x, y, z, w, h, d, rot, pick(PALETTE.wall));
            blocks.add(x, y + h, z, w * 1.05, 0.03, d * 1.1, rot, pick(PALETTE.roof));
          } else {
            house();
          }
        }
      } else if (u > 0.22 && roll < 0.16) {
        // Scattered houses on the edge of town
        house();
      }
    }
  }

  return {
    roundTrees: roundTrees.build(),
    coneTrees: coneTrees.build(),
    palms: palms.build(),
    blocks: blocks.build(),
    roofs: roofs.build(),
  };
}
