import type { Food, MetItem, Recipe } from '../domain/types'
import foodsJson from './foods.json'
import metJson from './met.json'
import recipesJson from './recipes.json'

export const FOODS = foodsJson as Food[]
export const MET_ITEMS = metJson as MetItem[]
export const RECIPES = recipesJson as Recipe[]

export function findMet(id: string): MetItem | undefined {
  return MET_ITEMS.find((m) => m.id === id)
}

export function searchFoods(query: string, extra: readonly Food[] = []): Food[] {
  const q = query.trim().toLowerCase()
  const all = [...extra, ...FOODS]
  if (!q) return all.slice(0, 30)
  return all.filter((f) => f.name.toLowerCase().includes(q)).slice(0, 30)
}

/** 목록에 없는 운동에 MET를 지어내지 않는다. 이름이 비슷한 후보만 제시한다 */
export function suggestMetCandidates(query: string): MetItem[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  return MET_ITEMS.filter((m) => m.name.toLowerCase().includes(q)).slice(0, 3)
}
