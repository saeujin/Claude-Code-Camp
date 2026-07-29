/**
 * 저장소.
 *
 * 미결정 사항 #6(회원 인증 방식)이 정해지지 않았으므로 지금은 비로그인
 * localStorage로 구현한다. 화면은 `DietRepository` 인터페이스만 알고 있어서,
 * 나중에 서버 API 구현체로 갈아끼울 때 UI를 건드리지 않아도 된다.
 */

import type { Food, MealEntry, MealEntryDraft, Nutrition } from '../domain/types'
import { computeNutrition } from '../domain/nutrition'
import { SEED_FOODS } from './foods'

/** 개인 음식 등록 폼이 넘겨주는 값 */
export type CustomFoodDraft = {
  name: string
  per100g: Nutrition
  servingGram?: number
}

export type DietRepository = {
  /**
   * id로 음식 하나를 찾는다. 기본 DB와 개인 음식을 모두 본다.
   *
   * 목록 조회와 검색은 저장소에 두지 않았다. 개인 음식은 `listCustomFoods`로
   * 받아 화면에서 씨드와 합치고, 필터는 순수 함수 `filterFoodsByName`으로 한다 —
   * 저장소가 가변 상태를 감추고 있으면 화면의 `useMemo` 의존성을 정직하게 쓸 수 없다.
   */
  getFood(foodId: string): Food | undefined
  /** 개인 음식으로 등록하고 저장된 음식을 돌려준다 (명세 215줄) */
  addCustomFood(draft: CustomFoodDraft): Food
  listCustomFoods(): Food[]
  deleteCustomFood(foodId: string): void

  listEntries(): MealEntry[]
  /** 기록 시점의 이름·영양값을 스냅샷으로 굳혀 저장한다 */
  addEntry(draft: MealEntryDraft): MealEntry
  /** 섭취량·끼니·날짜를 바꾼다. 영양값 스냅샷은 현재 음식 기준으로 다시 환산한다 */
  updateEntry(entryId: string, patch: Partial<MealEntryDraft>): MealEntry
  deleteEntry(entryId: string): void
}

// ---------------------------------------------------------------------------
// localStorage 구현체
// ---------------------------------------------------------------------------

const ENTRIES_KEY = 'diet-app/meal-entries/v1'
const CUSTOM_FOODS_KEY = 'diet-app/custom-foods/v1'

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (raw === null) return fallback
    return JSON.parse(raw) as T
  } catch {
    // 값이 깨졌으면 빈 상태로 시작한다. 기록 하나 때문에 앱이 죽는 편이 더 나쁘다.
    console.warn(`저장된 데이터를 읽지 못해 초기화합니다: ${key}`)
    return fallback
  }
}

function writeJson(key: string, value: unknown): void {
  localStorage.setItem(key, JSON.stringify(value))
}

function newId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`
}

export function createLocalDietRepository(): DietRepository {
  let entries = readJson<MealEntry[]>(ENTRIES_KEY, [])
  let customFoods = readJson<Food[]>(CUSTOM_FOODS_KEY, [])

  function allFoods(): Food[] {
    // 개인 음식을 앞에 둔다. 직접 등록한 음식이 검색에서 먼저 잡히는 게 자연스럽다.
    return [...customFoods, ...SEED_FOODS]
  }

  function requireFood(foodId: string): Food {
    const food = allFoods().find((candidate) => candidate.id === foodId)
    if (!food) throw new Error(`음식을 찾을 수 없습니다: ${foodId}`)
    return food
  }

  function persistEntries(next: MealEntry[]): void {
    entries = next
    writeJson(ENTRIES_KEY, entries)
  }

  return {
    getFood(foodId) {
      return allFoods().find((food) => food.id === foodId)
    },

    addCustomFood(draft) {
      const food: Food = {
        id: newId('custom'),
        name: draft.name.trim(),
        per100g: draft.per100g,
        ...(draft.servingGram === undefined ? {} : { servingGram: draft.servingGram }),
        source: 'custom',
        // 등록 폼에 항목을 하나 더 늘리는 비용이 얻는 정확도보다 크다고 보고
        // role을 물어보지 않는다. 직접 등록한 음식은 끼니 후보로 취급한다.
        role: 'meal',
      }

      customFoods = [food, ...customFoods]
      writeJson(CUSTOM_FOODS_KEY, customFoods)
      return food
    },

    listCustomFoods() {
      return [...customFoods]
    },

    deleteCustomFood(foodId) {
      // 과거 기록은 스냅샷을 들고 있으므로 음식을 지워도 값이 변하지 않는다.
      customFoods = customFoods.filter((food) => food.id !== foodId)
      writeJson(CUSTOM_FOODS_KEY, customFoods)
    },

    listEntries() {
      return [...entries]
    },

    addEntry(draft) {
      const food = requireFood(draft.foodId)
      const entry: MealEntry = {
        id: newId('entry'),
        date: draft.date,
        slot: draft.slot,
        foodId: food.id,
        foodName: food.name,
        amount: draft.amount,
        nutrition: computeNutrition(food, draft.amount),
        createdAt: new Date().toISOString(),
      }

      persistEntries([...entries, entry])
      return entry
    },

    updateEntry(entryId, patch) {
      const current = entries.find((entry) => entry.id === entryId)
      if (!current) throw new Error(`기록을 찾을 수 없습니다: ${entryId}`)

      const foodId = patch.foodId ?? current.foodId
      const amount = patch.amount ?? current.amount
      const food = requireFood(foodId)

      const updated: MealEntry = {
        ...current,
        date: patch.date ?? current.date,
        slot: patch.slot ?? current.slot,
        foodId: food.id,
        foodName: food.name,
        amount,
        nutrition: computeNutrition(food, amount),
      }

      persistEntries(entries.map((entry) => (entry.id === entryId ? updated : entry)))
      return updated
    },

    deleteEntry(entryId) {
      persistEntries(entries.filter((entry) => entry.id !== entryId))
    },
  }
}
