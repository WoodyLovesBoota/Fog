/**
 * Low-poly isometric palette — THE single source of truth for every color the
 * game-style map uses. assets/mapstyle/lowpoly.json embeds these hex values
 * directly (a style JSON can't import TS), so any palette change must be
 * mirrored there; nowhere else may hardcode these hexes.
 */
export const PALETTE = {
  land: '#EFE7D3',        // 육지 배경
  water: '#7EC8E3',       // 바다·강 공통
  waterDeep: '#6BBBDA',   // (선택) 저줌 바다
  grass: '#A8D5A2',       // 공원·녹지
  grassDark: '#8FC489',   // 숲·자연보호구역
  roadMinor: '#DBD6CA',   // 일반 도로
  roadMajor: '#E8E3D6',   // 간선도로 (더 밝게)
  roadCasing: '#C7C2B4',  // 도로 외곽선
  building: '#F6F1E5',    // fill-extrusion 기본색 (면 명암은 엔진이 자동 처리)
  fogFill: '#F2EBDD',     // 안개 채움
  fogLine: '#D8CDB4',     // 안개 헥사곤 경계선
} as const;
