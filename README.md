# 식단앱

신체 정보로 하루 목표 칼로리를 계산하고, 식사·운동 기록과 냉장고 재료를 바탕으로 **다음에 무엇을 먹을지** 알려주는 식단 관리 웹 앱.

기록에서 끝나는 식단 앱과 달리, 목표 칼로리라는 기준선을 먼저 세우고 모든 추천을 그 기준선과의 차이(잔여 칼로리)로 계산한다. 기준선은 고정값이 아니라 그날의 운동량에 따라 움직인다.

전체 기능 명세는 [`기능명세서.md`](./기능명세서.md)에 있다.

## 실행

```bash
npm install
npm run dev     # http://localhost:3000
```

| 명령 | 설명 |
|---|---|
| `npm run dev` | 개발 서버 |
| `npm run build` | 프로덕션 빌드 |
| `npm test` | 계산 로직 단위 테스트 |
| `npm run lint` | ESLint |

## 기능 및 구현 현황

| ID | 기능 | 내용 | 상태 |
|---|---|---|---|
| F1 | 사용자 프로필 및 목표 설정 | BMR → TDEE → 기본 목표 칼로리, 탄단지 배분 | ✅ `/profile` |
| F2 | 하루 식단 기록 | 끼니별 기록, 누적 섭취량 집계 | — |
| F3 | 운동 기록 및 소모 칼로리 반영 | MET 기반 소모 칼로리, 오늘 목표 상향 | — |
| F4 | 냉장고 재료 관리 | 재료 목록, 유통기한 임박 표시, (선택) 사진 인식 | — |
| F5 | 다음 식사 추천 | 잔여 칼로리를 남은 끼니로 배분해 음식 제안 | — |
| F6 | 재료 기반 레시피 추천 | 보유 재료 매칭률 + 유통기한 임박 가산점 | — |
| F7 | 일일 대시보드 | 목표 대비 진행률, 초과·부족 안내 | — |

## 데이터 출처 (F2·F5·F6에서 사용 예정)

- 식품의약품안전처 **조리식품의 레시피 DB** (`COOKRCP01`) — 레시피, 조리법, 열량·영양성분
- 식품의약품안전처 **식품영양성분DB정보** (공공데이터포털 `15127578`) — 음식별 열량·탄단지

F1은 외부 데이터를 쓰지 않는다. 위 두 데이터셋은 식단 기록과 추천 기능에서 필요해진다.

## 구조

```
app/
  page.tsx              홈 (F7 대시보드 자리)
  profile/page.tsx      F1 화면
components/profile/     F1 UI
lib/nutrition/          ★ 계산 코어 — 순수 함수, 프레임워크 비의존
  calculate.ts            BMR / TDEE / 기본 목표 칼로리 / 탄단지
  calculate.test.ts       명세서 계산 예시 ㉮·㉯ 재현
lib/profile/
  schema.ts             입력 검증 (zod)
  storage.ts            ★ 저장소 어댑터 — localStorage가 여기 밖으로 나가지 않는다
  useProfile.ts         useSyncExternalStore 기반 읽기 훅
docs/PLAN.md            초기 구현 계획서
```

### 다른 기능에서 F1 값을 쓰는 법

목표 칼로리 계산을 각자 다시 구현하지 말 것. `calcAllTargets()` 하나만 쓰면 된다.

```ts
import { calcAllTargets } from '@/lib/nutrition/calculate'
import { useProfile } from '@/lib/profile/useProfile'

const profile = useProfile()
const targets = profile ? calcAllTargets(profile) : null

targets?.baseTargetCalories   // 기본 목표 칼로리 (운동 제외)
targets?.macros               // 탄·단·지 목표 그램
targets?.bmr                  // F7의 섭취 부족 안내에 필요
```

F3(운동 기록)에서 근력운동을 기록한 날은 단백질 하한이 올라간다. 계산 함수가 이미 받도록 열려 있다.

```ts
calcAllTargets(profile, { hasStrengthTraining: true })  // 하한 1.2g/kg → 1.6g/kg
```

## 주의

- **목표 칼로리는 어떤 경우에도 보정하지 않는다.** 기초대사량보다 낮게 나와도, 0 이하가 나와도 계산값 그대로 보여주고 안내만 한다 (명세서 §F1 ③).
- **활동계수에 운동을 넣지 않는다.** 운동은 F3에서 그날그날 더한다. 활동계수에도 반영하면 이중 계산된다 (명세서 §2).
- 계산은 단계별로 반올림한다. 최종값만 반올림하면 명세서 예시가 재현되지 않는다 (`lib/nutrition/calculate.ts` 상단 주석 참고).

## 스택

Next.js 16 (App Router) · TypeScript · Tailwind CSS v4 · Zod · Vitest

프로필은 현재 브라우저 localStorage에 저장된다. F2 이후 서버 DB가 필요해지면 `lib/profile/storage.ts`만 교체하면 된다.
