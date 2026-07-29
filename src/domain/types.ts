/**
 * F2. 하루 식단 기록 — 도메인 타입
 *
 * 기능명세서.md 203~226줄 참조.
 */

/** 끼니 구분 */
export type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack'

export const MEAL_SLOTS: readonly MealSlot[] = ['breakfast', 'lunch', 'dinner', 'snack']

export const MEAL_SLOT_LABEL: Record<MealSlot, string> = {
  breakfast: '아침',
  lunch: '점심',
  dinner: '저녁',
  snack: '간식',
}

/** 칼로리와 탄단지. 단위 — kcal, g */
export type Nutrition = {
  kcal: number
  carb: number
  protein: number
  fat: number
}

/**
 * 음식이 추천 후보가 될 자격 (F5).
 *
 * 분류 기준은 **단독으로 한 끼가 성립하는가** 한 가지다. `staple`(쌀밥)과
 * `side`(미역국)를 끼니 추천에서 빼는 것은 나쁜 음식이라서가 아니라 그것만으로
 * 끼니가 되지 않기 때문이다. 반찬·주식을 조합해 한 끼를 구성하는 일은 아직
 * 범위 밖이다.
 *
 * 이 값은 **추천 후보 자격에만 쓴다.** F2 기록은 role과 무관하게 모든 음식에
 * 대해 가능하다 — 소주를 마셨으면 기록할 수 있어야 한다.
 */
export type FoodRole =
  /** 단독으로 한 끼가 되는 완성 요리 */
  | 'meal'
  /** 간식·유제품·과일·견과 */
  | 'snack'
  /** 주식(밥·면·빵). 반찬 없이는 끼니가 되지 않는다 */
  | 'staple'
  /** 반찬·국 */
  | 'side'
  /** 조리 전 재료 */
  | 'ingredient'
  | 'drink'
  | 'alcohol'

/**
 * 음식 마스터. 영양값은 항상 100g 기준으로 보관한다.
 *
 * `servingGram`이 있는 음식만 '인분' 단위 입력을 받을 수 있다.
 * 사용자가 직접 입력한 음식(`source: 'custom'`)은 개인 음식 목록에 저장되어 재사용된다.
 */
export type Food = {
  id: string
  name: string
  /** 100g당 영양값 */
  per100g: Nutrition
  /** 1인분이 몇 g인지. 없으면 인분 단위 입력 불가 */
  servingGram?: number
  source: 'db' | 'custom'
  role: FoodRole
}

/** 섭취량. 'serving'은 food.servingGram이 있을 때만 유효하다 */
export type Amount = {
  unit: 'g' | 'serving'
  value: number
}

/**
 * 식단 기록 한 줄.
 *
 * `foodName`과 `nutrition`은 기록 시점의 스냅샷이다. 음식 마스터가 나중에
 * 수정·삭제되어도 과거 기록의 값이 흔들리지 않게 하기 위한 것이다.
 */
export type MealEntry = {
  id: string
  /** 'YYYY-MM-DD' — 로컬 타임존 기준 */
  date: string
  slot: MealSlot
  foodId: string
  /** 기록 시점의 음식 이름 스냅샷 */
  foodName: string
  amount: Amount
  /** 기록 시점에 환산한 영양값 스냅샷 */
  nutrition: Nutrition
  createdAt: string
}

/** 기록을 새로 만들 때 사용자가 채우는 부분 */
export type MealEntryDraft = {
  date: string
  slot: MealSlot
  foodId: string
  amount: Amount
}

/**
 * 오늘 목표 칼로리와 탄단지 목표.
 *
 * `오늘 목표 = 기본 목표 칼로리(F1) + 운동 소모 칼로리(F3)`
 * F2는 이 값을 계산하지 않고 주입받는다. F1 미완료 상태에서는 `null`이며,
 * 이때 잔여 칼로리를 표시하지 않는다 (명세 226줄).
 */
export type DailyTarget = Nutrition

/** 끼니별 기록 목록과 그 소계 */
export type SlotSummary = {
  slot: MealSlot
  entries: MealEntry[]
  subtotal: Nutrition
}

/** 하루치 집계 결과 */
export type DaySummary = {
  date: string
  bySlot: SlotSummary[]
  total: Nutrition
}

// ---------------------------------------------------------------------------
// F5. 다음 식사 추천 (기능명세서.md 318~349줄)
// ---------------------------------------------------------------------------

/**
 * 추천에 필요한 입력 일체.
 *
 * F5는 F1·F3의 구현을 기다리지 않고 값을 **주입받는다.** `DailyTarget`이 F2에서
 * 쓰는 방식과 같다.
 *
 * `baseTarget`의 단백질 하한 상향(체중 × 1.2g → × 1.6g, 명세 270~273줄)은
 * **F1이 계산해 넘긴다.** F5는 사용자 체중을 모르므로 여기서 계산할 수 없다.
 * 그런데도 `hasStrengthWorkout`을 따로 받는 것은 하한 계산이 아니라 정렬
 * 가중치 때문이다 (명세 338줄).
 */
export type RecommendInput = {
  /**
   * F1 기본 목표 — 칼로리와 목표 탄단지. `null`이면 F1 미완료.
   * `readDailyTarget()`(`src/features/target/dailyTarget.ts`)이 주는 값을 그대로 넘긴다.
   */
  baseTarget: DailyTarget | null
  /** F3 오늘 운동 소모 합계 */
  exerciseKcal: number
  /** F3 근력 유형 운동 기록 여부 */
  hasStrengthWorkout: boolean
  /** F2 오늘 누적 섭취. `summarizeDay().total`을 그대로 넘긴다 */
  consumed: Nutrition
  /** 추천받을 끼니 */
  slot: MealSlot
  /** 이미 기록이 있는 끼니 */
  loggedSlots: readonly MealSlot[]
}

/**
 * 추천 결과의 상태. 명세 346~349줄의 분기에 대응한다.
 *
 * - `profile-required` — F1 미완료. 추천할 기준선이 없다
 * - `over-target`      — 잔여 칼로리 ≤ 0. 저칼로리 음식만 제안한다
 * - `snack-only`       — 잔여 칼로리가 200kcal 미만. 정식 끼니 대신 간식
 * - `ok`               — 정상 추천
 */
export type RecommendStatus = 'profile-required' | 'over-target' | 'snack-only' | 'ok'

/** 추천 결과 한 건 */
export type MealSuggestion = {
  food: Food
  /** 인분 배수. 1이 아니면 화면에 반드시 드러내야 한다 */
  servings: number
  /** 배수를 적용한 실제 영양값 */
  nutrition: Nutrition
  /** 0~1. 부족한 영양소를 얼마나 채워주는지 */
  score: number
  /** 이 음식을 고른 이유 (명세 343~344줄) */
  reasons: string[]
}

/** 추천 화면이 받는 전체 결과 */
export type Recommendation = {
  status: RecommendStatus
  /** 기본 목표 + 운동 소모. F1 미완료면 `null` */
  todayTargetKcal: number | null
  /** 오늘 목표 − 누적 섭취. 초과분은 음수로 그대로 둔다. F1 미완료면 `null` */
  remainingKcal: number | null
  /** 요청 끼니를 포함해 오늘 남은 끼니 수 */
  remainingSlotCount: number
  /** 이번 끼니에 배분된 칼로리. 배분이 무의미한 상태면 `null` */
  slotKcal: number | null
  suggestions: MealSuggestion[]
  /** 상태를 알리는 안내 문구. 정상 추천이면 `null` */
  notice: string | null
}
