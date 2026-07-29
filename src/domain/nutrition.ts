/**
 * F2. 하루 식단 기록 — 환산·집계·잔여 계산
 *
 * 이 파일의 모든 함수는 순수 함수다. 누적값은 어디에도 저장하지 않고 항상
 * 기록 목록에서 파생 계산한다. 그래서 기록을 수정·삭제하면 재집계가 자동으로
 * 이루어진다 (명세 224줄).
 *
 * 반올림은 화면 표시 시점에만 한다(`formatKcal`, `formatGram`). 중간 계산에서
 * 반올림하면 기록이 쌓일수록 오차가 누적된다.
 */

import type {
  Amount,
  DailyTarget,
  DaySummary,
  Food,
  MealEntry,
  MealSlot,
  Nutrition,
  SlotSummary,
} from './types'
import { MEAL_SLOTS } from './types'

export const ZERO_NUTRITION: Nutrition = { kcal: 0, carb: 0, protein: 0, fat: 0 }

/** 섭취량을 g으로 환산한다. 인분 단위인데 servingGram이 없는 음식이면 던진다. */
export function toGrams(food: Food, amount: Amount): number {
  if (amount.unit === 'g') return amount.value

  if (food.servingGram === undefined) {
    throw new Error(`'${food.name}'은 1인분 기준량이 없어 인분 단위로 기록할 수 없습니다.`)
  }
  return amount.value * food.servingGram
}

/**
 * 음식과 섭취량으로 영양값을 환산한다. 100g당 값에 비례한다.
 *
 * 명세 214줄 — "음식 DB에서 100g당 칼로리·탄단지를 조회해 섭취량만큼 환산"
 */
export function computeNutrition(food: Food, amount: Amount): Nutrition {
  const ratio = toGrams(food, amount) / 100

  return {
    kcal: food.per100g.kcal * ratio,
    carb: food.per100g.carb * ratio,
    protein: food.per100g.protein * ratio,
    fat: food.per100g.fat * ratio,
  }
}

export function addNutrition(a: Nutrition, b: Nutrition): Nutrition {
  return {
    kcal: a.kcal + b.kcal,
    carb: a.carb + b.carb,
    protein: a.protein + b.protein,
    fat: a.fat + b.fat,
  }
}

export function sumNutrition(items: readonly Nutrition[]): Nutrition {
  return items.reduce(addNutrition, ZERO_NUTRITION)
}

/** 특정 끼니의 기록만 골라 시간순으로 정렬한다 */
function entriesForSlot(entries: readonly MealEntry[], slot: MealSlot): MealEntry[] {
  return entries
    .filter((entry) => entry.slot === slot)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

/**
 * 하루치 기록을 끼니별로 묶고 합산한다.
 *
 * 명세 216줄 — "해당 날짜의 모든 기록을 합산해 누적 섭취 칼로리·탄단지 산출"
 * 기록이 없는 끼니도 소계 0으로 포함한다 (화면에 4개 끼니를 항상 보여주기 위해).
 */
export function summarizeDay(entries: readonly MealEntry[], date: string): DaySummary {
  const ofDay = entries.filter((entry) => entry.date === date)

  const bySlot: SlotSummary[] = MEAL_SLOTS.map((slot) => {
    const slotEntries = entriesForSlot(ofDay, slot)
    return {
      slot,
      entries: slotEntries,
      subtotal: sumNutrition(slotEntries.map((entry) => entry.nutrition)),
    }
  })

  return {
    date,
    bySlot,
    total: sumNutrition(bySlot.map((s) => s.subtotal)),
  }
}

/**
 * 잔여 칼로리 = 오늘 목표 칼로리 − 누적 섭취 칼로리 (명세 221줄)
 *
 * 목표가 없으면(F1 미완료) `null`을 돌려주고, 화면은 잔여 칼로리를 표시하지
 * 않는다 (명세 226줄). 목표를 초과하면 음수를 그대로 돌려준다 — 값을 0으로
 * 깎지 않는다 (명세 225줄).
 */
export function remainingNutrition(
  total: Nutrition,
  target: DailyTarget | null,
): Nutrition | null {
  if (target === null) return null

  return {
    kcal: target.kcal - total.kcal,
    carb: target.carb - total.carb,
    protein: target.protein - total.protein,
    fat: target.fat - total.fat,
  }
}

/** 목표 대비 섭취 비율(0~). 목표가 0 이하면 비율을 낼 수 없어 null */
export function progressRatio(consumed: number, target: number): number | null {
  if (target <= 0) return null
  return consumed / target
}

// ---------------------------------------------------------------------------
// 표시용 포맷 — 반올림은 여기서만 한다
// ---------------------------------------------------------------------------

export function formatKcal(value: number): string {
  return Math.round(value).toLocaleString('ko-KR')
}

/** 그램은 정수로 충분하다. 탄단지 표시에 사용 */
export function formatGram(value: number): string {
  return String(Math.round(value))
}

/** 부호를 붙여 표시한다. 잔여 칼로리가 음수일 때 초과분을 드러내기 위한 것 */
export function formatSignedKcal(value: number): string {
  const rounded = Math.round(value)
  const sign = rounded > 0 ? '+' : ''
  return `${sign}${rounded.toLocaleString('ko-KR')}`
}
