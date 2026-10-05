/**
 * Name labels are plain DOM (crisper text than anything drawn in WebGL), but they
 * have to follow 3D positions every frame. The label layer registers its elements
 * here and the scene moves them directly, bypassing React.
 */
export const labelElements = new Map<string, HTMLElement>();
