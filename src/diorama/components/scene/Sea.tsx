import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { WORLD } from "@/diorama/lib/geo";
import { PALETTE } from "@/diorama/lib/palette";
import type { World } from "@/diorama/lib/world";

/** The water runs far past the generated area in every direction, so no view ever finds its edge. */
const SEA_SIZE = 520;

const SEA_UNIFORMS_GLSL = /* glsl */ `
  uniform sampler2D uShore;
  uniform vec4 uBoard; // minX, minZ, width, depth
  uniform float uTime;
  uniform vec3 uDeep;
  uniform vec3 uMid;
  uniform vec3 uShallow;
  varying vec3 vWorld;

  float seaHash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }
  float seaNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(seaHash(i), seaHash(i + vec2(1.0, 0.0)), f.x),
               mix(seaHash(i + vec2(0.0, 1.0)), seaHash(i + vec2(1.0, 1.0)), f.x), f.y);
  }
`;

const SEA_COLOR_GLSL = /* glsl */ `
  #include <color_fragment>
  {
    float offshore = max(-texture2D(uShore, (vWorld.xz - uBoard.xy) / uBoard.zw).r, 0.0);

    vec3 sea = mix(uShallow, uMid, smoothstep(0.0, 0.75, offshore));
    sea = mix(sea, uDeep, smoothstep(0.5, 3.4, offshore));

    // Slow, broad swell so the open water isn't one flat fill.
    float swell = seaNoise(vWorld.xz * 0.3 + vec2(uTime * 0.05, uTime * 0.03));
    sea += (swell - 0.5) * 0.045;

    // Ripples rolling in towards every shore, fading out with distance.
    float wobble = seaNoise(vWorld.xz * 1.3) * 0.9;
    float phase = fract(offshore * 6.0 + uTime * 0.22 + wobble);
    float ripple = smoothstep(0.4, 0.5, abs(phase - 0.5)) * smoothstep(0.62, 0.1, offshore);
    sea = mix(sea, vec3(1.0), ripple * 0.5);

    // Foam hugging the waterline.
    float lap = 0.05 + 0.018 * sin(uTime * 1.3 + wobble * 6.0);
    sea = mix(sea, vec3(1.0), smoothstep(lap, lap * 0.35, offshore) * 0.92);

    diffuseColor.rgb = sea;
  }
`;

export function Sea({ world }: { world: World }) {
  const time = useRef({ value: 0 });
  useFrame((_, dt) => {
    time.current.value += dt;
  });

  const { surface, seaMaterial } = useMemo(() => {
    const surface = new THREE.PlaneGeometry(SEA_SIZE, SEA_SIZE)
      .rotateX(-Math.PI / 2)
      .translate(WORLD.centerX, 0, WORLD.centerZ);

    const seaMaterial = new THREE.MeshLambertMaterial();
    seaMaterial.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, {
        uShore: { value: world.shoreTexture },
        uBoard: { value: new THREE.Vector4(WORLD.minX, WORLD.minZ, WORLD.width, WORLD.depth) },
        uTime: time.current,
        uDeep: { value: new THREE.Color(PALETTE.seaDeep) },
        uMid: { value: new THREE.Color(PALETTE.seaMid) },
        uShallow: { value: new THREE.Color(PALETTE.seaShallow) },
      });
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nvarying vec3 vWorld;")
        .replace("#include <begin_vertex>", "#include <begin_vertex>\nvWorld = (modelMatrix * vec4(position, 1.0)).xyz;");
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", `#include <common>\n${SEA_UNIFORMS_GLSL}`)
        .replace("#include <color_fragment>", SEA_COLOR_GLSL);
    };

    return { surface, seaMaterial };
  }, [world]);

  return <mesh geometry={surface} material={seaMaterial} receiveShadow raycast={() => null} />;
}
