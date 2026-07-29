// 명세서의 계산 예시를 그대로 고정한다.
// 이 값들이 흔들리면 F1~F7의 모든 화면 숫자가 어긋난다.
// 출처: 기능명세서.md 146~180행(계산 예시 ㉮㉯), 439~496행(S3~S6)
import { describe, expect, it } from 'vitest'
import { addDays, addWeeks, diffDays, formatPeriod } from '../../lib/date'
import {
  buildGoalPlan,
  calcBMR,
  calcBaseTarget,
  calcDailyAdjustment,
  calcExerciseBurn,
  calcGoalDays,
  calcMacros,
  calcProteinFloor,
  calcRemaining,
  calcTDEE,
  calcTodayTarget,
  calcWeeklyRate,
  distributeRemaining,
  scaleNutrition,
} from '../calc'
import type { Profile } from '../types'

// 기준 인물 — 남 / 30세 / 175cm / 75kg / 사무직(1.2)
const STARTED_ON = '2026-07-29'
const TARGET_DATE_12W = addWeeks(STARTED_ON, 12)

const baseProfile: Profile = {
  userId: 'u1',
  sex: 'male',
  age: 30,
  heightCm: 175,
  weightKg: 75,
  activityLevel: 1.2,
  goal: 'lose',
  targetWeightKg: 70,
  targetDate: TARGET_DATE_12W,
  startedOn: STARTED_ON,
  startWeightKg: 75,
}

describe('F1 — BMR·TDEE·기본 목표', () => {
  it('BMR은 Mifflin-St Jeor로 1698.75, 표시값 1699', () => {
    const raw = calcBMR('male', 75, 175, 30)
    expect(raw).toBe(1698.75)
    expect(Math.round(raw)).toBe(1699)
  })

  it('여성 공식은 −161을 쓴다', () => {
    expect(calcBMR('female', 75, 175, 30)).toBe(1698.75 - 5 - 161)
  })

  it('TDEE는 반올림 전 BMR에 활동계수를 곱한다', () => {
    expect(calcTDEE(1698.75, 1.2)).toBe(2039)
  })

  it('12주는 84일', () => {
    expect(calcGoalDays(STARTED_ON, TARGET_DATE_12W)).toBe(84)
  })

  it('5kg / 84일 → 일일 조정량 458', () => {
    expect(calcDailyAdjustment(75, 70, 84)).toBe(458)
  })

  it('감량 기본 목표 = 2039 − 458 = 1581 (단계적 반올림)', () => {
    expect(calcBaseTarget(2039, 458, 'lose')).toBe(1581)
  })

  it('실수로 이어 계산하면 1580이 되어 명세와 어긋난다', () => {
    // 이 테스트는 반올림 규칙이 왜 필요한지 못박아둔다
    expect(Math.round(1698.75 * 1.2 - (5 * 7700) / 84)).toBe(1580)
  })

  it('주당 변화 속도 5kg / 84일 → 0.42', () => {
    expect(calcWeeklyRate(5, 84)).toBe(0.42)
  })

  it('증량 78kg / 16주 → 조정량 206, 기본 목표 2245, 0.19kg/주', () => {
    const days = calcGoalDays(STARTED_ON, addWeeks(STARTED_ON, 16))
    expect(days).toBe(112)
    expect(calcDailyAdjustment(75, 78, days)).toBe(206)
    expect(calcBaseTarget(2039, 206, 'gain')).toBe(2245)
    expect(calcWeeklyRate(3, days)).toBe(0.19)
  })

  it('유지 목표는 TDEE 그대로', () => {
    expect(calcBaseTarget(2039, 0, 'maintain')).toBe(2039)
  })
})

describe('F1 — 탄단지와 단백질 하한', () => {
  it('근력운동 없는 날: 탄 158 / 단 119 / 지 53', () => {
    expect(calcMacros(1581, 'lose', 75, false)).toEqual({
      carbG: 158,
      proteinG: 119,
      fatG: 53,
    })
  })

  it('근력운동한 날: 하한 120g이 적용되고 부족분 1g을 탄수에서 뺀다', () => {
    expect(calcMacros(1581, 'lose', 75, true)).toEqual({
      carbG: 157,
      proteinG: 120,
      fatG: 53,
    })
  })

  it('단백질 하한은 체중 × 1.2g, 근력일은 × 1.6g', () => {
    expect(calcProteinFloor(75, false)).toBe(90)
    expect(calcProteinFloor(75, true)).toBe(120)
  })
})

describe('F3 — 운동 소모와 오늘 목표', () => {
  it('조깅 30분 (MET 8.3, 75kg) → 311 kcal', () => {
    expect(calcExerciseBurn(8.3, 75, 30)).toBe(311)
  })

  it('오늘 목표 = 1581 + 311 = 1892', () => {
    expect(calcTodayTarget(1581, 311)).toBe(1892)
  })

  it('운동 소모 100% 반영 — 미결정 #8', () => {
    expect(calcTodayTarget(1581, 500)).toBe(2081)
  })
})

describe('F2·F5 — 잔여와 끼니 배분', () => {
  it('S2 — 1581 − 420 = 1161', () => {
    expect(calcRemaining(1581, 420)).toBe(1161)
  })

  it('S3 — 1892 − 420 = 1472', () => {
    expect(calcRemaining(1892, 420)).toBe(1472)
  })

  it('S4 — 1472를 3끼로 나누면 약 491', () => {
    expect(distributeRemaining(1472, 3)).toBe(491)
  })

  it('S6 — 1892 − 1450 = 442 부족', () => {
    expect(calcRemaining(1892, 1450)).toBe(442)
  })

  it('잔여는 음수가 될 수 있다', () => {
    expect(calcRemaining(1581, 2000)).toBe(-419)
  })

  it('남은 끼니가 0이면 0으로 나누지 않는다', () => {
    expect(distributeRemaining(1000, 0)).toBe(0)
  })
})

describe('buildGoalPlan — S1 전체', () => {
  it('기준 인물의 계획을 명세대로 만든다', () => {
    const plan = buildGoalPlan(baseProfile, STARTED_ON)
    expect(plan.bmr).toBe(1699)
    expect(plan.tdee).toBe(2039)
    expect(plan.dailyAdjustment).toBe(458)
    expect(plan.baseTarget).toBe(1581)
    expect(plan.weeklyRateKg).toBe(0.42)
    expect(plan.macros).toEqual({ carbG: 158, proteinG: 119, fatG: 53 })
    expect(plan.belowBmr).toBe(true)
    expect(plan.expired).toBe(false)
    expect(plan.daysRemaining).toBe(84)
  })

  it('근력운동한 날은 목표 탄단지가 바뀐다', () => {
    const plan = buildGoalPlan(baseProfile, STARTED_ON, true)
    expect(plan.macros).toEqual({ carbG: 157, proteinG: 120, fatG: 53 })
  })

  it('오늘 목표 1892는 BMR 1699를 넘는다 — S3의 경고 해제 조건', () => {
    const plan = buildGoalPlan(baseProfile, STARTED_ON)
    expect(calcTodayTarget(plan.baseTarget, 311)).toBeGreaterThan(plan.bmr)
  })

  it('목표 체중 = 현재 체중이면 조정량 0 (명세 194행)', () => {
    const plan = buildGoalPlan({ ...baseProfile, targetWeightKg: 75 }, STARTED_ON)
    expect(plan.dailyAdjustment).toBe(0)
    expect(plan.baseTarget).toBe(2039)
  })

  it('기간이 짧아 목표가 0 이하여도 값을 올리지 않는다 (명세 195행)', () => {
    const plan = buildGoalPlan(
      { ...baseProfile, targetDate: addDays(STARTED_ON, 1) },
      STARTED_ON,
    )
    expect(plan.baseTarget).toBeLessThan(0)
  })

  it('체중을 갱신하면 남은 변화량 ÷ 남은 기간으로 다시 계산한다 (명세 196행)', () => {
    const later = addDays(STARTED_ON, 28) // 4주 경과, 56일 남음
    const plan = buildGoalPlan({ ...baseProfile, weightKg: 73 }, later)
    // 남은 3kg ÷ 56일 → round(3 × 7700 / 56) = 413
    expect(plan.dailyAdjustment).toBe(413)
    expect(plan.daysRemaining).toBe(56)
  })

  it('기간이 지나면 마지막 기본 목표를 유지한다 (명세 197행)', () => {
    const after = addDays(TARGET_DATE_12W, 5)
    const plan = buildGoalPlan(baseProfile, after)
    expect(plan.expired).toBe(true)
    expect(plan.dailyAdjustment).toBe(458)
    expect(plan.baseTarget).toBe(1581)
  })

  it('유지 목표는 목표 체중·기간 없이 TDEE를 그대로 쓴다', () => {
    const plan = buildGoalPlan(
      { ...baseProfile, goal: 'maintain', targetWeightKg: null, targetDate: null },
      STARTED_ON,
    )
    expect(plan.baseTarget).toBe(2039)
    expect(plan.belowBmr).toBe(false)
  })
})

describe('날짜 유틸', () => {
  it('S6 — 하루 지나면 남은 기간이 11주 6일', () => {
    const today = addDays(STARTED_ON, 1)
    expect(formatPeriod(diffDays(today, TARGET_DATE_12W))).toBe('11주 6일')
  })

  it('12주는 84일, 정확히 나누어떨어지면 주만 표시', () => {
    expect(formatPeriod(84)).toBe('12주')
    expect(formatPeriod(6)).toBe('6일')
    expect(formatPeriod(0)).toBe('0일')
  })
})

describe('섭취량 환산', () => {
  it('S2 — 삶은 달걀 2개(100g) + 토스트 2장(80g) = 420 kcal, 단백질 18g', () => {
    const egg = scaleNutrition(
      { kcal: 155, carbG: 1.1, proteinG: 12.6, fatG: 10.6 },
      100,
    )
    const toast = scaleNutrition(
      { kcal: 331, carbG: 45.0, proteinG: 7.0, fatG: 13.5 },
      80,
    )
    expect(egg.kcal + toast.kcal).toBe(420)
    expect(Math.round(egg.proteinG + toast.proteinG)).toBe(18)
  })

  it('S4 — 닭가슴살 샐러드 400g = 520 kcal, 단백질 45g', () => {
    const n = scaleNutrition({ kcal: 130, carbG: 4.0, proteinG: 11.3, fatG: 6.5 }, 400)
    expect(n.kcal).toBe(520)
    expect(Math.round(n.proteinG)).toBe(45)
  })

  it('S6 — 두부 계란찜 200g(210) + 현미밥 200g(300) = 510 kcal', () => {
    const jjim = scaleNutrition({ kcal: 105, carbG: 2.5, proteinG: 9.5, fatG: 6.5 }, 200)
    const rice = scaleNutrition({ kcal: 150, carbG: 32.0, proteinG: 3.0, fatG: 1.0 }, 200)
    expect(jjim.kcal).toBe(210)
    expect(rice.kcal).toBe(300)
    expect(jjim.kcal + rice.kcal).toBe(510)
  })
})
