# Fog

> 걸어 다닌 만큼 안개가 걷히고 지도가 채워지는, 싱가포르 fog-of-war 탐험 앱

![Expo](https://img.shields.io/badge/Expo-SDK_56-000020?logo=expo)
![React Native](https://img.shields.io/badge/React_Native-0.85-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-6-3178C6?logo=typescript&logoColor=white)
![MapLibre](https://img.shields.io/badge/MapLibre-Native-396CB2)
![Vitest](https://img.shields.io/badge/Tested_with-Vitest-6E9F18?logo=vitest&logoColor=white)

<!-- 스크린샷 / 데모 GIF 추가 예정 -->

## 소개

게임의 fog-of-war를 현실 세계로 가져온 위치 기반 탐험 앱입니다. 앱을 켜고
싱가포르를 걸어 다니면 실제로 지나간 지역의 안개가 걷히면서, "내가 진짜
가본 곳"만 색칠된 나만의 지도가 완성됩니다.

- 도시 전체는 **H3 헥사곤 셀(해상도 10, 약 125m)** 42,530개로 분할됩니다
- 셀 위에서 **누적 20초 이상 체류**해야 방문으로 인정 — GPS 지터에 강건한 설계
- 100여 개 싱가포르 랜드마크에 가까이 가면 **컬렉션 카드**가 해금됩니다
- 모든 위치 데이터는 **온디바이스에만 저장** — 외부 전송 없음

## 주요 기능

| 화면 | 설명 |
| --- | --- |
| 스플래시 → 권한 요청 | 애니메이션 마스코트, 위치 권한 플로우 (거부 시 설정 유도 화면) |
| 지도 (메인) | MapLibre 실지도 + 안개 오버레이, 실시간 위치, 진행률 배지, 랜드마크 핀 |
| 통계 | 탐험한 지역 수, 이동 거리, 연속 탐험 일수(streak), 헥사곤 진행률 미터 |
| 컬렉션 | ~100개 랜드마크 도감 — 수집 전에는 "???" 잠금 카드 |

### 핵심 동작
- **백그라운드 위치 추적** — `expo-task-manager` 기반. 포그라운드/백그라운드가
  **동일한 ingest 파이프라인**을 공유해 두 경로의 동작이 어긋날 수 없는 구조
- **체류(dwell) 판정** — 셀별 누적 타이머, 순간적인 GPS 튐 방어, 백그라운드 공백 처리
- **정확도 필터** — 50m보다 부정확한 GPS fix는 폐기
- **오프라인 맵 팩** — 싱가포르 타일을 1회 다운로드해 런타임 타일 호출 제로

## 기술 스택

| 분류 | 사용 기술 |
| --- | --- |
| Framework | Expo SDK 56 (New Architecture), React Native 0.85, React 19 |
| 라우팅 | Expo Router (파일 기반, typed routes) |
| 지도 | @maplibre/maplibre-react-native + Stadia Maps 타일 |
| 지오스페이셜 | h3-js (Uber H3 헥사곤 인덱싱) |
| 위치 | expo-location + expo-task-manager (백그라운드 태스크) |
| 상태 관리 | 의존성 없는 `useSyncExternalStore` 기반 자체 스토어 |
| 저장소 | AsyncStorage (온디바이스 전용, 백엔드 없음) |
| 애니메이션 | Reanimated 4 + worklets, react-native-svg |
| 테스트 | Vitest — 순수 로직 코어(dwell/distance/ingest) 단위 테스트 |

## 아키텍처

**Ports & Adapters(헥사고날)** 레이어링으로, 프레임워크에 독립적인 순수 코어를
중심에 둡니다:

```
src/
├── core/exploration/    # 순수 로직: H3 셀, dwell 판정, 거리 계산 (+ 테스트)
├── core/ports/          # 인터페이스 (VisitedRepository …)
├── adapters/            # 구현체: AsyncStorage 저장소, 백그라운드 위치
├── background/          # 포그라운드/백그라운드 공용 ingest 파이프라인
├── features/poi/        # 랜드마크 데이터·근접 발견 로직
├── config/              # 탐험 튜닝 값, 지도 설정
├── theme/tokens.ts      # 디자인 토큰 단일 소스 (색/폰트/간격/그림자)
└── components/          # UI 컴포넌트
scripts/
├── buildLandCells.ts    # 싱가포르 육지 폴리곤 → H3 셀 42,530개 사전 생성
└── buildCloudTile.py    # 타일링 가능한 안개 구름 텍스처 생성
```

- 코어는 React/Expo를 전혀 모르는 순수 TypeScript — Vitest로 로직만 검증
- 진행률 분모(전체 육지 셀 수)는 빌드 타임에 미리 계산해 런타임 비용 제로

## 시작하기

```bash
npm install --legacy-peer-deps   # SDK 56 네이티브 모듈 호이스팅 이슈 대응

# 환경 변수: .env 에 EXPO_PUBLIC_STADIA_KEY (Stadia Maps API 키) 설정

npx expo run:ios      # 또는 npx expo run:android
```

> MapLibre + 백그라운드 위치 때문에 네이티브 빌드(`ios/`, `android/`)가 필요한
> prebuilt 워크플로 프로젝트입니다. Expo Go로는 실행되지 않습니다.

## 스크립트

| 명령어 | 설명 |
| --- | --- |
| `npm start` | Expo 개발 서버 |
| `npm run ios` / `npm run android` | 네이티브 빌드 & 실행 |
| `npm test` | Vitest 단위 테스트 |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run build:land-cells` | H3 육지 셀 데이터 재생성 |

## 문서

- [PRD.md](PRD.md) — MVP 요구사항 명세 (FR/NFR)
- [userflow.png](userflow.png) — 화면 흐름도 (라우트 구조와 1:1 대응)
