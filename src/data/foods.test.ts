/**
 * 씨드 음식 DB의 무결성 검사.
 *
 * 값 자체의 정확성은 검증할 수 없지만(미결정 #2 — 데이터 출처), 구조가
 * 깨지거나 물리적으로 불가능한 값이 섞이는 것은 막을 수 있다.
 */

import { describe, expect, it } from 'vitest'
import { SEED_FOODS } from './foods'
import { kcalFromMacros } from '../domain/validation'
import { computeNutrition } from '../domain/nutrition'

describe('SEED_FOODS', () => {
  it('비어 있지 않다', () => {
    expect(SEED_FOODS.length).toBeGreaterThan(50)
  })

  it('id가 중복되지 않는다 — 중복되면 기록이 엉뚱한 음식을 가리킨다', () => {
    const ids = SEED_FOODS.map((food) => food.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('이름이 중복되지 않는다 — 검색 결과에서 구분할 수 없다', () => {
    const names = SEED_FOODS.map((food) => food.name)
    expect(new Set(names).size).toBe(names.length)
  })

  it('모두 source가 db다', () => {
    expect(SEED_FOODS.every((food) => food.source === 'db')).toBe(true)
  })

  it('모두 role을 가진다', () => {
    expect(SEED_FOODS.filter((food) => food.role === undefined)).toEqual([])
  })

  it('영양값이 모두 0 이상이다', () => {
    for (const food of SEED_FOODS) {
      const { kcal, carb, protein, fat } = food.per100g
      expect(Math.min(kcal, carb, protein, fat), food.name).toBeGreaterThanOrEqual(0)
    }
  })

  it('100g당 탄단지 합이 100g을 넘지 않는다', () => {
    for (const food of SEED_FOODS) {
      const { carb, protein, fat } = food.per100g
      expect(carb + protein + fat, food.name).toBeLessThanOrEqual(100)
    }
  })

  it('servingGram이 있으면 0보다 크다', () => {
    for (const food of SEED_FOODS) {
      if (food.servingGram !== undefined) {
        expect(food.servingGram, food.name).toBeGreaterThan(0)
      }
    }
  })

  /**
   * 탄단지 역산(탄 4 · 단 4 · 지 9)과 표기 칼로리의 허용 오차.
   *
   * 오차가 나는 이유가 음식마다 다르므로 역할별로 다르게 잡는다.
   * - 주류: 열량 대부분이 알코올에서 나와 탄단지에 아예 잡히지 않는다 → 검사 제외
   * - 채소·반찬: 탄수화물에 식이섬유가 포함되지만 실제 열량은 그만큼 나지 않는다.
   *   구운 김(표기 178 / 역산 274)이 대표 사례다 → 60%
   * - 그 밖: 오차가 크면 입력 실수일 가능성이 높다 → 40%
   */
  function toleranceFor(role: string): number | null {
    if (role === 'alcohol') return null
    if (role === 'ingredient' || role === 'side') return 0.6
    return 0.4
  }

  it('칼로리가 탄단지 역산값과 크게 어긋나지 않는다', () => {
    for (const food of SEED_FOODS) {
      const tolerance = toleranceFor(food.role)
      if (tolerance === null) continue

      const stated = food.per100g.kcal
      if (stated === 0) continue

      const derived = kcalFromMacros(food.per100g)
      const gap = Math.abs(derived - stated) / stated

      expect(gap, `${food.name} (표기 ${stated} / 역산 ${Math.round(derived)})`).toBeLessThan(
        tolerance,
      )
    }
  })

  it('쌀밥 1인분은 약 300kcal다 — 환산 경로 전체를 한 번 확인한다', () => {
    const rice = SEED_FOODS.find((food) => food.name === '쌀밥')
    expect(rice).toBeDefined()

    const nutrition = computeNutrition(rice!, { unit: 'serving', value: 1 })
    expect(nutrition.kcal).toBeCloseTo(300, 0)
  })
})
