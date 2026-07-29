// 계약 문서: .claude/skills/diet-domain/SKILL.md 「상수」
import type { ActivityLevel, DietGoal, MealSlot, Sex } from './types'

/** 체지방 1kg의 에너지. 감량·증량 모두 동일 (미결정 #9 확정) */
export const KCAL_PER_KG_FAT = 7700

export const KCAL_PER_G = { carb: 4, protein: 4, fat: 9 } as const

/** 활동계수는 운동을 제외한 일상 활동만 나타낸다. 운동은 F3에서 별도로 더한다 */
export const ACTIVITY_LEVELS: ReadonlyArray<{
  value: ActivityLevel
  label: string
  hint: string
}> = [
  { value: 1.2, label: '주로 앉아서 생활', hint: '사무직, 재택근무' },
  { value: 1.375, label: '서서 일하거나 자주 걸음', hint: '교사, 판매직' },
  { value: 1.55, label: '하루 대부분 서거나 걷는 직업', hint: '간호사, 요식업' },
  { value: 1.725, label: '육체노동', hint: '건설, 물류, 농업' },
]

export const MACRO_RATIOS: Record<DietGoal, { carb: number; protein: number; fat: number }> = {
  lose: { carb: 0.4, protein: 0.3, fat: 0.3 },
  maintain: { carb: 0.5, protein: 0.2, fat: 0.3 },
  gain: { carb: 0.5, protein: 0.25, fat: 0.25 },
}

/** 단백질 하한 계수 (체중 1kg당 g) */
export const PROTEIN_FLOOR_PER_KG = { normal: 1.2, strength: 1.6 } as const

export const INPUT_RANGE = {
  age: { min: 10, max: 100 },
  heightCm: { min: 100, max: 250 },
  weightKg: { min: 30, max: 300 },
  /** 운동 지속 시간(분) — 벗어나면 막지 않고 재확인한다 */
  exerciseMinutes: { min: 1, max: 480 },
} as const

/** 유통기한 임박 판정 (일) */
export const EXPIRY_SOON_DAYS = 3

/** 추천 후보 칼로리 허용 폭 */
export const SUGGEST_TOLERANCE = 0.15

/** 이 값 미만으로 잔여가 남으면 정식 끼니 대신 간식을 제안한다 */
export const SNACK_ONLY_THRESHOLD = 200

export const SEX_LABEL: Record<Sex, string> = { male: '남', female: '여' }

export const GOAL_LABEL: Record<DietGoal, string> = {
  lose: '다이어트',
  maintain: '유지',
  gain: '증량',
}

export const SLOT_LABEL: Record<MealSlot, string> = {
  breakfast: '아침',
  lunch: '점심',
  dinner: '저녁',
  snack: '간식',
}

export const SLOT_ORDER: readonly MealSlot[] = ['breakfast', 'lunch', 'dinner', 'snack']

export const KIND_LABEL = { cardio: '유산소', strength: '근력' } as const
