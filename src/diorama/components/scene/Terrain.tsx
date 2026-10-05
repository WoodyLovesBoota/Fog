import type { World } from "@/diorama/lib/world";

export function Terrain({ world }: { world: World }) {
  return (
    <mesh geometry={world.terrain} castShadow receiveShadow raycast={() => null}>
      <meshLambertMaterial map={world.groundTexture} />
    </mesh>
  );
}
