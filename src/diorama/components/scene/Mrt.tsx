import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Line } from "@react-three/drei/core/Line";
import * as THREE from "three";
import { MRT_LINE_BY_ID, MRT_LINES, MRT_STATIONS } from "@/diorama/data/mrt";
import { PLAIN_HEIGHT } from "@/diorama/lib/world/fields";
import { useMap } from "@/diorama/store";

/** Lines and stations float just above the plain and ignore depth, like a transit overlay. */
const LEVEL = PLAIN_HEIGHT + 0.06;
const LINE_WIDTH_PX = 2.4;
// Station dot radius on screen: DOT_PX at REF_ZOOM, growing gently with zoom.
const DOT_PX = 5;
const REF_ZOOM = 20;
const GROWTH = 0.35;
/** Share of a dot's radius taken by its coloured rim. */
const RIM = 0.3;
/** The pointer picks the nearest station within this many pixels. */
const HOVER_RADIUS_PX = 20;
const PULSE_SECONDS = 1.6;

/** The MRT network: thin coloured lines, with a white, colour-rimmed dot at every station. */
export function Mrt() {
  const active = useMap((s) => s.filter === "mrt");
  const hoveredStation = useMap((s) => s.hoveredStation);
  const group = useRef<THREE.Group>(null);
  const rims = useRef<THREE.InstancedMesh>(null);
  const centres = useRef<THREE.InstancedMesh>(null);
  const pulse = useRef<THREE.Mesh>(null);
  /** 0 hidden .. 1 fully shown, eased. */
  const shown = useRef(0);

  // Hover only counts while the pointer is really over the map (not parked on the UI, or never moved).
  const gl = useThree((s) => s.gl);
  const pointerInside = useRef(false);
  useEffect(() => {
    const el = gl.domElement;
    const enter = () => {
      pointerInside.current = true;
    };
    const leave = () => {
      pointerInside.current = false;
    };
    el.addEventListener("pointermove", enter);
    el.addEventListener("pointerdown", enter);
    el.addEventListener("pointerleave", leave);
    return () => {
      el.removeEventListener("pointermove", enter);
      el.removeEventListener("pointerdown", enter);
      el.removeEventListener("pointerleave", leave);
    };
  }, [gl]);

  const assets = useMemo(() => {
    const overlay = { transparent: true, depthTest: false, depthWrite: false } as const;
    return {
      // Unit discs lying flat on y = 0; instances scale them.
      disc: new THREE.CircleGeometry(1, 28).rotateX(-Math.PI / 2),
      ring: new THREE.RingGeometry(0.86, 1, 40).rotateX(-Math.PI / 2),
      rimMaterial: new THREE.MeshBasicMaterial({ ...overlay }),
      centreMaterial: new THREE.MeshBasicMaterial({ ...overlay, color: "#FFFFFF" }),
      pulseMaterial: new THREE.MeshBasicMaterial({ ...overlay, color: "#FFFFFF" }),
      // An interchange is rimmed in its first line's colour.
      colors: MRT_STATIONS.map((st) => new THREE.Color(MRT_LINE_BY_ID.get(st.lines[0])?.color ?? "#FFFFFF")),
    };
  }, []);

  useEffect(() => {
    MRT_STATIONS.forEach((_, i) => rims.current!.setColorAt(i, assets.colors[i]));
    rims.current!.instanceColor!.needsUpdate = true;
  }, [assets]);

  useEffect(() => {
    if (!active) useMap.getState().hoverStation(null);
  }, [active]);

  useEffect(() => {
    if (!hoveredStation) return;
    document.body.style.cursor = "pointer";
    return () => {
      document.body.style.cursor = "";
    };
  }, [hoveredStation]);

  const { dummy, projected } = useMemo(() => ({ dummy: new THREE.Object3D(), projected: new THREE.Vector3() }), []);

  useFrame(({ camera, clock, pointer, size }, dt) => {
    shown.current += ((active ? 1 : 0) - shown.current) * (1 - Math.exp(-dt * 8));
    const visible = shown.current > 0.01;
    group.current!.visible = visible;
    if (!visible) return;

    const unit = ((DOT_PX * Math.pow(camera.zoom / REF_ZOOM, GROWTH)) / camera.zoom) * shown.current;
    const hovered = useMap.getState().hoveredStation;
    // Picking by screen distance rather than ray-casting: the dots are small, and this
    // gives every station a comfortable target however far out the camera is.
    let nearest: string | null = null;
    let nearestPx = HOVER_RADIUS_PX;
    let hoveredIndex = -1;

    MRT_STATIONS.forEach((station, i) => {
      const isHovered = station.name === hovered;
      if (isHovered) hoveredIndex = i;
      const size_ = unit * (station.lines.length > 1 ? 1.3 : 1) * (isHovered ? 1.45 : 1);
      dummy.position.set(station.x, 0, station.z);
      dummy.scale.setScalar(size_);
      dummy.updateMatrix();
      rims.current!.setMatrixAt(i, dummy.matrix);
      dummy.scale.setScalar(size_ * (1 - RIM));
      dummy.updateMatrix();
      centres.current!.setMatrixAt(i, dummy.matrix);

      if (active && pointerInside.current) {
        projected.set(station.x, LEVEL, station.z).project(camera);
        const px = Math.hypot(((projected.x - pointer.x) * size.width) / 2, ((projected.y - pointer.y) * size.height) / 2);
        if (px < nearestPx) {
          nearestPx = px;
          nearest = station.name;
        }
      }
    });
    rims.current!.instanceMatrix.needsUpdate = true;
    centres.current!.instanceMatrix.needsUpdate = true;
    if (active && nearest !== hovered) useMap.getState().hoverStation(nearest);

    // A soft ripple around whichever station the pointer is on.
    pulse.current!.visible = hoveredIndex >= 0;
    if (hoveredIndex >= 0) {
      const t = (clock.elapsedTime / PULSE_SECONDS) % 1;
      const station = MRT_STATIONS[hoveredIndex];
      pulse.current!.position.set(station.x, 0, station.z);
      pulse.current!.scale.setScalar(unit * (1.6 + t * 2.2));
      assets.pulseMaterial.color.copy(assets.colors[hoveredIndex]);
      assets.pulseMaterial.opacity = 0.7 * (1 - t);
    }
  });

  const count = MRT_STATIONS.length;
  return (
    <group ref={group} position-y={LEVEL} visible={false}>
      {MRT_LINES.flatMap((line) =>
        line.paths.map((path, i) => (
          <Line
            key={`${line.id}-${i}`}
            points={path.map(([x, z]) => [x, 0, z] as [number, number, number])}
            color={line.color}
            lineWidth={LINE_WIDTH_PX}
            transparent
            depthTest={false}
            renderOrder={5}
            raycast={() => null}
          />
        )),
      )}
      <mesh ref={pulse} geometry={assets.ring} material={assets.pulseMaterial} renderOrder={6} raycast={() => null} />
      <instancedMesh ref={rims} args={[assets.disc, assets.rimMaterial, count]} renderOrder={7} frustumCulled={false} raycast={() => null} />
      <instancedMesh ref={centres} args={[assets.disc, assets.centreMaterial, count]} renderOrder={8} frustumCulled={false} raycast={() => null} />
    </group>
  );
}
