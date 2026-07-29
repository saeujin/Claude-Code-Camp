import { describe, expect, it } from 'vitest'
import type { Food } from './types'
import { filterFoodsByName } from './foodSearch'

function food(id: string, name: string): Food {
  return {
    id,
    name,
    per100g: { kcal: 100, carb: 0, protein: 0, fat: 0 },
    source: 'db',
    role: 'meal',
  }
}

const foods: Food[] = [
  food('a', '쌀밥'),
  food('b', '현미밥'),
  food('c', '김치찌개'),
  food('d', '배추김치'),
  food('e', 'Greek Yogurt'),
]

describe('filterFoodsByName', () => {
  it('이름에 질의가 포함된 음식만 남긴다', () => {
    expect(filterFoodsByName(foods, '김치').map((f) => f.id)).toEqual(['c', 'd'])
  })

  it('질의가 비면 전체를 돌려준다', () => {
    expect(filterFoodsByName(foods, '')).toHaveLength(5)
    expect(filterFoodsByName(foods, '   ')).toHaveLength(5)
  })

  it('앞뒤 공백을 무시한다', () => {
    expect(filterFoodsByName(foods, '  쌀밥  ').map((f) => f.id)).toEqual(['a'])
  })

  it('대소문자를 구분하지 않는다', () => {
    expect(filterFoodsByName(foods, 'greek').map((f) => f.id)).toEqual(['e'])
    expect(filterFoodsByName(foods, 'YOGURT').map((f) => f.id)).toEqual(['e'])
  })

  it('일치하는 게 없으면 빈 배열이다 — 직접 입력으로 넘어가는 조건', () => {
    expect(filterFoodsByName(foods, '없는음식')).toEqual([])
  })

  it('입력 배열을 바꾸지 않는다', () => {
    const original = [...foods]
    filterFoodsByName(foods, '김치')

    expect(foods).toEqual(original)
  })

  it('원본 순서를 유지한다 — 개인 음식이 앞에 오는 순서가 지켜져야 한다', () => {
    const custom = { ...food('z', '엄마 김치찌개'), source: 'custom' as const }
    const result = filterFoodsByName([custom, ...foods], '김치')

    expect(result.map((f) => f.id)).toEqual(['z', 'c', 'd'])
  })
})
