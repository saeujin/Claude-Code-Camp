import { describe, expect, it } from 'vitest'
import type { Nutrition, RecommendInput } from './types'
import {
  defaultSlotFor,
  formatServings,
  recommendNextMeal,
  remainingMacros,
  remainingSlots,
  scoreCandidate,
  todayTargetKcal,
} from './recommend'
import { SEED_FOODS } from '../data/foods'

/**
 * 명세 S4(459~467줄)의 상황.
 *
 * 기본 목표 1,581 + 운동 311 = 오늘 목표 1,892. 아침 420kcal 기록 후 점심 추천.
 *
 * 잔여 탄수 111g·지방 34g은 명세에 나오지 않는 값이다. 명세 S2의 아침 420kcal를
 * 탄47·단18·지19로 가정해 역산한 것이다. **명세가 확정한 값은 단백질 잔여 101g뿐**
 * 이다(명세 463줄). 기획서 §6의 「가정값 명시」와 같은 내용.
 */
const S4_TARGET: Nutrition = { kcal: 1581, carb: 158, protein: 119, fat: 53 }
const S4_BREAKFAST: Nutrition = { kcal: 420, carb: 47, protein: 18, fat: 19 }

const s4Input: RecommendInput = {
  baseTarget: S4_TARGET,
  exerciseKcal: 311,
  hasStrengthWorkout: false,
  consumed: S4_BREAKFAST,
  slot: 'lunch',
  loggedSlots: ['breakfast'],
}

/** S4 시점의 잔여 탄단지 */
const S4_REMAINING: Nutrition = { kcal: 1472, carb: 111, protein: 101, fat: 34 }

function names(suggestions: { food: { name: string } }[]): string[] {
  return suggestions.map((suggestion) => suggestion.food.name)
}

describe('todayTargetKcal', () => {
  it('기본 목표에 운동 소모를 더한다', () => {
    expect(todayTargetKcal(1581, 311)).toBe(1892)
  })

  it('운동을 하지 않은 날은 기본 목표와 같다', () => {
    expect(todayTargetKcal(1581, 0)).toBe(1581)
  })
})

describe('remainingMacros', () => {
  it('목표에서 섭취를 뺀다', () => {
    expect(remainingMacros(S4_TARGET, S4_BREAKFAST)).toEqual({
      kcal: 1161,
      carb: 111,
      protein: 101,
      fat: 34,
    })
  })

  it('이미 채운 영양소는 음수로 두지 않고 0으로 깎는다', () => {
    const consumed: Nutrition = { kcal: 2000, carb: 200, protein: 130, fat: 60 }

    expect(remainingMacros(S4_TARGET, consumed)).toEqual({
      kcal: 0,
      carb: 0,
      protein: 0,
      fat: 0,
    })
  })
})

describe('remainingSlots', () => {
  it('요청 끼니와 그 이후 미기록 끼니를 센다 — S4는 점심·저녁·간식 세 끼', () => {
    expect(remainingSlots('lunch', ['breakfast'])).toEqual(['lunch', 'dinner', 'snack'])
  })

  it('이미 기록한 이후 끼니는 제외한다', () => {
    expect(remainingSlots('lunch', ['breakfast', 'dinner'])).toEqual(['lunch', 'snack'])
  })

  it('요청 끼니는 이미 기록이 있어도 포함한다', () => {
    // 그 끼니를 더 먹으려고 추천을 눌렀을 수 있고, 먹은 만큼은 이미 잔여에서 빠져 있다
    expect(remainingSlots('lunch', ['breakfast', 'lunch'])).toEqual(['lunch', 'dinner', 'snack'])
  })

  it('마지막 끼니는 자기 하나만 남는다', () => {
    expect(remainingSlots('snack', ['breakfast', 'lunch', 'dinner'])).toEqual(['snack'])
  })
})

describe('defaultSlotFor', () => {
  /** 그날 몇 시인지만 중요하다. 날짜는 고정해 둔다 */
  const at = (hour: number) => new Date(2026, 6, 29, hour, 0, 0)

  it('시각으로 끼니를 고른다', () => {
    expect(defaultSlotFor(at(8), [])).toBe('breakfast')
    expect(defaultSlotFor(at(12), [])).toBe('lunch')
    expect(defaultSlotFor(at(19), [])).toBe('dinner')
    expect(defaultSlotFor(at(23), [])).toBe('snack')
  })

  it('경계는 그 시각 전까지다', () => {
    expect(defaultSlotFor(at(9), [])).toBe('breakfast')
    expect(defaultSlotFor(at(10), [])).toBe('lunch')
    expect(defaultSlotFor(at(14), [])).toBe('lunch')
    expect(defaultSlotFor(at(15), [])).toBe('dinner')
    expect(defaultSlotFor(at(20), [])).toBe('dinner')
    expect(defaultSlotFor(at(21), [])).toBe('snack')
  })

  it('시각이 가리킨 끼니에 기록이 있으면 뒤의 빈 끼니로 넘긴다', () => {
    // 점심을 먹고 오후 1시에 열었다 → 저녁을 제안한다
    expect(defaultSlotFor(at(13), ['breakfast', 'lunch'])).toBe('dinner')
  })

  it('중간이 채워져 있으면 그다음 빈 끼니까지 넘어간다', () => {
    expect(defaultSlotFor(at(13), ['lunch', 'dinner'])).toBe('snack')
  })

  it('뒤가 전부 채워져 있으면 시각이 가리킨 끼니를 그대로 쓴다', () => {
    expect(defaultSlotFor(at(13), ['lunch', 'dinner', 'snack'])).toBe('lunch')
  })

  it('앞 끼니 기록은 판정에 영향을 주지 않는다', () => {
    expect(defaultSlotFor(at(12), ['breakfast'])).toBe('lunch')
  })
})

describe('scoreCandidate', () => {
  const carbHeavy: Nutrition = { kcal: 500, carb: 90, protein: 10, fat: 10 }
  const proteinHeavy: Nutrition = { kcal: 500, carb: 15, protein: 50, fat: 25 }

  it('부족률이 높은 영양소를 채우는 쪽이 높은 점수를 받는다', () => {
    // 부족률 탄 70% / 단 85% / 지 64% — 단백질이 최상위이므로 고단백이 이긴다.
    // 절대 부족량(탄 111g×4=444 > 단 101g×4=404)으로 가중하면 순위가 뒤집힌다.
    const carbScore = scoreCandidate(carbHeavy, S4_REMAINING, S4_TARGET, false)
    const proteinScore = scoreCandidate(proteinHeavy, S4_REMAINING, S4_TARGET, false)

    expect(proteinScore).toBeGreaterThan(carbScore)
  })

  it('근력운동한 날은 단백질 가중치가 올라 고단백 쪽 점수가 더 벌어진다', () => {
    const gap = (strength: boolean): number =>
      scoreCandidate(proteinHeavy, S4_REMAINING, S4_TARGET, strength) -
      scoreCandidate(carbHeavy, S4_REMAINING, S4_TARGET, strength)

    expect(gap(true)).toBeGreaterThan(gap(false))
  })

  it('이미 채운 영양소는 점수에서 제외한다', () => {
    // 탄수·지방을 다 채운 상태 — 단백질만 평가하므로 잔여의 절반을 채우면 0.5
    const proteinOnly: Nutrition = { kcal: 0, carb: 0, protein: 50, fat: 0 }
    const remaining: Nutrition = { kcal: 500, carb: 0, protein: 100, fat: 0 }

    expect(scoreCandidate(proteinOnly, remaining, S4_TARGET, false)).toBeCloseTo(0.5, 10)
  })

  it('잔여를 넘겨 채워도 1을 넘지 않는다', () => {
    const huge: Nutrition = { kcal: 9999, carb: 999, protein: 999, fat: 999 }

    expect(scoreCandidate(huge, S4_REMAINING, S4_TARGET, false)).toBeCloseTo(1, 10)
  })

  it('채울 영양소가 없으면 0', () => {
    const zero: Nutrition = { kcal: 0, carb: 0, protein: 0, fat: 0 }

    expect(scoreCandidate(S4_TARGET, zero, S4_TARGET, false)).toBe(0)
  })
})

describe('recommendNextMeal — 명세 S4 검산', () => {
  const result = recommendNextMeal(s4Input, SEED_FOODS)

  it('오늘 목표와 잔여 칼로리를 명세대로 계산한다', () => {
    expect(result.status).toBe('ok')
    expect(result.todayTargetKcal).toBe(1892)
    expect(result.remainingKcal).toBe(1472)
    expect(result.notice).toBeNull()
  })

  it('남은 세 끼로 균등 배분해 점심 몫을 약 491kcal로 잡는다', () => {
    expect(result.remainingSlotCount).toBe(3)
    expect(result.slotKcal).toBeCloseTo(490.67, 2)
  })

  it('기획서 §6의 상위 5개 순위를 그대로 재현한다', () => {
    expect(names(result.suggestions)).toEqual([
      '삼계탕',
      '불고기',
      '후라이드 치킨',
      '짬뽕',
      '햄버거',
    ])
  })

  it('점수는 내림차순이다', () => {
    const scores = result.suggestions.map((suggestion) => suggestion.score)

    expect(scores).toEqual([...scores].sort((a, b) => b - a))
  })

  it('불고기는 1인분(346kcal)이 밴드를 벗어나 1.5인분으로 제안된다', () => {
    const bulgogi = result.suggestions.find((suggestion) => suggestion.food.name === '불고기')

    expect(bulgogi?.servings).toBe(1.5)
    expect(bulgogi?.nutrition.kcal).toBeCloseTo(519, 0)
    expect(bulgogi?.nutrition.protein).toBeCloseTo(47.4, 1)
  })

  it('모든 후보가 끼니 몫 ±15% 밴드 안에 있다', () => {
    const slotKcal = result.slotKcal ?? 0

    for (const suggestion of result.suggestions) {
      expect(Math.abs(suggestion.nutrition.kcal - slotKcal)).toBeLessThanOrEqual(slotKcal * 0.15)
    }
  })

  it('추천 이유로 부족한 단백질과 운동 추가분을 알린다', () => {
    // 명세 465줄의 두 줄과 같은 내용
    expect(result.suggestions[0]?.reasons).toEqual([
      '단백질이 101g 부족해요',
      '운동으로 311 kcal가 추가됐어요',
    ])
  })

  it('주류·생재료·주식·반찬·음료는 후보에서 빠진다', () => {
    // role 없이 칼로리 밴드만 적용하면 소주 508kcal, 삼겹살(생) 497kcal가 잡혔다
    expect(names(result.suggestions)).not.toContain('소주')
    expect(names(result.suggestions)).not.toContain('삼겹살(생)')

    for (const suggestion of result.suggestions) {
      expect(suggestion.food.role).toBe('meal')
    }
  })
})

describe('recommendNextMeal — 분기 처리', () => {
  it('F1 미완료면 추천하지 않고 프로필 설정으로 유도한다', () => {
    const result = recommendNextMeal({ ...s4Input, baseTarget: null }, SEED_FOODS)

    expect(result.status).toBe('profile-required')
    expect(result.suggestions).toEqual([])
    expect(result.todayTargetKcal).toBeNull()
    expect(result.remainingKcal).toBeNull()
    expect(result.notice).toMatch(/프로필/)
  })

  it('목표를 넘긴 날은 저칼로리 음식만 칼로리 낮은 순으로 제안한다', () => {
    const result = recommendNextMeal(
      { ...s4Input, consumed: { kcal: 2000, carb: 200, protein: 90, fat: 70 } },
      SEED_FOODS,
    )

    expect(result.status).toBe('over-target')
    expect(result.remainingKcal).toBe(-108)
    expect(result.slotKcal).toBeNull()
    expect(result.notice).toMatch(/목표를 넘었어요/)

    // 잔여가 음수면 "부족한 영양소를 채운다"는 목적이 성립하지 않으므로 칼로리순
    expect(result.suggestions[0]?.food.name).toBe('딸기')
    for (const suggestion of result.suggestions) {
      expect(suggestion.nutrition.kcal).toBeLessThanOrEqual(200)
      expect(suggestion.servings).toBe(1)
    }
  })

  it('잔여가 200kcal 미만이면 정식 끼니 대신 간식을 제안한다', () => {
    const result = recommendNextMeal(
      {
        ...s4Input,
        // 오늘 목표 1,892 − 1,742 = 잔여 150kcal
        consumed: { kcal: 1742, carb: 150, protein: 70, fat: 45 },
        slot: 'snack',
        loggedSlots: ['breakfast', 'lunch', 'dinner'],
      },
      SEED_FOODS,
    )

    expect(result.status).toBe('snack-only')
    expect(result.remainingKcal).toBe(150)
    expect(result.remainingSlotCount).toBe(1)
    expect(result.slotKcal).toBe(150)
    expect(result.notice).toMatch(/간식/)

    expect(result.suggestions.length).toBeGreaterThanOrEqual(3)
    for (const suggestion of result.suggestions) {
      expect(suggestion.food.role).toBe('snack')
    }
  })

  it('간식 끼니를 요청하면 잔여가 넉넉해도 간식 풀에서 고른다', () => {
    const result = recommendNextMeal({ ...s4Input, slot: 'snack' }, SEED_FOODS)

    expect(result.status).toBe('ok')
    for (const suggestion of result.suggestions) {
      expect(suggestion.food.role).toBe('snack')
    }
  })

  it('명세대로 3~5개를 내놓는다', () => {
    for (const slot of ['lunch', 'dinner', 'snack'] as const) {
      const { suggestions } = recommendNextMeal({ ...s4Input, slot }, SEED_FOODS)

      expect(suggestions.length).toBeGreaterThanOrEqual(3)
      expect(suggestions.length).toBeLessThanOrEqual(5)
    }
  })
})

describe('formatServings', () => {
  it('정수는 소수점을 붙이지 않는다', () => {
    expect(formatServings(1)).toBe('1인분')
    expect(formatServings(2)).toBe('2인분')
  })

  it('반 인분은 소수점 한 자리로 보여준다', () => {
    expect(formatServings(0.5)).toBe('0.5인분')
    expect(formatServings(1.5)).toBe('1.5인분')
  })
})
