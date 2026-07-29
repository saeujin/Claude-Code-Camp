// F6 재료 기반 레시피 추천.
// 계약 문서: .claude/skills/f6-recipes/SKILL.md
import { diffDays } from '../lib/date'
import { EXPIRY_SOON_DAYS } from './constants'
import type { DateKey, FridgeItem, Recipe, RecipeMatch } from './types'

/**
 * 재료명 대조는 정규화 후 완전 일치만 인정한다.
 * 부분 일치를 쓰면 '대파'와 '파', '닭가슴살'과 '닭'이 잘못 매칭된다.
 */
export function normalizeName(name: string): string {
  return name.replace(/\s+/g, '').toLowerCase()
}

export function isExpiringSoon(item: FridgeItem, today: DateKey): boolean {
  if (!item.expiresOn) return false
  const left = diffDays(today, item.expiresOn)
  return left >= 0 && left <= EXPIRY_SOON_DAYS
}

export interface MatchOptions {
  /** 잔여 칼로리 조건을 켜면 범위를 넘는 레시피를 후순위로 */
  remainingKcal?: number
  /** 반드시 쓰고 싶은 재료 */
  mustUse?: string[]
}

export function matchRecipes(
  recipes: readonly Recipe[],
  fridge: readonly FridgeItem[],
  today: DateKey,
  options: MatchOptions = {},
): RecipeMatch[] {
  const owned = new Map(fridge.map((i) => [normalizeName(i.name), i]))
  const mustUse = (options.mustUse ?? []).map(normalizeName)

  const matches = recipes.map<RecipeMatch>((recipe) => {
    // 조미료·기본 양념은 항상 보유한 것으로 간주해 제외한다 (명세 377행)
    const required = recipe.ingredients.filter((i) => !i.pantry)
    const ownedNames: string[] = []
    const missing: string[] = []
    const expiringNames: string[] = []

    for (const ing of required) {
      const item = owned.get(normalizeName(ing.name))
      if (item) {
        ownedNames.push(ing.name)
        if (isExpiringSoon(item, today)) expiringNames.push(ing.name)
      } else {
        missing.push(ing.name)
      }
    }

    const matchRate =
      required.length === 0 ? 100 : Math.round((ownedNames.length / required.length) * 100)

    return {
      recipe,
      matchRate,
      owned: ownedNames,
      missing,
      usesExpiring: expiringNames.length > 0,
      expiringNames,
    }
  })

  const filtered = mustUse.length
    ? matches.filter((m) =>
        mustUse.every((n) => m.recipe.ingredients.some((i) => normalizeName(i.name) === n)),
      )
    : matches

  const sorted = [...filtered].sort((a, b) => sortScore(b, options) - sortScore(a, options))

  // 매칭률 100%가 없으면 부족 재료 1~2개까지 포함해 보여준다 (명세 375행)
  const visible = sorted.filter((m) => m.missing.length <= 2)
  return visible.length > 0 ? visible : sorted.slice(0, 5)
}

function sortScore(m: RecipeMatch, options: MatchOptions): number {
  let s = m.matchRate
  // 유통기한 임박 재료를 쓰는 레시피에 가산점 (명세 366행)
  if (m.usesExpiring) s += 10
  if (options.remainingKcal !== undefined && m.recipe.kcal > options.remainingKcal) s -= 20
  return s
}
