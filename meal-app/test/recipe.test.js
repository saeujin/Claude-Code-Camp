// F6 단위 테스트 — 계획서 3.3 · 3.4의 검증 케이스
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { RECIPES } from '../data/recipes.js';
import {
  isStaple,
  matchRecipe,
  MAX_MISSING,
  normalize,
  rankRecipes,
  SCORE,
} from '../src/domain/recipe.js';

const TODAY = '2026-07-29';

/** 명세 S5에서 등록한 보유 재료 5종. 두부만 유통기한 임박(오늘 +3일). */
const OWNED = [
  { name: '양파' },
  { name: '계란' },
  { name: '두부', expiresAt: '2026-08-01' },
  { name: '대파' },
  { name: '닭가슴살' },
];

const rank = (owned = OWNED, options = {}) =>
  rankRecipes(RECIPES, owned, { today: TODAY, ...options });

const byId = (ranked, id) => ranked.find((r) => r.id === id);
const indexOf = (ranked, id) => ranked.findIndex((r) => r.id === id);

/* ── 검증 케이스: 명세 S6 재현 ─────────────────────────────── */

test('두부 계란찜이 100%로 1위다', () => {
  const ranked = rank();
  assert.equal(ranked[0].id, 'tofu_egg_steam');
  assert.equal(ranked[0].matchPercent, 100);
  assert.equal(ranked[0].kcal, 210);
  assert.equal(ranked[0].score, 110); // 100 + 임박 두부 10
});

test('두부 계란찜은 임박 재료 가산점으로 다른 100% 요리보다 위에 온다', () => {
  const ranked = rank();
  const eggRoll = byId(ranked, 'egg_roll');
  assert.equal(eggRoll.matchPercent, 100, '계란말이도 100%여야 한다');
  assert.equal(eggRoll.score, 100, '임박 재료를 쓰지 않으므로 가산점 없음');
  assert.ok(indexOf(ranked, 'tofu_egg_steam') < indexOf(ranked, 'egg_roll'));
});

test('두부 계란찜 카드에 임박 재료 사유가 붙는다', () => {
  assert.deepEqual(byId(rank(), 'tofu_egg_steam').expiringNames, ['두부']);
});

test('닭가슴살 볶음은 75%이고 부족 재료는 파프리카뿐이다', () => {
  const r = byId(rank(), 'chicken_stirfry');
  assert.equal(r.matchPercent, 75);
  assert.equal(r.score, 75);
  assert.deepEqual(r.missing.map((i) => i.name), ['파프리카']);
});

/* ── 양념 제외 ─────────────────────────────────────────────── */

test('소금·식용유 같은 양념은 매칭률 분모에서 빠진다', () => {
  const stew = RECIPES.find((r) => r.id === 'onion_pickle');
  // 양파 장아찌: 재료 5개 중 간장·식초·설탕·물 4개가 양념 → 필수는 양파 1개뿐
  const m = matchRecipe(stew, new Set(['양파']));
  assert.equal(stew.ingredients.length, 5);
  assert.equal(m.essentials.length, 1);
  assert.equal(m.matchRate, 1);
});

test('모든 시드 레시피의 양념 플래그가 화이트리스트와 어긋나지 않는다', () => {
  for (const recipe of RECIPES) {
    for (const ing of recipe.ingredients) {
      // isStaple 플래그가 곧 판정 결과여야 한다.
      assert.equal(isStaple(ing), ing.isStaple, `${recipe.name} / ${ing.name}`);
    }
  }
});

/* ── 정규화 · 동의어 ───────────────────────────────────────── */

test("'달걀'로 등록해도 '계란'을 쓰는 레시피가 매칭된다", () => {
  const ranked = rank([{ name: '달걀' }, { name: '대파' }]);
  const eggRoll = byId(ranked, 'egg_roll');
  assert.ok(eggRoll, '계란말이가 후보에 있어야 한다');
  assert.equal(eggRoll.matchPercent, 100);
});

test('공백과 표기 차이를 흡수한다', () => {
  assert.equal(normalize('닭 가슴살'), normalize('닭가슴살'));
  assert.equal(normalize('묵은지'), normalize('김치'));
  assert.equal(normalize('현미밥'), normalize('밥'));
});

/* ── 필터 ──────────────────────────────────────────────────── */

test(`부족 재료가 ${MAX_MISSING}개를 넘으면 목록에 없다`, () => {
  // 계란만 있으면 닭가슴살 볶음은 필수 재료 4개가 전부 부족하다.
  const ranked = rank([{ name: '계란' }]);
  assert.equal(byId(ranked, 'chicken_stirfry'), undefined);
  for (const r of ranked) assert.ok(r.missing.length <= MAX_MISSING);
});

test('보유 재료가 하나도 안 겹치는 레시피는 노출하지 않는다', () => {
  // 미역국(미역·소고기)은 보유 5종과 겹치는 재료가 없다 → 0%
  assert.equal(byId(rank(), 'seaweed_soup'), undefined);
  for (const r of rank()) assert.ok(r.matched.length >= 1);
});

test('재료를 지정하면 그 재료를 쓰는 요리만 남는다', () => {
  const ranked = rank(OWNED, { pinnedIngredient: '두부' });
  assert.ok(ranked.length > 0);
  for (const r of ranked) {
    assert.ok(
      r.essentials.some((i) => normalize(i.name) === normalize('두부')),
      `${r.name}에 두부가 없다`,
    );
  }
  assert.equal(ranked[0].id, 'tofu_egg_steam');
});

test('지정한 재료를 쓰는 요리가 없으면 빈 결과를 돌려준다', () => {
  // 지정은 화면의 보유 재료 칩에서만 가능하다. 어떤 레시피도 안 쓰는 재료를 고른 경우.
  const owned = [...OWNED, { name: '아보카도' }];
  assert.equal(rank(owned, { pinnedIngredient: '아보카도' }).length, 0);
  // 지정을 풀면 다시 후보가 나온다 → 화면은 [지정 해제]를 제안한다.
  assert.ok(rank(owned).length > 0);
});

/* ── 잔여 칼로리 조건 ──────────────────────────────────────── */

test('잔여 칼로리를 넘는 요리는 숨기지 않고 후순위로 내려간다', () => {
  const remaining = 442; // 오늘 목표 1,892 − 섭취 1,450 (명세 S6)
  const plain = rank();
  const filtered = rank(OWNED, { useCalorieFilter: true, remaining });

  const salad = byId(filtered, 'chicken_salad'); // 520 kcal > 442 × 1.15 = 508.3
  assert.ok(salad, '숨기지 않는다');
  assert.equal(salad.caloriePenalty, -SCORE.calorieOverPenalty);
  assert.ok(indexOf(filtered, 'chicken_salad') >= indexOf(plain, 'chicken_salad'));

  const friedRice = byId(filtered, 'egg_fried_rice'); // 480 kcal ≤ 508.3 → 감점 없음
  assert.equal(friedRice.caloriePenalty, 0);
});

test('잔여 칼로리가 음수면 저칼로리 기준으로 바뀐다', () => {
  const filtered = rank(OWNED, { useCalorieFilter: true, remaining: -100 });
  // lowCalBudget 300 × 1.15 = 345 kcal가 기준선이 된다.
  assert.equal(byId(filtered, 'chicken_stirfry').caloriePenalty, 0); // 320 kcal
  assert.equal(byId(filtered, 'egg_fried_rice').caloriePenalty, -SCORE.calorieOverPenalty); // 480 kcal
  assert.ok(filtered[0].kcal <= SCORE.lowCalBudget * SCORE.calorieTolerance);
});

test('토글을 끄면 칼로리는 순위에 영향을 주지 않는다', () => {
  const off = rank(OWNED, { useCalorieFilter: false, remaining: 100 });
  for (const r of off) assert.equal(r.caloriePenalty, 0);
});

/* ── 정렬 규칙 ─────────────────────────────────────────────── */

test('점수 → 부족 재료 수 → 칼로리 순으로 정렬된다', () => {
  const ranked = rank();
  for (let n = 1; n < ranked.length; n += 1) {
    const a = ranked[n - 1];
    const b = ranked[n];
    if (a.score !== b.score) {
      assert.ok(a.score > b.score, `${a.name} > ${b.name}`);
    } else if (a.missing.length !== b.missing.length) {
      assert.ok(a.missing.length < b.missing.length, `${a.name} 부족 < ${b.name} 부족`);
    } else {
      assert.ok(a.kcal <= b.kcal, `${a.name} kcal ≤ ${b.name} kcal`);
    }
  }
});

/* ── 유통기한 ──────────────────────────────────────────────── */

test('유통기한이 3일을 넘게 남으면 가산점이 없다', () => {
  const ranked = rankRecipes(
    RECIPES,
    [{ name: '두부', expiresAt: '2026-08-10' }, { name: '계란' }, { name: '대파' }],
    { today: TODAY },
  );
  const steam = byId(ranked, 'tofu_egg_steam');
  assert.equal(steam.matchPercent, 100);
  assert.equal(steam.expiryBonus, 0);
  assert.equal(steam.score, 100);
});

test('임박 가산점은 최대 20점이다', () => {
  const ranked = rankRecipes(
    RECIPES,
    [
      { name: '두부', expiresAt: TODAY },
      { name: '계란', expiresAt: TODAY },
      { name: '대파', expiresAt: TODAY },
    ],
    { today: TODAY },
  );
  const steam = byId(ranked, 'tofu_egg_steam'); // 임박 재료 3개를 쓴다
  assert.equal(steam.expiryUsed, 3);
  assert.equal(steam.expiryBonus, SCORE.expiryBonusMax);
  assert.equal(steam.score, 120);
});
