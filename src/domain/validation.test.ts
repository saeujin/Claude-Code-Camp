import { describe, expect, it } from 'vitest'
import type { Food } from './types'
import {
  kcalFromMacros,
  macroMismatchWarning,
  validateAmount,
  validateCustomFood,
  type CustomFoodInput,
} from './validation'

const rice: Food = {
  id: 'rice',
  name: '쌀밥',
  per100g: { kcal: 143, carb: 31.7, protein: 2.6, fat: 0.3 },
  servingGram: 210,
  source: 'db',
  role: 'staple',
}

const oliveOil: Food = {
  id: 'oil',
  name: '올리브유',
  per100g: { kcal: 887, carb: 0, protein: 0, fat: 100 },
  source: 'db',
  role: 'ingredient',
}

describe('validateAmount', () => {
  it('정상 입력은 오류가 없다', () => {
    expect(validateAmount(rice, { unit: 'g', value: 210 })).toEqual({})
    expect(validateAmount(rice, { unit: 'serving', value: 1.5 })).toEqual({})
  })

  it('0과 음수를 막는다', () => {
    expect(validateAmount(rice, { unit: 'g', value: 0 }).amount).toMatch(/0보다 커야/)
    expect(validateAmount(rice, { unit: 'g', value: -50 }).amount).toMatch(/0보다 커야/)
  })

  it('숫자가 아닌 입력을 막는다 — 빈 input은 NaN이 된다', () => {
    expect(validateAmount(rice, { unit: 'g', value: Number.NaN }).amount).toMatch(/숫자로/)
  })

  it('오타로 보이는 과대 입력을 막는다', () => {
    expect(validateAmount(rice, { unit: 'g', value: 30000 }).amount).toMatch(/너무 큽니다/)
    expect(validateAmount(rice, { unit: 'serving', value: 100 }).amount).toMatch(/너무 큽니다/)
  })

  it('1인분 기준량이 없는 음식은 인분으로 기록할 수 없다', () => {
    expect(validateAmount(oliveOil, { unit: 'serving', value: 1 }).amount).toMatch(/g으로 입력/)
  })

  it('1인분 기준량이 없어도 g 입력은 통과한다', () => {
    expect(validateAmount(oliveOil, { unit: 'g', value: 10 })).toEqual({})
  })

  // 명세 225줄 — 목표 초과는 검증 대상이 아니다. 큰 값도 상한 안이면 통과해야 한다.
  it('목표를 넘길 만한 양이어도 막지 않는다', () => {
    expect(validateAmount(rice, { unit: 'g', value: 2000 })).toEqual({})
  })
})

describe('validateCustomFood', () => {
  const base: CustomFoodInput = {
    name: '엄마 김치볶음밥',
    kcal: '180',
    carb: '25',
    protein: '6',
    fat: '5',
    servingGram: '350',
  }

  it('정상 입력을 파싱한다', () => {
    const { errors, parsed } = validateCustomFood(base)

    expect(errors).toEqual({})
    expect(parsed).toEqual({
      name: '엄마 김치볶음밥',
      per100g: { kcal: 180, carb: 25, protein: 6, fat: 5 },
      servingGram: 350,
    })
  })

  it('이름을 다듬어 저장한다', () => {
    const { parsed } = validateCustomFood({ ...base, name: '  두부조림  ' })
    expect(parsed?.name).toBe('두부조림')
  })

  it('이름이 비면 막는다', () => {
    const { errors, parsed } = validateCustomFood({ ...base, name: '   ' })

    expect(errors.name).toMatch(/이름을 입력/)
    expect(parsed).toBeNull()
  })

  it('칼로리는 필수다', () => {
    const { errors, parsed } = validateCustomFood({ ...base, kcal: '' })

    expect(errors.kcal).toMatch(/칼로리를 입력/)
    expect(parsed).toBeNull()
  })

  it('탄단지는 비워도 0으로 통과한다', () => {
    const { errors, parsed } = validateCustomFood({
      ...base,
      carb: '',
      protein: '',
      fat: '',
    })

    expect(errors).toEqual({})
    expect(parsed?.per100g).toEqual({ kcal: 180, carb: 0, protein: 0, fat: 0 })
  })

  it('1인분 중량은 선택이며 비우면 undefined다', () => {
    const { parsed } = validateCustomFood({ ...base, servingGram: '' })

    expect(parsed).not.toBeNull()
    expect(parsed?.servingGram).toBeUndefined()
  })

  it('100g당 탄단지가 100g을 넘을 수 없다', () => {
    expect(validateCustomFood({ ...base, carb: '150' }).errors.carb).toMatch(/넘을 수 없/)
  })

  it('100g당 칼로리 상한을 넘기면 막는다 — 지방 100g도 900kcal뿐이다', () => {
    expect(validateCustomFood({ ...base, kcal: '5000' }).errors.kcal).toMatch(/넘을 수 없/)
  })

  it('음수 값을 막는다', () => {
    expect(validateCustomFood({ ...base, kcal: '-10' }).errors.kcal).toMatch(/0 이상/)
    expect(validateCustomFood({ ...base, protein: '-1' }).errors.protein).toMatch(/0 이상/)
  })

  it('1인분 중량이 0 이하면 막는다', () => {
    expect(validateCustomFood({ ...base, servingGram: '0' }).errors.servingGram).toMatch(/0보다 큰/)
  })
})

describe('kcalFromMacros', () => {
  it('탄 4 · 단 4 · 지 9 kcal/g으로 역산한다', () => {
    expect(kcalFromMacros({ kcal: 0, carb: 10, protein: 10, fat: 10 })).toBe(170)
  })
})

describe('macroMismatchWarning', () => {
  it('입력 칼로리와 역산값이 비슷하면 경고하지 않는다', () => {
    // 25*4 + 6*4 + 5*9 = 169 ≈ 180 (차이 6%)
    expect(macroMismatchWarning({ kcal: 180, carb: 25, protein: 6, fat: 5 })).toBeNull()
  })

  it('30%를 넘게 벗어나면 안내 문구를 돌려준다', () => {
    // 역산 169 vs 입력 500 — 오타일 가능성이 높다
    const warning = macroMismatchWarning({ kcal: 500, carb: 25, protein: 6, fat: 5 })

    expect(warning).toMatch(/169kcal/)
  })

  it('탄단지를 아예 안 넣었으면 비교할 수 없어 경고하지 않는다', () => {
    expect(macroMismatchWarning({ kcal: 180, carb: 0, protein: 0, fat: 0 })).toBeNull()
  })
})
