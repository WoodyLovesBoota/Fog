import { toWorld } from "@/diorama/lib/geo";
import raw from "./landmarks.json";

export type Category = keyof typeof raw.categories;

export type CategoryMeta = { color: string; emoji: string; label: string; tintA: string; tintB: string };

export type Landmark = {
  id: string;
  name: string;
  category: Category;
  /** The ten most iconic sights; they win every fight for space on the map. */
  isAnchor?: boolean;
  lat: number;
  lng: number;
  emoji?: string;
  description?: string;
  area?: string;
  hours?: string;
  tip?: string;
  /** Rect of this landmark's art inside the atlas, in pixels: x, y, w, h. */
  sprite: [number, number, number, number];
  /** World position on the ground plane. */
  x: number;
  z: number;
};

export const ATLAS = { url: "/landmarks/atlas.webp", ...raw.atlas };

export const CATEGORIES = raw.categories as Record<Category, CategoryMeta>;

export const CATEGORY_ORDER = Object.keys(raw.categories) as Category[];

export const LANDMARKS: Landmark[] = raw.landmarks.map((l) => {
  const [x, z] = toWorld(l.lng, l.lat);
  return { ...l, x, z } as Landmark;
});

export const LANDMARK_BY_ID = new Map(LANDMARKS.map((l) => [l.id, l]));

export const landmarkImage = (id: string) => `/landmarks/${id}.webp`;

/** The `count` landmarks closest to `of`, nearest first. */
export function nearestLandmarks(of: Landmark, count: number): Landmark[] {
  return LANDMARKS.filter((l) => l.id !== of.id)
    .sort((a, b) => Math.hypot(a.x - of.x, a.z - of.z) - Math.hypot(b.x - of.x, b.z - of.z))
    .slice(0, count);
}
