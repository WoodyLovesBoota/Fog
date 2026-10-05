import { useEffect, useMemo, useRef } from "react";
import { useFrame, useLoader, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { ATLAS, CATEGORIES, LANDMARKS, type Landmark } from "@/diorama/data/landmarks";
import { PALETTE } from "@/diorama/lib/palette";
import type { World } from "@/diorama/lib/world";
import { useMap } from "@/diorama/store";
import { labelElements } from "../labelRegistry";
import { MAX_ZOOM } from "./CameraRig";
import { ABOVE_FOG } from "./FogCover";

// A landmark's art is drawn SPRITE_PX tall at REF_ZOOM and grows gently as you zoom in.
const SPRITE_PX = 46;
const REF_ZOOM = 20;
const GROWTH = 0.25;
/** How much of a sprite's size two neighbours must be apart before both are drawn. */
const SEPARATION = 0.6;
/** Past this zoom everything is drawn, overlap or not. */
const SHOW_ALL_ZOOM = MAX_ZOOM * 0.6;
/** How far (px) a name tag hangs below its landmark's base. */
const LABEL_DROP = 7;
const PIN_PX = 6.5;
/** Pointer travel (px) beyond which a press counts as a drag, not a click. */
const CLICK_SLOP = 8;

const spritePx = (zoom: number) => SPRITE_PX * Math.pow(zoom / REF_ZOOM, GROWTH);

/**
 * Decluttering. Walking the catalogue in priority order, each landmark gets the
 * lowest zoom at which its art no longer collides with any more important one.
 * Below that zoom it is drawn as a small pin instead.
 */
function revealZooms(landmarks: Landmark[]): Map<string, number> {
  const ordered = [...landmarks].sort((a, b) => Number(!!b.isAnchor) - Number(!!a.isAnchor));
  const reveal = new Map<string, number>();
  ordered.forEach((l, i) => {
    let zoom = 0;
    for (let j = 0; j < i; j++) {
      const dist = Math.max(0.01, Math.hypot(l.x - ordered[j].x, l.z - ordered[j].z));
      const need = Math.pow((SEPARATION * SPRITE_PX) / (Math.pow(REF_ZOOM, GROWTH) * dist), 1 / (1 - GROWTH));
      zoom = Math.max(zoom, need);
    }
    reveal.set(l.id, zoom);
  });
  return reveal;
}

type Item = {
  landmark: Landmark;
  y: number;
  /** Art size as a fraction of its longest side. */
  w: number;
  h: number;
  material: THREE.SpriteMaterial;
  /** Animated 0..1 state: art shown, passes the category filter, hover/selection emphasis. */
  grow: number;
  present: number;
  boost: number;
};

function blobShadowTexture(): THREE.Texture {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext("2d")!;
  const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, "rgba(44, 47, 96, 0.5)");
  gradient.addColorStop(0.6, "rgba(44, 47, 96, 0.22)");
  gradient.addColorStop(1, "rgba(44, 47, 96, 0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(canvas);
}

export function Landmarks({
  world,
  visible,
  atlasUrl = ATLAS.url,
}: {
  world: World;
  /** Ids of the landmarks that exist as far as the viewer knows. Omit for all of them. */
  visible?: ReadonlySet<string>;
  atlasUrl?: string;
}) {
  const atlas = useLoader(THREE.TextureLoader, atlasUrl);
  const filter = useMap((s) => s.filter);
  const hoveredId = useMap((s) => s.hoveredId);

  const items = useMemo<Item[]>(() => {
    atlas.colorSpace = THREE.SRGBColorSpace;
    atlas.anisotropy = 4;
    return LANDMARKS.map((landmark) => {
      const [sx, sy, sw, sh] = landmark.sprite;
      // Every sprite shares the atlas image; only the UV window differs.
      const map = atlas.clone();
      map.repeat.set(sw / ATLAS.width, sh / ATLAS.height);
      map.offset.set(sx / ATLAS.width, 1 - (sy + sh) / ATLAS.height);
      const longest = Math.max(sw, sh);
      return {
        landmark,
        y: world.groundAt(landmark.x, landmark.z),
        w: sw / longest,
        h: sh / longest,
        material: new THREE.SpriteMaterial({ map, transparent: true, depthWrite: false }),
        grow: 0,
        present: 1,
        boost: 1,
      };
    });
  }, [atlas, world]);

  const reveal = useMemo(
    () => revealZooms(LANDMARKS.filter((l) => (!filter || l.category === filter) && (!visible || visible.has(l.id)))),
    [filter, visible],
  );

  const shared = useMemo(
    () => ({
      shadow: new THREE.MeshBasicMaterial({ map: blobShadowTexture(), transparent: true, depthWrite: false }),
      // Landmarks the viewer knows about stay readable wherever they stand, fog or not.
      stem: new THREE.MeshLambertMaterial({ color: "#FFFFFF", userData: ABOVE_FOG }),
      heads: Object.fromEntries(
        Object.entries(CATEGORIES).map(([key, meta]) => [
          key,
          new THREE.MeshLambertMaterial({ color: meta.color, userData: ABOVE_FOG }),
        ]),
      ),
      ring: new THREE.MeshBasicMaterial({ color: PALETTE.ink, transparent: true, depthTest: false }),
    }),
    [],
  );

  const sprites = useRef<(THREE.Sprite | null)[]>([]);
  const shadows = useRef<(THREE.Mesh | null)[]>([]);
  const pins = useRef<(THREE.Group | null)[]>([]);
  const ring = useRef<THREE.Mesh>(null);
  const projected = useMemo(() => new THREE.Vector3(), []);

  useEffect(() => {
    document.body.style.cursor = hoveredId ? "pointer" : "";
    return () => {
      document.body.style.cursor = "";
    };
  }, [hoveredId]);

  useFrame(({ camera, size, clock }, dt) => {
    const { selectedId, hoveredId, filter } = useMap.getState();
    const zoom = camera.zoom;
    const artSize = spritePx(zoom) / zoom;
    const pinSize = PIN_PX / zoom;
    const k = 1 - Math.exp(-dt * 11);

    items.forEach((item, i) => {
      const { landmark } = item;
      const selected = landmark.id === selectedId;
      const hovered = landmark.id === hoveredId;
      const present = (!filter || landmark.category === filter) && (!visible || visible.has(landmark.id));
      const showArt = present && (selected || zoom >= (reveal.get(landmark.id) ?? Infinity) || zoom >= SHOW_ALL_ZOOM);

      item.grow += ((showArt ? 1 : 0) - item.grow) * k;
      item.present += ((present ? 1 : 0) - item.present) * k;
      item.boost += ((selected ? 1.3 : hovered ? 1.14 : 1) - item.boost) * k;

      // Hidden things shrink to (almost) nothing, which also takes them out of ray picking.
      const art = Math.max(1e-4, artSize * (landmark.isAnchor ? 1.22 : 1) * item.boost * item.grow);
      const sprite = sprites.current[i];
      if (sprite) {
        sprite.visible = item.grow > 0.02;
        sprite.scale.set(art * item.w, art * item.h, 1);
      }
      const shadow = shadows.current[i];
      if (shadow) {
        shadow.visible = item.grow > 0.02;
        shadow.scale.setScalar(art * item.w * 1.05);
      }
      const pin = pins.current[i];
      if (pin) {
        const pinScale = pinSize * (1 - item.grow) * item.present * (hovered ? 1.35 : 1);
        pin.visible = pinScale > pinSize * 0.05;
        pin.scale.setScalar(Math.max(1e-4, pinScale));
      }

      // Name tags stay out of the way: only the landmark under the pointer (or the open one) gets one.
      const label = labelElements.get(landmark.id);
      if (label) {
        const labelled = present && (hovered || selected);
        if (labelled) {
          projected.set(landmark.x, item.y, landmark.z).project(camera);
          const px = (projected.x * 0.5 + 0.5) * size.width;
          const py = (-projected.y * 0.5 + 0.5) * size.height;
          label.style.transform = `translate3d(${px.toFixed(1)}px, ${py.toFixed(1)}px, 0) translate(-50%, ${LABEL_DROP}px)`;
        }
        label.style.opacity = labelled ? "1" : "0";
      }
    });

    const selectedItem = selectedId ? items.find((item) => item.landmark.id === selectedId) : null;
    if (ring.current) {
      ring.current.visible = !!selectedItem;
      if (selectedItem) {
        const pulse = (clock.elapsedTime * 0.9) % 1;
        ring.current.position.set(selectedItem.landmark.x, selectedItem.y + 0.03, selectedItem.landmark.z);
        ring.current.scale.setScalar(artSize * (0.35 + pulse * 0.5));
        shared.ring.opacity = 0.55 * (1 - pulse);
      }
    }
  });

  const handlers = (id: string) => ({
    onClick: (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      if (e.delta < CLICK_SLOP) useMap.getState().select(id);
    },
    onPointerOver: (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      useMap.getState().hover(id);
    },
    onPointerOut: () => {
      if (useMap.getState().hoveredId === id) useMap.getState().hover(null);
    },
  });

  return (
    <>
      {items.map((item, i) => {
        const { landmark } = item;
        return (
          <group key={landmark.id} position={[landmark.x, item.y, landmark.z]}>
            <mesh
              ref={(m) => {
                shadows.current[i] = m;
              }}
              position-y={0.025}
              rotation-x={-Math.PI / 2}
              material={shared.shadow}
              renderOrder={1}
              raycast={() => null}
            >
              <circleGeometry args={[0.5, 24]} />
            </mesh>
            <sprite
              ref={(s) => {
                sprites.current[i] = s;
              }}
              material={item.material}
              center={[0.5, 0]}
              renderOrder={2}
              {...handlers(landmark.id)}
            />
            <group
              ref={(g) => {
                pins.current[i] = g;
              }}
              {...handlers(landmark.id)}
            >
              <mesh position-y={1.1} material={shared.stem}>
                <cylinderGeometry args={[0.16, 0.16, 2.2, 6]} />
              </mesh>
              <mesh position-y={2.6} material={shared.heads[landmark.category]} castShadow>
                <sphereGeometry args={[1, 14, 10]} />
              </mesh>
            </group>
          </group>
        );
      })}
      <mesh ref={ring} rotation-x={-Math.PI / 2} material={shared.ring} renderOrder={1} raycast={() => null}>
        <ringGeometry args={[0.82, 1, 48]} />
      </mesh>
    </>
  );
}
