import {
  ACTIVITY_FACTORS,
  DAYS_PER_WEEK,
  KCAL_PER_GRAM,
  KCAL_PER_KG_BODY_WEIGHT,
  MACRO_RATIOS,
  PROTEIN_FLOOR_G_PER_KG,
} from './constants'
import { addDays, daysBetween, toISODate } from './date'
import type {
  CalcOptions,
  DietGoal,
  MacroTargets,
  Profile,
  Sex,
  Targets,
  TargetNotice,
} from './types'

/**
 * 명세서 §F1의 계산을 그대로 옮긴 순수 함수 모음.
 *
 * ⚠️ 반올림 시점이 결과를 바꾼다.
 *    명세서 계산 예시 ㉮는 TDEE와 일일 조정량을 **각각 반올림한 뒤** 빼서 1,581을 얻는다.
 *      round(2038.5) − round(458.33) = 2039 − 458 = 1581   ✓ 명세서 값
 *      round(2038.5 − 458.33)        = round(1580.17) = 1580   ✗
 *    단계별 반올림을 유지할 것.
 *
 * ⚠️ 기본 목표 칼로리는 어떤 경우에도 보정하지 않는다.
 *    BMR보다 낮아도, 0 이하여도 계산값 그대로 반환한다.
 *    명세서 §F1 ③: "앱은 값을 제한하지 않는다 … 속도를 정하는 것은 사용자의 몫이다."
 *    보정하면 계산 예시 ㉮(목표 1,581 < BMR 1,699)가 재현되지 않는다.
 */

/** 기초대사량 (Mifflin-St Jeor) — 명세서 §F1 ①. 반올림하지 않는다 */
export function calcBMR(params: {
  sex: Sex
  weightKg: number
  heightCm: number
  age: number
}): number {
  const { sex, weightKg, heightCm, age } = params
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age
  return sex === 'male' ? base + 5 : base - 161
}

/** 일일 총 소비 열량 — 명세서 §F1 ②. 여기서 반올림한다 */
export function calcTDEE(bmr: number, activityLevel: Profile['activityLevel']): number {
  return Math.round(bmr * ACTIVITY_FACTORS[activityLevel])
}

/** 목표 달성에 필요한 하루 조정 열량 — 명세서 §F1 ③. 항상 0 이상 */
export function calcDailyAdjustment(params: {
  currentWeightKg: number
  targetWeightKg: number
  durationDays: number
}): number {
  const { currentWeightKg, targetWeightKg, durationDays } = params
  if (durationDays <= 0) return 0
  const weightChangeKg = Math.abs(targetWeightKg - currentWeightKg)
  return Math.round((weightChangeKg * KCAL_PER_KG_BODY_WEIGHT) / durationDays)
}

/** 주당 예상 변화 속도 (kg/주, 소수 2자리) */
export function calcWeeklyRate(params: {
  currentWeightKg: number
  targetWeightKg: number
  durationDays: number
}): number {
  const { currentWeightKg, targetWeightKg, durationDays } = params
  if (durationDays <= 0) return 0
  const weightChangeKg = Math.abs(targetWeightKg - currentWeightKg)
  const weeks = durationDays / DAYS_PER_WEEK
  return Math.round((weightChangeKg / weeks) * 100) / 100
}

/**
 * 탄·단·지 목표 그램 — 명세서 §F1 ④
 *
 * 단백질이 하한(체중 × 1.2g, 근력운동일 1.6g)에 못 미치면 하한으로 올리고,
 * 올린 그램 수만큼 탄수화물에서 뺀다. 둘 다 4kcal/g이라 그램 수가 그대로 상쇄된다.
 */
export function calcMacros(params: {
  targetCalories: number
  goal: DietGoal
  weightKg: number
  hasStrengthTraining?: boolean
}): { macros: MacroTargets; notices: TargetNotice[] } {
  const { targetCalories, goal, weightKg, hasStrengthTraining = false } = params
  const ratio = MACRO_RATIOS[goal]
  const notices: TargetNotice[] = []

  let carbsG = Math.round((targetCalories * ratio.carbs) / KCAL_PER_GRAM.carbs)
  let proteinG = Math.round((targetCalories * ratio.protein) / KCAL_PER_GRAM.protein)
  const fatG = Math.round((targetCalories * ratio.fat) / KCAL_PER_GRAM.fat)

  const floorPerKg = hasStrengthTraining
    ? PROTEIN_FLOOR_G_PER_KG.strengthTraining
    : PROTEIN_FLOOR_G_PER_KG.default
  const proteinFloorG = Math.round(weightKg * floorPerKg)

  let proteinFloorApplied = false
  if (proteinG < proteinFloorG) {
    const addedG = proteinFloorG - proteinG
    proteinG = proteinFloorG
    carbsG -= addedG
    proteinFloorApplied = true
  }

  // 목표 칼로리와 달리 여기는 음수가 의미를 갖지 않는다. 0에서 멈추고 사실을 알린다.
  if (carbsG < 0) {
    carbsG = 0
    notices.push('proteinFloorExceedsBudget')
  }

  return {
    macros: { carbsG, proteinG, fatG, proteinFloorApplied, proteinFloorG },
    notices,
  }
}

/**
 * F1 전체 계산. 화면과 다른 기능(F3·F5·F7)이 쓰는 진입점.
 */
export function calcAllTargets(profile: Profile, options: CalcOptions = {}): Targets {
  const { today = new Date(), hasStrengthTraining = false } = options
  const todayIso = toISODate(today)
  const notices: TargetNotice[] = []

  const bmr = calcBMR({
    sex: profile.sex,
    weightKg: profile.weightKg,
    heightCm: profile.heightCm,
    age: profile.age,
  })
  const tdee = calcTDEE(bmr, profile.activityLevel)

  // ── 유지 목표 판정 ────────────────────────────────────────────
  // 목표 체중 = 현재 체중이면 무엇을 골랐든 유지로 처리한다 (§F1 예외).
  const hasGoalInputs =
    profile.dietGoal !== 'maintain' &&
    profile.targetWeightKg != null &&
    profile.goalDurationDays != null &&
    profile.goalDurationDays > 0

  const weightMatchesTarget =
    hasGoalInputs && profile.targetWeightKg === profile.weightKg

  if (weightMatchesTarget) notices.push('goalWeightEqualsCurrent')

  const effectiveGoal: DietGoal =
    !hasGoalInputs || weightMatchesTarget ? 'maintain' : profile.dietGoal

  // ── 유지 목표: 조정량 없음 ────────────────────────────────────
  if (effectiveGoal === 'maintain') {
    const baseTargetCalories = tdee
    const { macros, notices: macroNotices } = calcMacros({
      targetCalories: baseTargetCalories,
      goal: 'maintain',
      weightKg: profile.weightKg,
      hasStrengthTraining,
    })
    if (baseTargetCalories < bmr) notices.push('belowBmr')
    if (baseTargetCalories <= 0) notices.push('nonPositiveTarget')

    return {
      bmr,
      tdee,
      dailyAdjustmentKcal: 0,
      baseTargetCalories,
      effectiveGoal: 'maintain',
      weeklyRateKg: null,
      targetDate: null,
      remainingDays: null,
      macros,
      notices: [...notices, ...macroNotices],
    }
  }

  // ── 감량 / 증량 ───────────────────────────────────────────────
  const targetWeightKg = profile.targetWeightKg as number
  const goalDurationDays = profile.goalDurationDays as number

  const targetDate = addDays(profile.goalStartDate, goalDurationDays)
  const rawRemaining =
    targetDate != null ? daysBetween(todayIso, targetDate) : null
  const remainingDays = rawRemaining == null ? null : Math.max(0, rawRemaining)

  // 몸무게를 갱신하면 남은 기간으로 다시 나눈다 (§F1 예외).
  // 기간이 지났으면 0으로 나눌 수 없으므로 원래 기간을 분모로 삼아 값을 고정하고
  // 새 목표 설정을 유도한다.
  const periodEnded = remainingDays != null && remainingDays <= 0
  if (periodEnded) notices.push('goalPeriodEnded')
  const denominatorDays =
    remainingDays != null && remainingDays > 0 ? remainingDays : goalDurationDays

  const dailyAdjustmentKcal = calcDailyAdjustment({
    currentWeightKg: profile.weightKg,
    targetWeightKg,
    durationDays: denominatorDays,
  })

  const baseTargetCalories =
    effectiveGoal === 'lose'
      ? tdee - dailyAdjustmentKcal
      : tdee + dailyAdjustmentKcal

  if (baseTargetCalories < bmr) notices.push('belowBmr')
  if (baseTargetCalories <= 0) notices.push('nonPositiveTarget')

  const { macros, notices: macroNotices } = calcMacros({
    targetCalories: baseTargetCalories,
    goal: effectiveGoal,
    weightKg: profile.weightKg,
    hasStrengthTraining,
  })

  return {
    bmr,
    tdee,
    dailyAdjustmentKcal,
    baseTargetCalories,
    effectiveGoal,
    weeklyRateKg: calcWeeklyRate({
      currentWeightKg: profile.weightKg,
      targetWeightKg,
      durationDays: denominatorDays,
    }),
    targetDate,
    remainingDays,
    macros,
    notices: [...notices, ...macroNotices],
  }
}
