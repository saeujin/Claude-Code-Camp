# 타입 정의

`src/domain/types.ts`에 그대로 둔다. 앱 전체가 이 타입만 쓴다.

```ts
// ── 열거형 ────────────────────────────────────────────────
export type Sex = 'male' | 'female'
export type ActivityLevel = 1.2 | 1.375 | 1.55 | 1.725
export type DietGoal = 'lose' | 'maintain' | 'gain'
export type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack'
export type ExerciseKind = 'cardio' | 'strength'
/** 'met' = 종목·시간으로 자동 계산(경로 ①), 'manual' = 소모 칼로리 직접 입력(경로 ②) */
export type ExerciseSource = 'met' | 'manual'

/** 로컬 타임존 기준 'YYYY-MM-DD' */
export type DateKey = string

// ── 영양 ──────────────────────────────────────────────────
export interface Macros {
  carbG: number
  proteinG: number
  fatG: number
}

export interface Nutrition extends Macros {
  kcal: number
}

// ── 프로필 (F1) ───────────────────────────────────────────
export interface Profile {
  userId: string
  sex: Sex
  age: number
  heightCm: number
  weightKg: number
  activityLevel: ActivityLevel
  goal: DietGoal
  /** 유지 목표면 null */
  targetWeightKg: number | null
  /** 유지 목표면 null. 목표 달성 예정일 */
  targetDate: DateKey | null
  /** 목표를 세운 날 — 남은 기간·달성률 계산의 기준 */
  startedOn: DateKey
  /** 목표를 세울 당시 체중 — 진행률 계산에 쓰며 체중을 갱신해도 바뀌지 않는다 */
  startWeightKg: number
}

/** F1 계산 결과. 프로필이 바뀔 때마다 다시 만든다 */
export interface GoalPlan {
  bmr: number
  tdee: number
  /** 항상 0 이상. 방향은 goal이 정한다 */
  dailyAdjustment: number
  baseTarget: number
  /** kg/주, 소수 2자리 */
  weeklyRateKg: number
  targetDate: DateKey | null
  macros: Macros
  /** 기본 목표가 BMR보다 낮은가 — 값은 조정하지 않고 안내만 한다 */
  belowBmr: boolean
}

// ── 식단 기록 (F2) ────────────────────────────────────────
export interface MealEntry {
  id: string
  userId: string
  date: DateKey
  slot: MealSlot
  foodName: string
  /** 섭취량 (g). 인분으로 입력해도 g으로 환산해 저장한다 */
  amountG: number
  /** 환산이 끝난 실제 섭취 영양소 */
  nutrition: Nutrition
  createdAt: string
}

// ── 운동 기록 (F3) ────────────────────────────────────────
export interface ExerciseEntry {
  id: string
  userId: string
  date: DateKey
  /** 'HH:mm' */
  time: string
  name: string
  source: ExerciseSource
  /** source가 'met'일 때만 채운다 */
  met: number | null
  minutes: number | null
  kcal: number
  kind: ExerciseKind
  /** 기록 시점 체중. 나중에 프로필 체중이 바뀌어도 과거 기록을 소급 재계산하지 않는다 */
  weightSnapshotKg: number
  createdAt: string
}

// ── 냉장고 (F4) ───────────────────────────────────────────
export interface FridgeItem {
  id: string
  userId: string
  name: string
  quantity: number
  unit: string
  purchasedOn: DateKey
  expiresOn: DateKey | null
}

// ── 시드 데이터 ───────────────────────────────────────────
export interface Food {
  id: string
  name: string
  /** 100g 기준 */
  per100g: Nutrition
  /** 1인분 기본 중량 (g) — 입력 편의용 */
  servingG: number
  tags: string[]
}

export interface MetItem {
  id: string
  name: string
  met: number
  kind: ExerciseKind
}

export interface RecipeIngredient {
  name: string
  /** true면 조미료·기본 양념. 매칭률 계산에서 제외한다 */
  pantry: boolean
}

export interface Recipe {
  id: string
  name: string
  /** 1인분 예상 칼로리. 레시피는 탄단지까지 관리하지 않는다 —
   *  F6은 매칭률과 칼로리만 쓰고, 실제 섭취는 F2에 따로 기록한다 */
  kcal: number
  ingredients: RecipeIngredient[]
  steps: string[]
}

// ── 하루 집계 (F7·F5의 입력) ──────────────────────────────
export interface DaySummary {
  date: DateKey
  baseTarget: number
  exerciseBurn: number
  todayTarget: number
  consumed: Nutrition
  remaining: number
  /** 근력 운동이 하나라도 있으면 상향된 목표가 들어간다 */
  targetMacros: Macros
  hasStrength: boolean
}
```

## 사용자 등록 데이터

명세 F2(215행)의 "개인 음식 목록", F6(512행)의 사용자 등록 레시피는 각각 `Food`·`Recipe`와 **같은 형태**로 저장한다. 시드와 사용자 데이터를 합쳐 하나의 목록으로 다루고, 구분이 필요하면 `id` 접두사(`seed:` / `user:`)로 나눈다.
