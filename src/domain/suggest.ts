// F5 다음 식사 추천.
// 계약 문서: .claude/skills/f5-suggest/SKILL.md
import { distributeRemaining, scaleNutrition } from './calc'
import { SLOT_ORDER, SNACK_ONLY_THRESHOLD, SUGGEST_TOLERANCE } from './constants'
import type { DaySummary, Food, Macros, MealSlot, Nutrition } from './types'

export interface Suggestion {
  food: Food
  amountG: number
  nutrition: Nutrition
  /** ±15% 범위를 벗어난 후보인가 — 후보가 모자라 범위를 넓힌 경우 */
  outOfRange: boolean
}

export type SuggestMode = 'normal' | 'snack' | 'over' | 'done'

export interface SuggestResult {
  mode: SuggestMode
  /** 이번 끼니에 배분된 칼로리 */
  perMealKcal: number
  remaining: number
  remainingSlots: MealSlot[]
  /** 잔여 탄단지 (목표 − 섭취). 음수면 이미 채운 것 */
  gap: Macros
  /** 가장 부족한 영양소 라벨. 없으면 null */
  topGap: { key: keyof Macros; label: string; amount: number } | null
  items: Suggestion[]
}

const MACRO_LABEL: Record<keyof Macros, string> = {
  carbG: '탄수화물',
  proteinG: '단백질',
  fatG: '지방',
}

/**
 * 남은 끼니. 이미 기록된 끼니는 세지 않는다.
 * 간식은 언제든 남은 것으로 본다 (기록 전이라면).
 */
export function remainingMealSlots(loggedSlots: readonly MealSlot[], hour: number): MealSlot[] {
  // 시각으로 지나간 끼니를 정한다 — 11시 전이면 아침부터, 17시 전이면 점심부터
  const startIndex = hour < 11 ? 0 : hour < 17 ? 1 : 2
  return SLOT_ORDER.filter((s, i) => i >= startIndex && !loggedSlots.includes(s))
}

export function suggestMeals(
  summary: DaySummary,
  foods: readonly Food[],
  remainingSlots: MealSlot[],
): SuggestResult {
  const gap: Macros = {
    carbG: summary.targetMacros.carbG - summary.consumed.carbG,
    proteinG: summary.targetMacros.proteinG - summary.consumed.proteinG,
    fatG: summary.targetMacros.fatG - summary.consumed.fatG,
  }

  const topGap = pickTopGap(gap, summary.targetMacros, summary.hasStrength)
  const base = {
    remaining: summary.remaining,
    remainingSlots,
    gap,
    topGap,
  }

  if (remainingSlots.length === 0) {
    return { ...base, mode: 'done', perMealKcal: 0, items: [] }
  }

  // 잔여가 음수면 추천 대신 저칼로리 음식만 (명세 347행)
  if (summary.remaining < 0) {
    const items = foods
      .map((f) => toSuggestion(f, false))
      .filter((s) => s.nutrition.kcal <= 200)
      .sort((a, b) => a.nutrition.kcal - b.nutrition.kcal)
      .slice(0, 5)
    return { ...base, mode: 'over', perMealKcal: 0, items }
  }

  const perMealKcal = distributeRemaining(summary.remaining, remainingSlots.length)

  // 잔여가 너무 적으면 간식 위주 (명세 348행)
  if (summary.remaining < SNACK_ONLY_THRESHOLD) {
    const items = foods
      .filter((f) => f.tags.includes('간식'))
      .map((f) => toSuggestion(f, false))
      .filter((s) => s.nutrition.kcal <= Math.max(summary.remaining, 50))
      .sort((a, b) => score(b, gap, topGap) - score(a, gap, topGap))
      .slice(0, 5)
    return { ...base, mode: 'snack', perMealKcal, items }
  }

  const all = foods.filter((f) => !f.tags.includes('간식')).map((f) => toSuggestion(f, false))
  const lo = perMealKcal * (1 - SUGGEST_TOLERANCE)
  const hi = perMealKcal * (1 + SUGGEST_TOLERANCE)

  let inRange = all.filter((s) => s.nutrition.kcal >= lo && s.nutrition.kcal <= hi)

  // 범위 안 후보가 3개 미만이면 범위를 넓히되 그 사실을 표시한다
  if (inRange.length < 3) {
    const widened = all
      .filter((s) => !inRange.includes(s))
      .map((s) => ({ ...s, outOfRange: true }))
      .sort(
        (a, b) =>
          Math.abs(a.nutrition.kcal - perMealKcal) - Math.abs(b.nutrition.kcal - perMealKcal),
      )
      .slice(0, 3 - inRange.length)
    inRange = [...inRange, ...widened]
  }

  const items = inRange.sort((a, b) => score(b, gap, topGap) - score(a, gap, topGap)).slice(0, 5)

  return { ...base, mode: 'normal', perMealKcal, items }
}

function toSuggestion(food: Food, outOfRange: boolean): Suggestion {
  return {
    food,
    amountG: food.servingG,
    nutrition: scaleNutrition(food.per100g, food.servingG),
    outOfRange,
  }
}

/**
 * 가장 부족한 영양소는 **목표 대비 비율**로 고른다. 절대 그램으로 고르면
 * 목표량 자체가 큰 탄수화물이 거의 항상 1위가 되어 버린다.
 * (S4 기준: 탄수 121g 부족 > 단백질 101g 부족이지만, 목표 대비로는
 *  단백질 85% > 탄수 77% 라서 명세대로 단백질이 뽑힌다)
 * 근력운동한 날은 단백질 비중을 높인다 (명세 338행).
 */
function pickTopGap(gap: Macros, target: Macros, hasStrength: boolean): SuggestResult['topGap'] {
  const entries = (Object.keys(MACRO_LABEL) as (keyof Macros)[])
    .map((key) => {
      const boost = key === 'proteinG' && hasStrength ? 1.5 : 1
      const ratio = target[key] > 0 ? (gap[key] / target[key]) * boost : 0
      return { key, label: MACRO_LABEL[key], amount: gap[key], ratio }
    })
    .filter((e) => e.amount > 0)
    .sort((a, b) => b.ratio - a.ratio)

  const top = entries[0]
  return top ? { key: top.key, label: top.label, amount: top.amount } : null
}

/**
 * 가장 부족한 영양소를 많이 채워주는 순으로 정렬한다 (명세 337행).
 * 1순위는 그 영양소를 채우는 비율, 나머지 두 영양소는 동점 처리용으로만 쓴다.
 */
function score(s: Suggestion, gap: Macros, topGap: SuggestResult['topGap']): number {
  if (!topGap) return 0

  const fill = (key: keyof Macros) => {
    const need = Math.max(0, gap[key])
    if (need === 0) return 0
    return Math.min(s.nutrition[key], need) / need
  }

  const others = (Object.keys(MACRO_LABEL) as (keyof Macros)[]).filter((k) => k !== topGap.key)
  const secondary = others.reduce((acc, k) => acc + fill(k), 0) / others.length

  return fill(topGap.key) + 0.2 * secondary
}
