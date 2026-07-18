/**
 * Low-poly isometric palette — THE single source of truth for every color the
 * game-style map uses. assets/mapstyle/lowpoly.json embeds these hex values
 * directly (a style JSON can't import TS), so any palette change must be
 * mirrored there; nowhere else may hardcode these hexes.
 *
 * Art direction (Phase 1.8 redirect): the board's DEFAULT ground is GRASS, not
 * cream. Land reads as a green patchwork — a base grass, lighter residential
 * patches, and (Phase 1.12) at most ONE darker tone for smooth-edged leisure
 * parks. Forest/wood/nature_reserve no longer paint a darker fill at all: their
 * jagged organic boundaries dominated the frame, so they collapse into grassBase
 * and become "forest" via dense tree sprites in Phase 2 (src/config/buildProps.ts).
 * Net effect: only 1–2 green tones on screen, so greenery is the dominant
 * impression, water the cool accent, and buildings pop as terracotta-roof dots
 * (little villages),
 * NOT as blocks a touch darker than the land. Cream/beige is demoted to
 * "special ground" ONLY: paved plazas, sidewalks, sand, parking — it must never
 * be the screen's base color. Gray still belongs to roads ONLY (now light
 * concrete, not asphalt), so the families read apart by hue at the z15.5 framing.
 *
 * EXTREME DECLUTTER (Phase 1.9/1.10): the board draws exactly TWO VISIBLE line
 * families — roads and the coastline; every other surface is a flat fill.
 * Phase 1.11 layers same-color "rounding" outlines (line-color == the fill's own
 * hex, round cap+join) over the greens + water to fake-bevel their corners —
 * these REUSE the existing fill hexes (grassLight/grassDark/water), add no new
 * colors, and stay invisible except where a polygon abuts a differently-colored
 * neighbor. So the "two line families" rule is about VISIBLE strokes only.
 * Roads collapsed to ONE flat color (roadFill) with no casing, no dashed
 * centerline, no per-grade tint. Several colors below are therefore RETIRED
 * (no live reference in lowpoly.json): grassOutline, sportsField, roadFillMinor,
 * roadCasing, roadCenterline, railway. They are kept as named constants so a
 * later phase can revive them without re-deriving the hexes — see the inline
 * "RETIRED" tags. Only fogFill/fogLine are consumed from TS (app/map.tsx); the
 * rest live solely as mirrored hexes in the style JSON.
 */
export const PALETTE = {
  // --- Land = grass: the board's default surface is a green patchwork ---
  grassBase: '#7FC46B',    // background/land — 육지 기본 배경(잔디)
  grassLight: '#9AD483',   // residential/commercial landuse — 밝은 잔디 패치
  grassDark: '#57A951',    // leisure=park landcover ONLY — 매끈한 인공 공원 (Phase 1.12:
                           // forest/wood/nature_reserve는 grassBase로 흡수, 여기서 제외)
  grassOutline: '#3E8F3A', // [RETIRED 1.9] 녹지 외곽선 — 이제 fill만, 선 제거
  sportsField: '#6FBE5F',  // [RETIRED 1.9] 운동장 조각 — 미세 디테일로 삭제됨

  // --- Water ---
  water: '#4FB2E5',        // 바다·강 공통 — 채도 높은 물
  waterDeep: '#3FA6DC',    // (선택) 저줌 바다 — water보다 살짝 진하게
  waterEdge: '#8ED4F0',    // [RETIRED 1.13] 단색 해안선 — cliffEdge+waterCliffShadow 2중 절벽으로 교체

  // --- Clay texture pass (Phase 1.13): 빛=좌상단 고정, 그림자=우하단 오프셋 ---
  grassShadow: '#5E9B4E',      // 잔디 위에 드리우는 드롭섀도우(도로·공원). 검정 금지 —
                               // grassBase보다 어두운 잔디 톤이라 "얹힌 리본"처럼 읽힘
  cliffEdge: '#F3EAD5',        // 물가 크림 절벽 하이라이트(=pavedArea 헥스, 역할만 다름)
  waterCliffShadow: '#2E86B8', // 물 안쪽으로 깔리는 깊이 그림자 — 땅이 물 위로 떠 보이게

  // --- Paved / special ground (크림·베이지는 오직 여기에만) ---
  pavedArea: '#F3EAD5',    // 보행자광장·보도·광장 등 포장 지면
  sand: '#EFDFB8',         // 해변·모래
  parkingLot: '#DDD8CC',   // 주차장 폴리곤

  // --- Buildings = terracotta rooftops ---
  buildingRoof: '#E0714F',    // 건물 플랫 fill (테라코타 지붕, opacity 1.0)
  buildingRoofAlt: '#E8895F', // 홀짝 미세 변화 — 지붕 점들이 개별 집처럼 읽히게

  // --- Roads (Phase 1.10: ONE flat color, no casing/centerline/tier tint) ---
  roadFill: '#CDD1D6',       // 도로 — 유일한 도로 색. major·local 두 굵기 tier 공용
  roadFillMinor: '#D8DBDF',  // [RETIRED 1.10] 이면도로 별색 — 단일 색으로 통합됨
  roadCasing: '#A9AEB5',     // [RETIRED 1.10] 도로 테두리 — casing 레이어 삭제
  roadCenterline: '#FFFFFF', // [RETIRED 1.10] 중앙선/침목 — 점선·철길 삭제
  roadPedestrian: '#F3EAD5', // 보행자길·골목 — pavedArea와 동일 포장 톤
  railway: '#9A9184',        // [RETIRED 1.9] 철길 레일 — 선 삭제(도로·해안선만 선)

  // --- Fog-of-war overlay (rendered from app/map.tsx, not the style JSON) ---
  fogFill: '#F2EBDD',     // 안개 채움
  fogLine: '#D8CDB4',     // 안개 헥사곤 경계선
} as const;
