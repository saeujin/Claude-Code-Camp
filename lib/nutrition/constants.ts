import type { ActivityLevel, DietGoal, Sex } from './types'

/**
 * 활동계수 — 명세서 §F1 ②
 *
 * 운동은 여기 포함하지 않는다. F3에서 별도로 더한다.
 */
export const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  active: 1.55,
  veryActive: 1.725,
}

export const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  sedentary: '주로 앉아서 생활 (사무직, 재택근무)',
  light: '서서 일하거나 자주 걸음 (교사, 판매직)',
  active: '하루 대부분 서거나 걷는 직업 (간호사, 요식업)',
  veryActive: '육체노동 (건설, 물류, 농업)',
}

export const ACTIVITY_ORDER: ActivityLevel[] = [
  'sedentary',
  'light',
  'active',
  'veryActive',
]

export const SEX_LABELS: Record<Sex, string> = {
  male: '남성',
  female: '여성',
}

export const DIET_GOAL_LABELS: Record<DietGoal, string> = {
  lose: '다이어트',
  maintain: '유지',
  gain: '증량',
}

/**
 * 체지방 1kg의 에너지 환산값 — 명세서 §F1 ③
 *
 * 명세서 미결정 #9: 증량은 근육과 지방이 섞여 늘어나므로 실제 소요 에너지가
 * 이보다 낮다. 명세대로 감량·증량 모두 7,700을 쓴다.
 */
export const KCAL_PER_KG_BODY_WEIGHT = 7700

/** 탄수화물 : 단백질 : 지방 비율 — 명세서 §F1 ④ */
export const MACRO_RATIOS: Record<
  DietGoal,
  { carbs: number; protein: number; fat: number }
> = {
  lose: { carbs: 0.4, protein: 0.3, fat: 0.3 },
  maintain: { carbs: 0.5, protein: 0.2, fat: 0.3 },
  gain: { carbs: 0.5, protein: 0.25, fat: 0.25 },
}

/** Atwater 계수 (kcal/g) */
export const KCAL_PER_GRAM = { carbs: 4, protein: 4, fat: 9 } as const

/**
 * 단백질 하한 (체중 1kg당 g) — 명세서 §F1 ④, §F3 ③
 *
 * 감량 중 근손실 방지가 목적이며, 근력운동을 기록한 날은 근합성을 위해 올라간다.
 */
export const PROTEIN_FLOOR_G_PER_KG = {
  default: 1.2,
  strengthTraining: 1.6,
} as const

/** 입력 허용 범위 — 명세서 §F1 예외 */
export const INPUT_RANGES = {
  age: { min: 10, max: 100 },
  heightCm: { min: 100, max: 250 },
  weightKg: { min: 30, max: 300 },
  targetWeightKg: { min: 30, max: 300 },
  goalDurationDays: { min: 1, max: 365 * 5 },
} as const

export const DAYS_PER_WEEK = 7
