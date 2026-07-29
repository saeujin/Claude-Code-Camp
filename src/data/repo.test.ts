/**
 * 저장소 통합 테스트.
 *
 * 여기서 확인하려는 핵심은 **스냅샷 동작**이다. 기록은 저장 시점의 이름·영양값을
 * 자체 보유하므로, 개인 음식을 나중에 수정·삭제해도 과거 기록의 칼로리가 흔들리지
 * 않아야 한다.
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { createLocalDietRepository, type DietRepository } from './repo'
import { summarizeDay } from '../domain/nutrition'

const DATE = '2026-07-29'

describe('createLocalDietRepository', () => {
  let repo: DietRepository

  beforeEach(() => {
    // setup.ts가 매 테스트 뒤 localStorage를 비운다
    repo = createLocalDietRepository()
  })

  it('빈 상태로 시작한다', () => {
    expect(repo.listEntries()).toEqual([])
    expect(repo.listCustomFoods()).toEqual([])
  })

  it('기록을 추가하면 환산된 영양값이 스냅샷으로 저장된다', () => {
    // 쌀밥 1인분 = 210g, 100g당 143kcal → 300.3kcal
    const entry = repo.addEntry({
      date: DATE,
      slot: 'breakfast',
      foodId: 'seed-rice-white',
      amount: { unit: 'serving', value: 1 },
    })

    expect(entry.foodName).toBe('쌀밥')
    expect(entry.nutrition.kcal).toBeCloseTo(300.3)
    expect(repo.listEntries()).toHaveLength(1)
  })

  it('없는 음식으로 기록하면 던진다', () => {
    expect(() =>
      repo.addEntry({
        date: DATE,
        slot: 'lunch',
        foodId: 'nope',
        amount: { unit: 'g', value: 100 },
      }),
    ).toThrow(/음식을 찾을 수 없습니다/)
  })

  it('섭취량을 수정하면 영양값을 다시 환산한다', () => {
    const entry = repo.addEntry({
      date: DATE,
      slot: 'breakfast',
      foodId: 'seed-rice-white',
      amount: { unit: 'serving', value: 1 },
    })

    const updated = repo.updateEntry(entry.id, { amount: { unit: 'serving', value: 0.5 } })

    expect(updated.nutrition.kcal).toBeCloseTo(entry.nutrition.kcal / 2)
    expect(repo.listEntries()).toHaveLength(1)
  })

  it('끼니와 날짜만 바꿔도 기록이 유지된다', () => {
    const entry = repo.addEntry({
      date: DATE,
      slot: 'breakfast',
      foodId: 'seed-banana',
      amount: { unit: 'serving', value: 1 },
    })

    const updated = repo.updateEntry(entry.id, { slot: 'snack', date: '2026-07-28' })

    expect(updated.slot).toBe('snack')
    expect(updated.date).toBe('2026-07-28')
    expect(updated.nutrition.kcal).toBeCloseTo(entry.nutrition.kcal)
  })

  it('없는 기록을 수정하면 던진다', () => {
    expect(() => repo.updateEntry('nope', { slot: 'lunch' })).toThrow(/기록을 찾을 수 없습니다/)
  })

  it('삭제하면 목록에서 빠지고 누적이 줄어든다', () => {
    const a = repo.addEntry({
      date: DATE,
      slot: 'breakfast',
      foodId: 'seed-rice-white',
      amount: { unit: 'serving', value: 1 },
    })
    repo.addEntry({
      date: DATE,
      slot: 'lunch',
      foodId: 'seed-banana',
      amount: { unit: 'serving', value: 1 },
    })

    const before = summarizeDay(repo.listEntries(), DATE).total.kcal
    repo.deleteEntry(a.id)
    const after = summarizeDay(repo.listEntries(), DATE).total.kcal

    expect(repo.listEntries()).toHaveLength(1)
    expect(before - after).toBeCloseTo(a.nutrition.kcal)
  })

  describe('개인 음식 (명세 215줄)', () => {
    const draft = {
      name: '  엄마 김치볶음밥  ',
      per100g: { kcal: 180, carb: 25, protein: 6, fat: 5 },
      servingGram: 350,
    }

    it('등록하면 이름을 다듬어 저장하고 재사용할 수 있다', () => {
      const food = repo.addCustomFood(draft)

      expect(food.name).toBe('엄마 김치볶음밥')
      expect(food.source).toBe('custom')
      expect(repo.getFood(food.id)).toEqual(food)
      expect(repo.listCustomFoods()).toHaveLength(1)
    })

    it('등록한 음식으로 곧바로 기록할 수 있다', () => {
      const food = repo.addCustomFood(draft)
      const entry = repo.addEntry({
        date: DATE,
        slot: 'lunch',
        foodId: food.id,
        amount: { unit: 'serving', value: 1 },
      })

      // 350g × 1.8kcal/g = 630kcal
      expect(entry.nutrition.kcal).toBeCloseTo(630)
    })

    it('1인분 중량을 안 넣으면 servingGram이 없다', () => {
      const food = repo.addCustomFood({ name: '참기름', per100g: draft.per100g })
      expect(food.servingGram).toBeUndefined()
    })

    it('음식을 삭제해도 과거 기록의 값은 그대로다 — 스냅샷이므로', () => {
      const food = repo.addCustomFood(draft)
      const entry = repo.addEntry({
        date: DATE,
        slot: 'lunch',
        foodId: food.id,
        amount: { unit: 'serving', value: 1 },
      })

      repo.deleteCustomFood(food.id)

      const kept = repo.listEntries()[0]
      expect(repo.getFood(food.id)).toBeUndefined()
      expect(kept?.foodName).toBe('엄마 김치볶음밥')
      expect(kept?.nutrition.kcal).toBeCloseTo(entry.nutrition.kcal)
      expect(summarizeDay(repo.listEntries(), DATE).total.kcal).toBeCloseTo(630)
    })
  })

  it('localStorage에 남아 새 저장소 인스턴스에서도 읽힌다', () => {
    const food = repo.addCustomFood({
      name: '두부조림',
      per100g: { kcal: 120, carb: 5, protein: 10, fat: 6 },
    })
    repo.addEntry({
      date: DATE,
      slot: 'dinner',
      foodId: food.id,
      amount: { unit: 'g', value: 200 },
    })

    // 새로고침 상황을 재현한다 — 같은 localStorage에서 저장소를 다시 만든다
    const reopened = createLocalDietRepository()

    expect(reopened.listCustomFoods()).toHaveLength(1)
    expect(reopened.listEntries()).toHaveLength(1)
    expect(summarizeDay(reopened.listEntries(), DATE).total.kcal).toBeCloseTo(240)
  })

  it('저장된 값이 깨져 있으면 빈 상태로 시작한다', () => {
    localStorage.setItem('diet-app/meal-entries/v1', '{{{ 깨진 JSON')

    expect(() => createLocalDietRepository()).not.toThrow()
    expect(createLocalDietRepository().listEntries()).toEqual([])
  })

  it('목표를 초과하는 양도 막지 않는다 (명세 225줄)', () => {
    const entry = repo.addEntry({
      date: DATE,
      slot: 'dinner',
      foodId: 'seed-fried-chicken',
      amount: { unit: 'serving', value: 2 },
    })

    expect(entry.nutrition.kcal).toBeGreaterThan(1000)
  })
})
