// 시나리오 S4·S5·S6를 도메인 수준에서 고정한다.
import { describe, expect, it } from 'vitest'
import { FOODS, RECIPES } from '../../data'
import { addDays, addWeeks } from '../../lib/date'
import { matchRecipes } from '../recipes'
import { remainingMealSlots, suggestMeals } from '../suggest'
import { summarizeDay } from '../summary'
import type { ExerciseEntry, FridgeItem, MealEntry, Profile } from '../types'

const TODAY = '2026-07-29'

const profile: Profile = {
  userId: 'u1',
  sex: 'male',
  age: 30,
  heightCm: 175,
  weightKg: 75,
  activityLevel: 1.2,
  goal: 'lose',
  targetWeightKg: 70,
  targetDate: addWeeks(TODAY, 12),
  startedOn: TODAY,
  startWeightKg: 75,
}

const breakfast: MealEntry = {
  id: 'm1',
  userId: 'u1',
  date: TODAY,
  slot: 'breakfast',
  foodName: '삶은 달걀 + 토스트',
  amountG: 180,
  nutrition: { kcal: 420, carbG: 37.1, proteinG: 18.2, fatG: 21.4 },
  createdAt: '',
}

const jog: ExerciseEntry = {
  id: 'e1',
  userId: 'u1',
  date: TODAY,
  time: '07:10',
  name: '조깅 (8km/h)',
  source: 'met',
  met: 8.3,
  minutes: 30,
  kcal: 311,
  kind: 'cardio',
  weightSnapshotKg: 75,
  createdAt: '',
}

describe('S3 — 운동 기록이 오늘 목표를 늘린다', () => {
  it('기본 1581 + 운동 311 = 오늘 목표 1892, 잔여 1472', () => {
    const { summary, plan } = summarizeDay({
      date: TODAY,
      profile,
      meals: [breakfast],
      exercises: [jog],
    })
    expect(plan?.baseTarget).toBe(1581)
    expect(summary?.exerciseBurn).toBe(311)
    expect(summary?.todayTarget).toBe(1892)
    expect(summary?.remaining).toBe(1472)
  })

  it('운동 전에는 잔여가 1161이다 (S2)', () => {
    const { summary } = summarizeDay({
      date: TODAY,
      profile,
      meals: [breakfast],
      exercises: [],
    })
    expect(summary?.todayTarget).toBe(1581)
    expect(summary?.remaining).toBe(1161)
  })

  it('근력운동을 기록하면 단백질 목표가 119 → 120으로 오른다', () => {
    const weights: ExerciseEntry = {
      ...jog,
      id: 'e2',
      name: '웨이트 (보통 강도)',
      met: 3.5,
      minutes: 40,
      kcal: 175,
      kind: 'strength',
    }
    const before = summarizeDay({ date: TODAY, profile, meals: [], exercises: [] })
    const after = summarizeDay({ date: TODAY, profile, meals: [], exercises: [weights] })
    expect(before.summary?.targetMacros.proteinG).toBe(119)
    expect(after.summary?.targetMacros.proteinG).toBe(120)
    expect(after.summary?.targetMacros.carbG).toBe(157)
  })

  it('프로필이 없으면 목표·잔여를 만들지 않는다 (0으로 표시하지 않기 위해)', () => {
    const r = summarizeDay({ date: TODAY, profile: null, meals: [breakfast], exercises: [jog] })
    expect(r.plan).toBeNull()
    expect(r.summary).toBeNull()
    expect(r.consumedKcal).toBe(420)
    expect(r.exerciseBurn).toBe(311)
  })
})

describe('S4 — 점심 추천', () => {
  const { summary } = summarizeDay({
    date: TODAY,
    profile,
    meals: [breakfast],
    exercises: [jog],
  })

  it('남은 끼니는 점심·저녁·간식 세 끼', () => {
    expect(remainingMealSlots(['breakfast'], 12)).toEqual(['lunch', 'dinner', 'snack'])
  })

  it('잔여 1472를 3끼로 나눠 점심 몫 491', () => {
    const r = suggestMeals(summary!, FOODS, remainingMealSlots(['breakfast'], 12))
    expect(r.mode).toBe('normal')
    expect(r.perMealKcal).toBe(491)
  })

  it('가장 부족한 영양소는 단백질 101g', () => {
    const r = suggestMeals(summary!, FOODS, remainingMealSlots(['breakfast'], 12))
    expect(r.topGap?.label).toBe('단백질')
    expect(Math.round(r.topGap!.amount)).toBe(101)
  })

  it('닭가슴살 샐러드가 최상단에 온다', () => {
    const r = suggestMeals(summary!, FOODS, remainingMealSlots(['breakfast'], 12))
    expect(r.items[0].food.name).toBe('닭가슴살 샐러드')
    expect(r.items[0].nutrition.kcal).toBe(520)
    expect(Math.round(r.items[0].nutrition.proteinG)).toBe(45)
  })

  it('잔여가 음수면 추천 대신 저칼로리 음식만 (명세 347행)', () => {
    const over = summarizeDay({
      date: TODAY,
      profile,
      meals: [{ ...breakfast, nutrition: { ...breakfast.nutrition, kcal: 3000 } }],
      exercises: [],
    })
    const r = suggestMeals(over.summary!, FOODS, ['dinner'])
    expect(r.mode).toBe('over')
    expect(r.items.every((i) => i.nutrition.kcal <= 200)).toBe(true)
  })

  it('남은 끼니가 없으면 배분하지 않는다', () => {
    const r = suggestMeals(summary!, FOODS, [])
    expect(r.mode).toBe('done')
    expect(r.perMealKcal).toBe(0)
  })
})

describe('S5·S6 — 냉장고와 레시피', () => {
  const fridge: FridgeItem[] = [
    { id: '1', userId: 'u1', name: '양파', quantity: 2, unit: '개', purchasedOn: TODAY, expiresOn: null },
    { id: '2', userId: 'u1', name: '계란', quantity: 10, unit: '개', purchasedOn: TODAY, expiresOn: addDays(TODAY, 14) },
    { id: '3', userId: 'u1', name: '두부', quantity: 1, unit: '모', purchasedOn: TODAY, expiresOn: addDays(TODAY, 3) },
    { id: '4', userId: 'u1', name: '대파', quantity: 1, unit: '단', purchasedOn: TODAY, expiresOn: null },
    { id: '5', userId: 'u1', name: '닭가슴살', quantity: 2, unit: '팩', purchasedOn: TODAY, expiresOn: null },
  ]

  it('두부 계란찜이 매칭률 100%로 최상단', () => {
    const matches = matchRecipes(RECIPES, fridge, TODAY)
    expect(matches[0].recipe.name).toBe('두부 계란찜')
    expect(matches[0].matchRate).toBe(100)
    expect(matches[0].recipe.kcal).toBe(210)
    expect(matches[0].usesExpiring).toBe(true)
    expect(matches[0].expiringNames).toEqual(['두부'])
  })

  it('닭가슴살 볶음은 75%, 부족한 재료는 파프리카', () => {
    const matches = matchRecipes(RECIPES, fridge, TODAY)
    const m = matches.find((x) => x.recipe.name === '닭가슴살 볶음')
    expect(m?.matchRate).toBe(75)
    expect(m?.missing).toEqual(['파프리카'])
  })

  it('조미료는 매칭률 계산에서 제외한다 (명세 377행)', () => {
    const m = matchRecipes(RECIPES, fridge, TODAY).find(
      (x) => x.recipe.name === '두부 계란찜',
    )!
    // 소금·참기름은 필요 재료로 세지 않는다
    expect(m.owned.length + m.missing.length).toBe(3)
  })

  it('부족 재료가 3개 이상인 레시피는 목록에서 빠진다', () => {
    const matches = matchRecipes(RECIPES, fridge, TODAY)
    expect(matches.every((m) => m.missing.length <= 2)).toBe(true)
  })

  it('부족 재료 2개 이하인 후보조차 없으면 상위 5개만 보여준다', () => {
    const heavy = RECIPES.filter((r) => r.ingredients.filter((i) => !i.pantry).length >= 3)
    const matches = matchRecipes(heavy, [], TODAY)
    expect(matches.length).toBe(5)
    expect(matches.every((m) => m.matchRate === 0)).toBe(true)
  })

  it('S6 — 저녁까지 먹으면 442 kcal 부족', () => {
    const dinner: MealEntry = {
      ...breakfast,
      id: 'm3',
      slot: 'dinner',
      foodName: '두부 계란찜 + 현미밥',
      nutrition: { kcal: 510, carbG: 69, proteinG: 25, fatG: 15 },
    }
    const lunch: MealEntry = {
      ...breakfast,
      id: 'm2',
      slot: 'lunch',
      foodName: '닭가슴살 샐러드',
      nutrition: { kcal: 520, carbG: 16, proteinG: 45, fatG: 26 },
    }
    const { summary } = summarizeDay({
      date: TODAY,
      profile,
      meals: [breakfast, lunch, dinner],
      exercises: [jog],
    })
    expect(summary?.consumed.kcal).toBe(1450)
    expect(summary?.remaining).toBe(442)
    // 섭취 1450은 BMR 1699보다 적다 — 부족 안내 조건
    expect(summary!.consumed.kcal).toBeLessThan(1699)
  })
})
