// 하루 집계 — F5·F7의 단일 입력.
import {
  buildGoalPlan,
  calcRemaining,
  calcTodayTarget,
  hasStrengthExercise,
  sumExerciseBurn,
  sumNutrition,
} from './calc'
import type { DateKey, DaySummary, ExerciseEntry, GoalPlan, MealEntry, Profile } from './types'

export interface DayInput {
  date: DateKey
  profile: Profile | null
  meals: readonly MealEntry[]
  exercises: readonly ExerciseEntry[]
}

export interface DayResult {
  /** 프로필이 없으면 null — 목표·잔여를 표시하지 않는다 (0으로 표시하지 말 것) */
  plan: GoalPlan | null
  summary: DaySummary | null
  consumedKcal: number
  exerciseBurn: number
  hasStrength: boolean
}

export function summarizeDay({ date, profile, meals, exercises }: DayInput): DayResult {
  const consumed = sumNutrition(meals)
  const exerciseBurn = sumExerciseBurn(exercises)
  const hasStrength = hasStrengthExercise(exercises)

  if (!profile) {
    return { plan: null, summary: null, consumedKcal: consumed.kcal, exerciseBurn, hasStrength }
  }

  const plan = buildGoalPlan(profile, date, hasStrength)
  const todayTarget = calcTodayTarget(plan.baseTarget, exerciseBurn)

  const summary: DaySummary = {
    date,
    baseTarget: plan.baseTarget,
    exerciseBurn,
    todayTarget,
    consumed,
    remaining: calcRemaining(todayTarget, consumed.kcal),
    targetMacros: plan.macros,
    hasStrength,
  }

  return { plan, summary, consumedKcal: consumed.kcal, exerciseBurn, hasStrength }
}

/** 하루 소모 합계가 기본 목표를 넘으면 입력 오류 가능성을 확인한다 (명세 288행) */
export function isBurnSuspicious(exerciseBurn: number, baseTarget: number): boolean {
  return baseTarget > 0 && exerciseBurn > baseTarget
}
