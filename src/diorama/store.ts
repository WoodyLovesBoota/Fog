import { create } from "zustand";
import type { Category } from "@/diorama/data/landmarks";

/** What the header tabs select: everything, one landmark category, or the MRT network. */
export type Filter = Category | "mrt" | null;

export type CameraCommand =
  | { kind: "zoom"; factor: number }
  | { kind: "reset" }
  /** Centre on a world point; `jump` skips the glide. Off the board it falls back to the home view. */
  | { kind: "fly"; x: number; z: number; zoom?: number; jump?: boolean };

type MapState = {
  /** True once the world is generated and the first frame is on screen. */
  ready: boolean;
  selectedId: string | null;
  hoveredId: string | null;
  /** Name of the planning area under the pointer. */
  hoveredArea: string | null;
  /** Name of the MRT station under the pointer. */
  hoveredStation: string | null;
  filter: Filter;
  /** One-shot instruction for the camera rig; `nonce` makes repeats distinct. */
  command: (CameraCommand & { nonce: number }) | null;
  setReady(): void;
  select(id: string | null): void;
  hover(id: string | null): void;
  hoverArea(name: string | null): void;
  setFilter(filter: Filter): void;
  hoverStation(name: string | null): void;
  send(command: CameraCommand): void;
};

export const useMap = create<MapState>((set) => ({
  ready: false,
  selectedId: null,
  hoveredId: null,
  hoveredArea: null,
  hoveredStation: null,
  filter: null,
  command: null,
  setReady: () => set({ ready: true }),
  select: (selectedId) => set({ selectedId }),
  hover: (hoveredId) => set({ hoveredId }),
  hoverArea: (hoveredArea) => set({ hoveredArea }),
  // Landmarks are hidden on the MRT tab, so an open landmark panel would point at nothing.
  setFilter: (filter) => set((s) => ({ filter, selectedId: filter === "mrt" ? null : s.selectedId })),
  hoverStation: (hoveredStation) => set({ hoveredStation }),
  send: (command) => set((s) => ({ command: { ...command, nonce: (s.command?.nonce ?? 0) + 1 } })),
}));
