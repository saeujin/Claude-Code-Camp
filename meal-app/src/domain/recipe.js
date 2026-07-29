// F6 매칭 · 정렬 로직 — 계획서 3장
//
// 이 파일은 DOM·localStorage를 일절 참조하지 않는다. 순수 함수만 둔다.
// 매칭 순위가 이 기능의 신뢰도 전부이므로 UI 없이 테스트 가능해야 한다.

import { STAPLES } from '../../data/staples.js';
import { SYNONYMS } from '../../data/synonyms.js';

/** 점수 가중치 — 명세는 "가산점", "후순위"라고만 적었다. 아래 값은 이 구현에서 정한 것이며 조정 대상이다. */
export const SCORE = {
  matchRateWeight: 100,
  expiryBonusPerItem: 10,
  expiryBonusMax: 20,
  calorieOverPenalty: 30,
  calorieTolerance: 1.15,
  /** 잔여 칼로리가 0 이하일 때 쓰는 대체 기준 — "가벼운 요리부터" */
  lowCalBudget: 300,
};

/** 부족 재료가 이 수를 넘으면 목록에서 제외한다 (명세: 부족 1~2개까지만 노출). */
export const MAX_MISSING = 2;

/**
 * 최소 이만큼은 갖고 있어야 후보로 올린다.
 * 명세에 없는 구현 추가 — 보유 재료가 하나도 안 겹치는(0%) 레시피를 부족 2개라는
 * 이유로 노출하면 "만들 수 있는 요리"라는 목적에 어긋난다.
 */
export const MIN_MATCHED = 1;

/** 유통기한 임박 기준 (명세 F4). */
export const EXPIRY_SOON_DAYS = 3;

/* ── 정규화 ────────────────────────────────────────────────── */

const CANONICAL = buildCanonicalMap(SYNONYMS);
const STAPLE_SET = new Set(STAPLES.map((n) => normalize(n)));

function rawKey(name) {
  return String(name ?? '')
    .toLowerCase()
    .replace(/[\s·,.()\-_/]/g, '');
}

function buildCanonicalMap(synonyms) {
  const map = new Map();
  for (const [canonical, aliases] of Object.entries(synonyms)) {
    map.set(rawKey(canonical), rawKey(canonical));
    for (const alias of aliases) map.set(rawKey(alias), rawKey(canonical));
  }
  return map;
}

/** 공백·구분자를 지우고 동의어 사전으로 대표어를 찾는다. */
export function normalize(name) {
  const key = rawKey(name);
  return CANONICAL.get(key) ?? key;
}

/** isStaple 플래그를 우선하고, 없으면 화이트리스트로 판정한다. */
export function isStaple(ingredient) {
  if (typeof ingredient?.isStaple === 'boolean') return ingredient.isStaple;
  return STAPLE_SET.has(normalize(ingredient?.name));
}

/* ── 유통기한 ──────────────────────────────────────────────── */

/** 'YYYY-MM-DD' 두 개를 비교해 남은 일수를 돌려준다. 값이 없으면 null. */
export function daysUntil(dateStr, todayStr) {
  if (!dateStr || !todayStr) return null;
  const a = Date.parse(`${dateStr}T00:00:00Z`);
  const b = Date.parse(`${todayStr}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.round((a - b) / 86400000);
}

export function isExpiringSoon(ingredient, todayStr) {
  const d = daysUntil(ingredient?.expiresAt, todayStr);
  return d !== null && d <= EXPIRY_SOON_DAYS;
}

/* ── 매칭 ──────────────────────────────────────────────────── */

/**
 * 레시피 하나를 보유 재료와 대조한다.
 * 매칭률 = 보유한 필수 재료 수 ÷ 전체 필수 재료 수 (양념은 분모에서 제외).
 */
export function matchRecipe(recipe, ownedSet) {
  const essentials = (recipe.ingredients ?? []).filter((ing) => !isStaple(ing));
  const staples = (recipe.ingredients ?? []).filter((ing) => isStaple(ing));
  const matched = essentials.filter((ing) => ownedSet.has(normalize(ing.name)));
  const missing = essentials.filter((ing) => !ownedSet.has(normalize(ing.name)));
  return {
    essentials,
    staples,
    matched,
    missing,
    matchRate: essentials.length ? matched.length / essentials.length : 0,
  };
}

/**
 * 점수 = 매칭률×100 + 임박 재료 가산점 − 칼로리 초과 감점
 * 소수점 첫째 자리까지 남긴다 (2/3 → 66.7).
 */
export function scoreRecipe(match, { kcal, expiringSet, remaining = null, useCalorieFilter = false } = {}) {
  const expiryUsed = match.matched.filter((ing) => expiringSet?.has(normalize(ing.name))).length;
  const expiryBonus = Math.min(expiryUsed * SCORE.expiryBonusPerItem, SCORE.expiryBonusMax);

  let caloriePenalty = 0;
  if (useCalorieFilter) {
    // 잔여가 0 이하면 목표를 넘긴 상태다. 숨기지 않고 저칼로리 기준으로 바꿔 정렬한다.
    const budget = remaining !== null && remaining > 0 ? remaining : SCORE.lowCalBudget;
    if (Number(kcal) > budget * SCORE.calorieTolerance) caloriePenalty = -SCORE.calorieOverPenalty;
  }

  const raw = match.matchRate * SCORE.matchRateWeight + expiryBonus + caloriePenalty;
  return {
    score: Math.round(raw * 10) / 10,
    expiryUsed,
    expiryBonus,
    caloriePenalty,
  };
}

/**
 * 필터 → 점수 → 정렬을 한 번에.
 * 정렬: 점수 내림차순 → 부족 재료 수 오름차순 → 칼로리 오름차순
 */
export function rankRecipes(recipes, ingredients, options = {}) {
  const {
    pinnedIngredient = null,
    useCalorieFilter = false,
    remaining = null,
    today = null,
  } = options;

  const owned = ingredients ?? [];
  const ownedSet = new Set(owned.map((ing) => normalize(ing.name)));
  const expiringSet = new Set(
    owned.filter((ing) => isExpiringSoon(ing, today)).map((ing) => normalize(ing.name)),
  );
  const pinned = pinnedIngredient ? normalize(pinnedIngredient) : null;

  return (recipes ?? [])
    .map((recipe) => {
      const match = matchRecipe(recipe, ownedSet);
      const scored = scoreRecipe(match, {
        kcal: recipe.kcal,
        expiringSet,
        remaining,
        useCalorieFilter,
      });
      return {
        ...recipe,
        ...match,
        ...scored,
        matchPercent: Math.round(match.matchRate * 100),
        expiringNames: match.matched
          .filter((ing) => expiringSet.has(normalize(ing.name)))
          .map((ing) => ing.name),
      };
    })
    .filter((r) => !pinned || r.essentials.some((ing) => normalize(ing.name) === pinned))
    .filter((r) => r.missing.length <= MAX_MISSING)
    .filter((r) => r.matched.length >= MIN_MATCHED)
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.missing.length - b.missing.length ||
        a.kcal - b.kcal ||
        a.name.localeCompare(b.name, 'ko'),
    );
}
