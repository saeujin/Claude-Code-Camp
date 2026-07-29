import { describe, expect, it } from 'vitest'
import { calcAllTargets, calcBMR, calcMacros, calcTDEE } from './profile'
import type { Profile } from './types'

/**
 * 기준은 기능명세서 §F1의 계산 예시 ㉮·㉯다 (명세 146~180줄).
 * 이 두 예시가 재현되지 않으면 화면이 아무리 잘 나와도 숫자가 틀린 것이다.
 *
 * 출처: JMS 브랜치의 `lib/nutrition/calculate.test.ts`. 임포트 경로만 바꿨다.
 */

/** 계산 기준일 고정 — 목표 설정일과 같은 날로 두어 남은 기간 = 전체 기간이 되게 한다 */
const TODAY = new Date(2026, 0, 15)
const START = '2026-01-15'

/** 명세서 예시 ㉮ — 남 30세 175cm 75kg 사무직, 목표 70kg · 12주 */
const 감량_예시: Profile = {
  sex: 'male',
  age: 30,
  heightCm: 175,
  weightKg: 75,
  activityLevel: 'sedentary',
  dietGoal: 'lose',
  targetWeightKg: 70,
  goalDurationDays: 84, // 12주
  goalStartDate: START,
}

describe('명세서 계산 예시 ㉮ — 감량', () => {
  const t = calcAllTargets(감량_예시, { today: TODAY })

  it('BMR 1698.75 (반올림하지 않는다)', () => {
    expect(t.bmr).toBe(1698.75)
  })

  it('TDEE 2039 = round(1698.75 × 1.2)', () => {
    expect(t.tdee).toBe(2039)
  })

  it('일일 조정량 458 = round(5 × 7700 ÷ 84)', () => {
    expect(t.dailyAdjustmentKcal).toBe(458)
  })

  it('기본 목표 1581 — 단계별 반올림 결과 (1580이 아니다)', () => {
    expect(t.baseTargetCalories).toBe(1581)
    // 최종값만 반올림했다면 1580이 나온다. 명세서 값은 1581이다.
    expect(t.baseTargetCalories).not.toBe(1580)
  })

  it('주당 변화 속도 0.42 kg/주', () => {
    expect(t.weeklyRateKg).toBe(0.42)
  })

  it('탄수 158g · 단백 119g · 지방 53g', () => {
    expect(t.macros.carbsG).toBe(158)
    expect(t.macros.proteinG).toBe(119)
    expect(t.macros.fatG).toBe(53)
  })

  it('단백질 하한 90g은 계산값 119g보다 낮아 적용되지 않는다', () => {
    expect(t.macros.proteinFloorG).toBe(90)
    expect(t.macros.proteinFloorApplied).toBe(false)
  })

  it('목표 1581 < BMR 1699 — 안내는 띄우되 값은 올리지 않는다', () => {
    expect(t.notices).toContain('belowBmr')
    expect(t.baseTargetCalories).toBe(1581) // 1699로 보정되면 명세 위반
  })

  it('목표 달성 예정일 = 시작일 + 84일', () => {
    expect(t.targetDate).toBe('2026-04-09')
    expect(t.remainingDays).toBe(84)
  })
})

describe('명세서 계산 예시 ㉮ — 근력운동을 기록한 날', () => {
  const t = calcAllTargets(감량_예시, { today: TODAY, hasStrengthTraining: true })

  it('단백질 하한이 120g으로 올라가 적용된다', () => {
    expect(t.macros.proteinFloorG).toBe(120) // 75 × 1.6
    expect(t.macros.proteinFloorApplied).toBe(true)
    expect(t.macros.proteinG).toBe(120)
  })

  it('올린 1g만큼 탄수화물에서 뺀다 — 탄수 157g, 지방은 그대로 53g', () => {
    expect(t.macros.carbsG).toBe(157)
    expect(t.macros.fatG).toBe(53)
  })

  it('목표 칼로리 자체는 바뀌지 않는다', () => {
    expect(t.baseTargetCalories).toBe(1581)
  })
})

describe('명세서 계산 예시 ㉯ — 증량', () => {
  const t = calcAllTargets(
    { ...감량_예시, dietGoal: 'gain', targetWeightKg: 78, goalDurationDays: 112 },
    { today: TODAY },
  )

  it('일일 조정량 206 = round(3 × 7700 ÷ 112)', () => {
    expect(t.dailyAdjustmentKcal).toBe(206)
  })

  it('기본 목표 2245 = 2039 + 206', () => {
    expect(t.baseTargetCalories).toBe(2245)
  })

  it('주당 변화 속도 0.19 kg/주', () => {
    expect(t.weeklyRateKg).toBe(0.19)
  })

  it('목표가 BMR을 넘으므로 belowBmr 안내가 없다', () => {
    expect(t.notices).not.toContain('belowBmr')
  })
})

describe('BMR 공식', () => {
  it('여성은 −161을 적용한다', () => {
    expect(calcBMR({ sex: 'female', weightKg: 75, heightCm: 175, age: 30 })).toBe(1532.75)
  })

  it('남성은 +5를 적용한다', () => {
    expect(calcBMR({ sex: 'male', weightKg: 75, heightCm: 175, age: 30 })).toBe(1698.75)
  })
})

describe('활동계수 4단계', () => {
  const bmr = 1698.75
  it.each([
    ['sedentary', 2039],
    ['light', 2336],
    ['active', 2633],
    ['veryActive', 2930],
  ] as const)('%s → %i kcal', (level, expected) => {
    expect(calcTDEE(bmr, level)).toBe(expected)
  })
})

describe('값을 보정하지 않는다 (명세서 §F1 ③)', () => {
  it('기간이 극단적으로 짧으면 목표가 음수로 나오고, 그 값을 그대로 반환한다', () => {
    const t = calcAllTargets(
      { ...감량_예시, goalDurationDays: 7 }, // 5kg을 1주만에
      { today: TODAY },
    )
    // round(5 × 7700 ÷ 7) = 5500 → 2039 − 5500 = −3461
    expect(t.dailyAdjustmentKcal).toBe(5500)
    expect(t.baseTargetCalories).toBe(-3461)
    expect(t.notices).toContain('nonPositiveTarget')
    expect(t.notices).toContain('belowBmr')
  })

  it('목표가 음수여도 0으로 올리지 않는다', () => {
    const t = calcAllTargets({ ...감량_예시, goalDurationDays: 7 }, { today: TODAY })
    expect(t.baseTargetCalories).toBeLessThan(0)
  })
})

describe('목표 체중 = 현재 체중', () => {
  const t = calcAllTargets(
    { ...감량_예시, targetWeightKg: 75 },
    { today: TODAY },
  )

  it('다이어트를 골랐어도 유지로 처리한다', () => {
    expect(t.effectiveGoal).toBe('maintain')
    expect(t.notices).toContain('goalWeightEqualsCurrent')
  })

  it('일일 조정량 0, 목표 = TDEE', () => {
    expect(t.dailyAdjustmentKcal).toBe(0)
    expect(t.baseTargetCalories).toBe(2039)
  })
})

describe('유지 목표', () => {
  const t = calcAllTargets(
    {
      ...감량_예시,
      dietGoal: 'maintain',
      targetWeightKg: null,
      goalDurationDays: null,
    },
    { today: TODAY },
  )

  it('목표 = TDEE, 목표 체중·기간 관련 값은 null', () => {
    expect(t.baseTargetCalories).toBe(2039)
    expect(t.weeklyRateKg).toBeNull()
    expect(t.targetDate).toBeNull()
    expect(t.remainingDays).toBeNull()
  })

  it('유지 비율 50:20:30을 쓴다', () => {
    expect(t.macros.carbsG).toBe(255) // round(2039 × 0.5 ÷ 4) = round(254.875)
    expect(t.macros.proteinG).toBe(102) // round(2039 × 0.2 ÷ 4) = round(101.95)
    expect(t.macros.fatG).toBe(68) // round(2039 × 0.3 ÷ 9) = round(67.97)
  })
})

describe('몸무게 갱신 — 남은 기간으로 다시 나눈다 (명세서 §F1 예외)', () => {
  // 시작 42일 뒤(절반 경과) 체중이 75 → 73kg으로 줄었다.
  const 절반경과 = new Date(2026, 1, 26) // 2026-02-26 = START + 42일

  const t = calcAllTargets({ ...감량_예시, weightKg: 73 }, { today: 절반경과 })

  it('남은 기간은 42일이다', () => {
    expect(t.remainingDays).toBe(42)
  })

  it('남은 변화량 3kg ÷ 남은 42일로 조정량을 재계산한다', () => {
    // round(3 × 7700 ÷ 42) = 550
    expect(t.dailyAdjustmentKcal).toBe(550)
  })

  it('목표 체중·기간 자체는 그대로다', () => {
    expect(t.targetDate).toBe('2026-04-09')
  })

  it('줄어든 체중으로 BMR·TDEE도 다시 계산된다', () => {
    expect(t.bmr).toBe(1678.75) // 10×73 + 6.25×175 − 150 + 5
    expect(t.tdee).toBe(2015) // round(1678.75 × 1.2) = round(2014.5)
    expect(t.baseTargetCalories).toBe(1465) // 2015 − 550
  })
})

describe('목표 기간 경과', () => {
  const 기간후 = new Date(2026, 3, 20) // 2026-04-20, 목표일 2026-04-09 이후

  const t = calcAllTargets(감량_예시, { today: 기간후 })

  it('남은 기간 0, goalPeriodEnded 안내', () => {
    expect(t.remainingDays).toBe(0)
    expect(t.notices).toContain('goalPeriodEnded')
  })

  it('0으로 나누지 않고 값을 반환한다', () => {
    expect(Number.isFinite(t.dailyAdjustmentKcal)).toBe(true)
    expect(t.dailyAdjustmentKcal).toBe(458) // 원래 기간 84일로 고정
    expect(t.baseTargetCalories).toBe(1581)
  })
})

describe('단백질 하한이 목표 칼로리를 초과하는 극단 사례', () => {
  it('탄수화물을 0에서 멈추고 사실을 알린다', () => {
    const { macros, notices } = calcMacros({
      targetCalories: 500,
      goal: 'lose',
      weightKg: 100,
      hasStrengthTraining: true,
    })
    // 하한 160g > 계산값 38g → 부족분 122g을 탄수 50g에서 빼면 음수
    expect(macros.proteinG).toBe(160)
    expect(macros.carbsG).toBe(0)
    expect(notices).toContain('proteinFloorExceedsBudget')
  })
})
