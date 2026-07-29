// 순수 계산 함수. React·Supabase에 의존하지 않는다.
// 계약 문서: .claude/skills/diet-domain/references/formulas.md
//
// ★ 반올림 규칙 — BMR·TDEE·일일 조정량을 각각 정수로 반올림한 뒤 기본 목표를 계산한다.
//   실수로 이어 계산하면 명세의 1,581이 1,580으로 어긋난다.

import { diffDays } from '../lib/date'
import {
  KCAL_PER_G,
  KCAL_PER_KG_FAT,
  MACRO_RATIOS,
  PROTEIN_FLOOR_PER_KG,
} from './constants'
import type {
  ActivityLevel,
  DateKey,
  DietGoal,
  ExerciseEntry,
  GoalPlan,
  Macros,
  MealEntry,
  Nutrition,
  Profile,
  Sex,
} from './types'

/** ① BMR — Mifflin-St Jeor. 반올림하지 않은 실수를 돌려준다 */
export function calcBMR(sex: Sex, weightKg: number, heightCm: number, age: number): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age
  return sex === 'male' ? base + 5 : base - 161
}

/** ② TDEE = round(BMR × 활동계수). BMR은 반올림 전 실수를 넣는다 */
export function calcTDEE(bmrRaw: number, activityLevel: ActivityLevel): number {
  return Math.round(bmrRaw * activityLevel)
}

export function calcGoalDays(startedOn: DateKey, targetDate: DateKey): number {
  return diffDays(startedOn, targetDate)
}

/** ③ 일일 조정량 = round(|체중차| × 7,700 ÷ 기간(일)). 항상 0 이상 */
export function calcDailyAdjustment(
  currentWeightKg: number,
  targetWeightKg: number,
  days: number,
): number {
  if (days <= 0) return 0
  const deltaKg = Math.abs(targetWeightKg - currentWeightKg)
  if (deltaKg === 0) return 0
  return Math.round((deltaKg * KCAL_PER_KG_FAT) / days)
}

/**
 * ④ 기본 목표. 값을 제한하지 않는다 — BMR보다 낮거나 0 이하가 되어도
 * 그대로 돌려주고 사실만 알린다 (명세 130~133, 195행).
 */
export function calcBaseTarget(tdee: number, dailyAdjustment: number, goal: DietGoal): number {
  if (goal === 'lose') return tdee - dailyAdjustment
  if (goal === 'gain') return tdee + dailyAdjustment
  return tdee
}

/** 주당 변화 속도 (kg/주, 소수 2자리) */
export function calcWeeklyRate(weightDeltaKg: number, days: number): number {
  if (days <= 0) return 0
  const weeks = days / 7
  return Math.round((Math.abs(weightDeltaKg) / weeks) * 100) / 100
}

/** 단백질 하한 (g). 그날 근력 운동이 있으면 체중 × 1.6g */
export function calcProteinFloor(weightKg: number, hasStrength: boolean): number {
  const per = hasStrength ? PROTEIN_FLOOR_PER_KG.strength : PROTEIN_FLOOR_PER_KG.normal
  return Math.round(weightKg * per)
}

/**
 * ⑤ 탄단지. 비율로 계산한 뒤 단백질 하한을 적용하고,
 * 하한 때문에 늘어난 만큼의 열량을 탄수화물에서 뺀다.
 */
export function calcMacros(
  targetKcal: number,
  goal: DietGoal,
  weightKg: number,
  hasStrength: boolean,
): Macros {
  const r = MACRO_RATIOS[goal]
  let carbG = Math.round((targetKcal * r.carb) / KCAL_PER_G.carb)
  let proteinG = Math.round((targetKcal * r.protein) / KCAL_PER_G.protein)
  const fatG = Math.round((targetKcal * r.fat) / KCAL_PER_G.fat)

  const floor = calcProteinFloor(weightKg, hasStrength)
  if (proteinG < floor) {
    const deficitG = floor - proteinG
    proteinG = floor
    carbG -= Math.round((deficitG * KCAL_PER_G.protein) / KCAL_PER_G.carb)
  }

  return {
    carbG: Math.max(0, carbG),
    proteinG: Math.max(0, proteinG),
    fatG: Math.max(0, fatG),
  }
}

/** ⑥ 운동 소모 = round(MET × 체중 × 분 ÷ 60) */
export function calcExerciseBurn(met: number, weightKg: number, minutes: number): number {
  return Math.round((met * weightKg * minutes) / 60)
}

/** 오늘 목표 = 기본 목표 + 운동 소모 합계 (100% 반영 — 미결정 #8) */
export function calcTodayTarget(baseTarget: number, exerciseBurnTotal: number): number {
  return baseTarget + exerciseBurnTotal
}

/** 잔여. 음수가 될 수 있으며 그것이 정상이다 */
export function calcRemaining(todayTarget: number, consumedKcal: number): number {
  return todayTarget - consumedKcal
}

/** 남은 끼니로 균등 분할 (미결정 #7 확정) */
export function distributeRemaining(remainingKcal: number, remainingMealCount: number): number {
  if (remainingMealCount <= 0) return 0
  return Math.round(remainingKcal / remainingMealCount)
}

/**
 * F1 계산 전체. Profile에서 매번 파생하며 저장하지 않는다.
 * @param today 기준일. 남은 기간과 남은 체중 변화량으로 조정량을 다시 계산한다 (명세 196행)
 * @param hasStrength 그날 근력 운동 여부 — 목표 탄단지의 단백질 하한을 좌우한다
 */
export function buildGoalPlan(profile: Profile, today: DateKey, hasStrength = false): GoalPlan {
  const bmrRaw = calcBMR(profile.sex, profile.weightKg, profile.heightCm, profile.age)
  const bmr = Math.round(bmrRaw)
  const tdee = calcTDEE(bmrRaw, profile.activityLevel)

  const { targetWeightKg, targetDate, goal } = profile

  // 유지 목표이거나 목표 체중 = 현재 체중이면 조정량 0 (명세 194행)
  const noAdjust =
    goal === 'maintain' ||
    targetWeightKg === null ||
    targetDate === null ||
    targetWeightKg === profile.weightKg

  if (noAdjust) {
    const baseTarget = tdee
    return {
      bmr,
      bmrRaw,
      tdee,
      dailyAdjustment: 0,
      baseTarget,
      weeklyRateKg: 0,
      targetDate,
      daysRemaining: targetDate ? Math.max(0, diffDays(today, targetDate)) : 0,
      expired: false,
      macros: calcMacros(baseTarget, goal, profile.weightKg, hasStrength),
      belowBmr: baseTarget < bmr,
    }
  }

  const daysRemaining = diffDays(today, targetDate)
  const expired = daysRemaining <= 0

  // 기간이 지나면 마지막 기본 목표를 그대로 쓴다 (명세 197행).
  // 원래 기간과 시작 체중으로 계산해 값을 고정한다.
  const days = expired ? calcGoalDays(profile.startedOn, targetDate) : daysRemaining
  const fromWeight = expired ? profile.startWeightKg : profile.weightKg
  const deltaKg = Math.abs(targetWeightKg - fromWeight)

  const dailyAdjustment = calcDailyAdjustment(fromWeight, targetWeightKg, days)
  const baseTarget = calcBaseTarget(tdee, dailyAdjustment, goal)

  return {
    bmr,
    bmrRaw,
    tdee,
    dailyAdjustment,
    baseTarget,
    weeklyRateKg: calcWeeklyRate(deltaKg, days),
    targetDate,
    daysRemaining: Math.max(0, daysRemaining),
    expired,
    macros: calcMacros(baseTarget, goal, profile.weightKg, hasStrength),
    belowBmr: baseTarget < bmr,
  }
}

// ── 집계 ──────────────────────────────────────────────────

export const EMPTY_NUTRITION: Nutrition = { kcal: 0, carbG: 0, proteinG: 0, fatG: 0 }

export function sumNutrition(entries: readonly MealEntry[]): Nutrition {
  return entries.reduce<Nutrition>(
    (acc, e) => ({
      kcal: acc.kcal + e.nutrition.kcal,
      carbG: acc.carbG + e.nutrition.carbG,
      proteinG: acc.proteinG + e.nutrition.proteinG,
      fatG: acc.fatG + e.nutrition.fatG,
    }),
    { ...EMPTY_NUTRITION },
  )
}

export function sumExerciseBurn(entries: readonly ExerciseEntry[]): number {
  return entries.reduce((acc, e) => acc + e.kcal, 0)
}

export function hasStrengthExercise(entries: readonly ExerciseEntry[]): boolean {
  return entries.some((e) => e.kind === 'strength')
}

/** 100g당 영양소를 섭취량(g)만큼 환산. 결과를 기록에 값으로 굳혀 저장한다 */
export function scaleNutrition(per100g: Nutrition, amountG: number): Nutrition {
  const f = amountG / 100
  return {
    kcal: Math.round(per100g.kcal * f),
    carbG: Math.round(per100g.carbG * f * 10) / 10,
    proteinG: Math.round(per100g.proteinG * f * 10) / 10,
    fatG: Math.round(per100g.fatG * f * 10) / 10,
  }
}
