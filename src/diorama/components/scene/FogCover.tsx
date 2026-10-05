import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { WORLD } from "@/diorama/lib/geo";

/** A patch the fog has lifted from: a closed outline in world space, flat `[x, z, x, z, …]`. */
export type Clearing = readonly number[];

/** `userData` for a material that must stay clear of the fog (a landmark pin, say). */
export const ABOVE_FOG = { aboveFog: true } as const;

/** Texels per km of the cleared-area mask. 40 -> 2400 x 1480; a ~130 m cell is about five texels. */
const MASK_PX_PER_KM = 40;

const FOG_VERTEX_GLSL = /* glsl */ `
  #include <project_vertex>
  #ifdef USE_INSTANCING
    // A tree or a building is fogged as one piece, by where it stands.
    vec4 fogPosition = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  #else
    vec4 fogPosition = vec4(transformed, 1.0);
  #endif
  vFogWorld = (modelMatrix * fogPosition).xyz;
`;

const FOG_GLSL = /* glsl */ `
  uniform sampler2D uFogMask;
  uniform vec4 uFogBoard; // minX, minZ, width, depth
  uniform float uFogTime;
  uniform vec3 uFogLight;
  uniform vec3 uFogShade;
  uniform float uFogOpacity;
  varying vec3 vFogWorld;

  float fogHash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }
  float fogNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(fogHash(i), fogHash(i + vec2(1.0, 0.0)), f.x),
               mix(fogHash(i + vec2(0.0, 1.0)), fogHash(i + vec2(1.0, 1.0)), f.x), f.y);
  }
  float fogFbm(vec2 p) {
    float sum = 0.0;
    float amp = 0.5;
    for (int i = 0; i < 4; i++) {
      sum += amp * fogNoise(p);
      p = p * 2.03 + 17.0;
      amp *= 0.5;
    }
    return sum / 0.9375;
  }

  /** 'color' as seen through whatever fog lies over the map position 'at'. */
  vec3 throughFog(vec3 color, vec2 at) {
    vec2 uv = (at - uFogBoard.xy) / uFogBoard.zw;
    float onBoard = step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0);
    float cleared = texture2D(uFogMask, uv).r * onBoard;

    // The mask is a few texels per cell; a little noise turns its soft edge into a billowy one.
    float wobble = fogNoise(at * 7.0) - 0.5;
    float cover = 1.0 - smoothstep(0.32, 0.68, cleared + wobble * 0.22);

    // Slow drifting puffs, so the cover reads as cloud rather than a flat sheet.
    float puff = fogFbm(at * 0.38 + vec2(uFogTime * 0.035, uFogTime * 0.012));
    vec3 fog = mix(uFogShade, uFogLight, smoothstep(0.28, 0.72, puff));
    // A shaded lip where the fog thins out towards a clearing.
    fog = mix(fog, uFogShade * 0.93, smoothstep(0.0, 0.3, cleared) * 0.6);

    return mix(color, fog, cover * uFogOpacity);
  }
`;

type FogUniforms = Record<string, THREE.IUniform>;

/** Adds the fog to a lit material's shader. Returns a function that takes it back out. */
function shroud(material: THREE.Material, uniforms: FogUniforms): () => void {
  const { onBeforeCompile, customProgramCacheKey } = material;
  // Materials with their own shader patches (sea, buildings) must not share a fogged program.
  const key = `${onBeforeCompile.toString()}|fog`;
  material.onBeforeCompile = (shader, renderer) => {
    onBeforeCompile.call(material, shader, renderer);
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vFogWorld;")
      .replace("#include <project_vertex>", FOG_VERTEX_GLSL);
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\n${FOG_GLSL}`)
      .replace(
        "#include <opaque_fragment>",
        "#include <opaque_fragment>\ngl_FragColor.rgb = throughFog(gl_FragColor.rgb, vFogWorld.xz);",
      );
  };
  material.customProgramCacheKey = () => key;
  material.needsUpdate = true;
  return () => {
    material.onBeforeCompile = onBeforeCompile;
    material.customProgramCacheKey = customProgramCacheKey;
    material.needsUpdate = true;
  };
}

function tracePatch(ctx: CanvasRenderingContext2D, patch: Clearing) {
  ctx.beginPath();
  for (let i = 0; i < patch.length; i += 2) {
    const px = (patch[i] - WORLD.minX) * MASK_PX_PER_KM;
    const py = (patch[i + 1] - WORLD.minZ) * MASK_PX_PER_KM;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  // A hair of overlap, so neighbouring cells merge without a seam of fog between them.
  ctx.stroke();
}

/**
 * Fog of war: cloud over the whole map, lifted wherever the viewer has been.
 *
 * There is no fog geometry. Mounting this patches the fog into every lit material in
 * the scene (ground, sea, scenery, traffic), keyed to each surface's own map position
 * and, for scattered props, to the spot they stand on — so a tower in a cleared cell
 * shows from base to roof and one in fog is hidden entirely, rather than both being
 * cut by a flat sheet. Unlit overlays
 * (sprites, lines, markers) and anything tagged `ABOVE_FOG` are left alone.
 */
export function FogCover({ clearings }: { clearings: readonly Clearing[] }) {
  const scene = useThree((s) => s.scene);

  const { ctx, mask, uniforms } = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = WORLD.width * MASK_PX_PER_KM;
    canvas.height = WORLD.depth * MASK_PX_PER_KM;
    const ctx = canvas.getContext("2d")!;
    ctx.lineJoin = "round";
    ctx.lineWidth = 1.5;

    const mask = new THREE.CanvasTexture(canvas);
    // Canvas rows run north to south, the same way +z does.
    mask.flipY = false;
    mask.generateMipmaps = false;
    mask.minFilter = mask.magFilter = THREE.LinearFilter;

    const uniforms: FogUniforms = {
      uFogMask: { value: mask },
      uFogBoard: { value: new THREE.Vector4(WORLD.minX, WORLD.minZ, WORLD.width, WORLD.depth) },
      uFogTime: { value: 0 },
      uFogLight: { value: new THREE.Color("#FFFFFF") },
      uFogShade: { value: new THREE.Color("#D9D5F0") },
      uFogOpacity: { value: 0.84 },
    };
    return { ctx, mask, uniforms };
  }, []);

  useEffect(() => () => mask.dispose(), [mask]);

  // Runs once the rest of the scene is in the graph and before its first frame is drawn.
  useLayoutEffect(() => {
    const undo = new Map<THREE.Material, () => void>();
    scene.traverse((object) => {
      const { isMesh, material } = object as THREE.Mesh;
      if (!isMesh) return;
      for (const m of Array.isArray(material) ? material : [material]) {
        if (!(m instanceof THREE.MeshLambertMaterial) || m.userData.aboveFog || undo.has(m)) continue;
        undo.set(m, shroud(m, uniforms));
      }
    });
    return () => undo.forEach((restore) => restore());
  }, [scene, uniforms]);

  // Clearings only ever accumulate in normal use, so new ones are punched into the mask
  // as they arrive; it is repainted from scratch only if some were taken away.
  const painted = useRef<Set<Clearing> | null>(null);
  useEffect(() => {
    const done = painted.current;
    const incoming = new Set(clearings);
    let kept = 0;
    done?.forEach((patch) => {
      if (incoming.has(patch)) kept++;
    });
    const fresh = !done || kept !== done.size;
    const next = fresh ? new Set<Clearing>() : done;
    if (fresh) {
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    }
    ctx.fillStyle = ctx.strokeStyle = "#fff";
    let changed = fresh;
    for (const patch of clearings) {
      if (next.has(patch)) continue;
      tracePatch(ctx, patch);
      next.add(patch);
      changed = true;
    }
    painted.current = next;
    if (changed) mask.needsUpdate = true;
  }, [clearings, ctx, mask]);

  useFrame((_, dt) => {
    uniforms.uFogTime.value += dt;
  });

  return null;
}
