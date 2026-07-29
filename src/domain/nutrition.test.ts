import { describe, expect, it } from 'vitest'
import type { Food, MealEntry, MealSlot } from './types'
import {
  computeNutrition,
  formatSignedKcal,
  progressRatio,
  remainingNutrition,
  summarizeDay,
  sumNutrition,
  toGrams,
} from './nutrition'

/** 100g당 143kcal, 1인분 210g — 씨드의 쌀밥과 같은 값 */
const rice: Food = {
  id: 'rice',
  name: '쌀밥',
  per100g: { kcal: 143, carb: 31.7, protein: 2.6, fat: 0.3 },
  servingGram: 210,
  source: 'db',
  role: 'staple',
}

/** 1인분 기준량이 없는 음식 — 인분 입력을 받을 수 없다 */
const oliveOil: Food = {
  id: 'oil',
  name: '올리브유',
  per100g: { kcal: 887, carb: 0, protein: 0, fat: 100 },
  source: 'db',
  role: 'ingredient',
}

function entry(
  id: string,
  date: string,
  slot: MealSlot,
  kcal: number,
  createdAt = '2026-07-29T00:00:00.000Z',
): MealEntry {
  return {
    id,
    date,
    slot,
    foodId: 'x',
    foodName: '테스트 음식',
    amount: { unit: 'g', value: 100 },
    nutrition: { kcal, carb: 0, protein: 0, fat: 0 },
    createdAt,
  }
}

describe('toGrams', () => {
  it('g 단위는 값을 그대로 쓴다', () => {
    expect(toGrams(rice, { unit: 'g', value: 150 })).toBe(150)
  })

  it('인분 단위는 servingGram을 곱한다', () => {
    expect(toGrams(rice, { unit: 'serving', value: 1 })).toBe(210)
    expect(toGrams(rice, { unit: 'serving', value: 1.5 })).toBe(315)
  })

  it('servingGram이 없는 음식에 인분을 요청하면 던진다', () => {
    expect(() => toGrams(oliveOil, { unit: 'serving', value: 1 })).toThrow(/1인분 기준량이 없어/)
  })
})

describe('computeNutrition', () => {
  it('100g 기준값을 섭취량만큼 비례 환산한다', () => {
    const result = computeNutrition(rice, { unit: 'g', value: 200 })

    expect(result.kcal).toBeCloseTo(286)
    expect(result.carb).toBeCloseTo(63.4)
    expect(result.protein).toBeCloseTo(5.2)
    expect(result.fat).toBeCloseTo(0.6)
  })

  it('1인분(210g)은 100g 값의 2.1배다', () => {
    const result = computeNutrition(rice, { unit: 'serving', value: 1 })
    expect(result.kcal).toBeCloseTo(143 * 2.1)
  })

  it('중간 반올림 없이 계산한다 — 0.5인분을 두 번 더하면 1인분과 같다', () => {
    const half = computeNutrition(rice, { unit: 'serving', value: 0.5 })
    const whole = computeNutrition(rice, { unit: 'serving', value: 1 })

    expect(half.kcal * 2).toBeCloseTo(whole.kcal)
  })
})

describe('sumNutrition', () => {
  it('빈 배열은 0을 돌려준다', () => {
    expect(sumNutrition([])).toEqual({ kcal: 0, carb: 0, protein: 0, fat: 0 })
  })
})

describe('summarizeDay', () => {
  const entries = [
    entry('a', '2026-07-29', 'breakfast', 420),
    entry('b', '2026-07-29', 'lunch', 520),
    entry('c', '2026-07-29', 'lunch', 100),
    entry('d', '2026-07-28', 'dinner', 900), // 다른 날 — 집계에서 빠져야 한다
  ]

  it('해당 날짜의 기록만 합산한다', () => {
    expect(summarizeDay(entries, '2026-07-29').total.kcal).toBe(1040)
  })

  it('끼니별 소계를 낸다', () => {
    const bySlot = summarizeDay(entries, '2026-07-29').bySlot

    expect(bySlot.find((s) => s.slot === 'breakfast')?.subtotal.kcal).toBe(420)
    expect(bySlot.find((s) => s.slot === 'lunch')?.subtotal.kcal).toBe(620)
    expect(bySlot.find((s) => s.slot === 'dinner')?.subtotal.kcal).toBe(0)
  })

  it('기록이 없는 끼니도 4개 모두 포함한다', () => {
    const bySlot = summarizeDay([], '2026-07-29').bySlot

    expect(bySlot.map((s) => s.slot)).toEqual(['breakfast', 'lunch', 'dinner', 'snack'])
    expect(bySlot.every((s) => s.entries.length === 0)).toBe(true)
  })

  it('기록이 하나도 없는 날은 총합이 0이다', () => {
    expect(summarizeDay(entries, '2026-07-01').total.kcal).toBe(0)
  })

  it('같은 끼니 안에서는 기록 시각순으로 정렬한다', () => {
    const unordered = [
      entry('late', '2026-07-29', 'lunch', 100, '2026-07-29T12:30:00.000Z'),
      entry('early', '2026-07-29', 'lunch', 200, '2026-07-29T11:00:00.000Z'),
    ]
    const lunch = summarizeDay(unordered, '2026-07-29').bySlot.find((s) => s.slot === 'lunch')

    expect(lunch?.entries.map((e) => e.id)).toEqual(['early', 'late'])
  })

  it('기록을 빼면 누적이 즉시 줄어든다 — 캐시가 없으므로', () => {
    const before = summarizeDay(entries, '2026-07-29').total.kcal
    const after = summarizeDay(
      entries.filter((e) => e.id !== 'b'),
      '2026-07-29',
    ).total.kcal

    expect(before - after).toBe(520)
  })
})

describe('remainingNutrition', () => {
  // 명세 F1 예시 ㉮의 검산값 — 기본 목표 1,581kcal / 탄 158 · 단 119 · 지 53g
  const target = { kcal: 1581, carb: 158, protein: 119, fat: 53 }

  it('목표가 없으면 null이다 (F1 미완료 — 명세 226줄)', () => {
    expect(remainingNutrition({ kcal: 420, carb: 0, protein: 0, fat: 0 }, null)).toBeNull()
  })

  it('시나리오 S2 — 아침 420kcal 뒤 잔여는 1,161kcal', () => {
    const remaining = remainingNutrition({ kcal: 420, carb: 0, protein: 0, fat: 0 }, target)
    expect(remaining?.kcal).toBe(1161)
  })

  it('목표를 초과하면 음수를 그대로 돌려준다 (명세 225줄)', () => {
    const remaining = remainingNutrition({ kcal: 1800, carb: 0, protein: 0, fat: 0 }, target)
    expect(remaining?.kcal).toBe(-219)
  })

  it('탄단지도 각각 계산한다', () => {
    const remaining = remainingNutrition({ kcal: 0, carb: 100, protein: 130, fat: 20 }, target)

    expect(remaining?.carb).toBe(58)
    expect(remaining?.protein).toBe(-11) // 단백질만 초과
    expect(remaining?.fat).toBe(33)
  })
})

describe('progressRatio', () => {
  it('섭취 / 목표 비율을 돌려준다', () => {
    expect(progressRatio(790, 1581)).toBeCloseTo(0.4997, 3)
  })

  it('목표가 0 이하면 비율을 낼 수 없어 null이다', () => {
    expect(progressRatio(500, 0)).toBeNull()
    expect(progressRatio(500, -100)).toBeNull()
  })

  it('초과하면 1을 넘는 값을 돌려준다', () => {
    expect(progressRatio(2000, 1581)).toBeGreaterThan(1)
  })
})

describe('formatSignedKcal', () => {
  it('양수에는 +를 붙이고 천 단위를 끊는다', () => {
    expect(formatSignedKcal(1161)).toBe('+1,161')
  })

  it('음수는 부호를 그대로 남긴다', () => {
    expect(formatSignedKcal(-219)).toBe('-219')
  })
})
