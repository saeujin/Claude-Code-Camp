// 식단앱 공통 타입. 앱 전체가 이 타입만 쓴다.
// 계약 문서: .claude/skills/diet-domain/references/types.md

export type Sex = 'male' | 'female'
export type ActivityLevel = 1.2 | 1.375 | 1.55 | 1.725
export type DietGoal = 'lose' | 'maintain' | 'gain'
export type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack'
export type ExerciseKind = 'cardio' | 'strength'

/** 'met' = 종목·시간으로 자동 계산(경로 ①), 'manual' = 소모 칼로리 직접 입력(경로 ②) */
export type ExerciseSource = 'met' | 'manual'

/** 로컬 타임존 기준 'YYYY-MM-DD' */
export type DateKey = string

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
  /** 유지 목표면 null */
  targetDate: DateKey | null
  /** 목표를 세운 날 — 진행률의 기준 */
  startedOn: DateKey
  /** 목표를 세울 당시 체중. 체중을 갱신해도 바뀌지 않는다 */
  startWeightKg: number
}

/** F1 계산 결과. 저장하지 않고 Profile에서 매번 파생한다 */
export interface GoalPlan {
  /** 표시용 반올림값 */
  bmr: number
  /** 반올림 전 실수. TDEE 계산에 쓴다 */
  bmrRaw: number
  tdee: number
  /** 항상 0 이상. 방향은 goal이 정한다 */
  dailyAdjustment: number
  baseTarget: number
  /** kg/주, 소수 2자리 */
  weeklyRateKg: number
  targetDate: DateKey | null
  /** 오늘부터 목표일까지 남은 일수. 유지 목표면 0 */
  daysRemaining: number
  /** 목표 기간이 지났는가 */
  expired: boolean
  macros: Macros
  /** 기본 목표가 BMR보다 낮은가. 값은 조정하지 않고 안내만 한다 */
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
  /** 환산이 끝난 실제 섭취 영양소. 값으로 굳혀 저장한다 */
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
  met: number | null
  minutes: number | null
  kcal: number
  kind: ExerciseKind
  /** 기록 시점 체중. 과거 기록을 소급 재계산하지 않기 위한 스냅샷 */
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
  /** 1인분 기본 중량 (g) */
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
  kcal: number
  ingredients: RecipeIngredient[]
  steps: string[]
}

// ── 하루 집계 (F5·F7의 입력) ──────────────────────────────

export interface DaySummary {
  date: DateKey
  baseTarget: number
  exerciseBurn: number
  todayTarget: number
  consumed: Nutrition
  remaining: number
  /** 근력 운동이 있으면 상향된 단백질 목표가 들어간다 */
  targetMacros: Macros
  hasStrength: boolean
}

/** 레시피 매칭 결과 (F6) */
export interface RecipeMatch {
  recipe: Recipe
  /** 0~100 정수 */
  matchRate: number
  owned: string[]
  missing: string[]
  /** 유통기한 임박 재료를 써서 가산점을 받았는가 */
  usesExpiring: boolean
  expiringNames: string[]
}
