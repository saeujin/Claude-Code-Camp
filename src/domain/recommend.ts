/**
 * F5. 다음 식사 추천 — 배분·후보 추림·정렬
 *
 * 기능명세서.md 318~349줄 참조. 기획서는 `plans/f5-meal-recommendation.md`.
 *
 * 이 파일의 모든 함수는 순수 함수다. F1(기본 목표)과 F3(운동 소모)의 값은
 * 계산하지 않고 `RecommendInput`으로 주입받는다 — F2가 `DailyTarget`을 다루는
 * 방식과 같다. 그래서 F1·F3 구현 전에도 추천 로직을 완성하고 검증할 수 있다.
 *
 * 반올림은 화면 표시 시점에만 한다. 여기서는 하지 않는다 (`nutrition.ts`의 원칙).
 */

import type {
  Food,
  MealSlot,
  MealSuggestion,
  Nutrition,
  RecommendInput,
  Recommendation,
  RecommendStatus,
} from './types'
import { MEAL_SLOTS } from './types'
import { computeNutrition, formatGram, formatKcal } from './nutrition'

/**
 * 허용하는 인분 배수 (기획서 §2-⑤).
 *
 * 1인분 고정으로는 후보가 마른다 — 씨드 83개의 1인분 칼로리는 중앙값 144kcal라서
 * 500kcal 전후의 좁은 밴드에 걸리는 음식이 거의 없다. 배수를 허용하면 S4 케이스의
 * 후보가 10개에서 14개로 늘고, 닭가슴살 샐러드(1인분 288kcal)가 ×1.5로 밴드에
 * 들어온다.
 */
export const SERVING_MULTIPLIERS: readonly number[] = [0.5, 1, 1.5, 2]

/** 끼니 몫 대비 허용 오차 (명세 336줄) */
const KCAL_TOLERANCE = 0.15

/** 후보가 모자랄 때 한 번 넓히는 오차 */
const WIDE_TOLERANCE = 0.3

/** 명세 341줄 — 추천 음식 3~5개 */
const MIN_SUGGESTIONS = 3
const MAX_SUGGESTIONS = 5

/** 이보다 잔여 칼로리가 적으면 정식 끼니 대신 간식을 제안한다 (명세 348줄) */
const SNACK_ONLY_KCAL = 200

/** 목표를 넘긴 날 제안할 저칼로리 음식의 1인분 상한 (명세 347줄) */
const LOW_KCAL_CEILING = 200

/** 근력운동을 기록한 날 단백질 가중치에 곱하는 값 (명세 338줄) */
const STRENGTH_PROTEIN_WEIGHT = 1.5

// ---------------------------------------------------------------------------
// ①~④ 목표·잔여·배분
// ---------------------------------------------------------------------------

/** ① 오늘 목표 칼로리 = 기본 목표 + 운동 소모 (명세 330줄) */
export function todayTargetKcal(baseTargetKcal: number, exerciseKcal: number): number {
  return baseTargetKcal + exerciseKcal
}

/**
 * ③ 잔여 탄단지. 영양소별로 음수는 0으로 클램프한다.
 *
 * 잔여 칼로리(②)는 초과분을 음수로 그대로 두지만(명세 225줄) 탄단지는 다르다.
 * 이미 채운 영양소는 정렬 가중치가 0이어야 하므로 음수를 남기면 안 된다.
 */
export function remainingMacros(target: Nutrition, consumed: Nutrition): Nutrition {
  return {
    kcal: Math.max(0, target.kcal - consumed.kcal),
    carb: Math.max(0, target.carb - consumed.carb),
    protein: Math.max(0, target.protein - consumed.protein),
    fat: Math.max(0, target.fat - consumed.fat),
  }
}

/**
 * ④ 오늘 남은 끼니 (명세 334~335줄).
 *
 * `요청 끼니` + `요청 끼니보다 뒤 순서이고 아직 기록이 없는 끼니`.
 * 요청 끼니는 이미 기록이 있어도 포함한다 — 사용자가 그 끼니를 더 먹으려고
 * 추천을 눌렀을 수 있고, 그만큼은 이미 잔여 칼로리에서 빠져 있다.
 *
 * 끼니 순서는 `MEAL_SLOTS`(아침 → 점심 → 저녁 → 간식)를 그대로 쓴다.
 */
export function remainingSlots(
  slot: MealSlot,
  loggedSlots: readonly MealSlot[],
): MealSlot[] {
  const from = MEAL_SLOTS.indexOf(slot)

  return MEAL_SLOTS.filter(
    (candidate, index) => index === from || (index > from && !loggedSlots.includes(candidate)),
  )
}

// ---------------------------------------------------------------------------
// ⑤ 후보 추림
// ---------------------------------------------------------------------------

/** 1인분 영양값. `servingGram`이 없으면 인분으로 환산할 수 없어 `null` */
function perServing(food: Food): Nutrition | null {
  if (food.servingGram === undefined) return null
  return computeNutrition(food, { unit: 'serving', value: 1 })
}

function scaleNutrition(nutrition: Nutrition, factor: number): Nutrition {
  return {
    kcal: nutrition.kcal * factor,
    carb: nutrition.carb * factor,
    protein: nutrition.protein * factor,
    fat: nutrition.fat * factor,
  }
}

/**
 * 끼니 몫에 가장 가까운 인분 배수를 고른다 (명세 336줄 + 기획서 §2-⑤).
 *
 * 밴드 `[몫×0.85, 몫×1.15]`는 `|칼로리 − 몫| ≤ 0.15×몫`과 같은 조건이다. 밴드가
 * 몫을 중심으로 대칭이므로 **어떤 배수라도 밴드에 들어온다면 가장 가까운 배수도
 * 반드시 밴드에 들어온다.** 그래서 배수를 하나만 고른 뒤 오차를 비교하면 된다.
 */
function closestMultiplier(
  servingKcal: number,
  slotKcal: number,
): { multiplier: number; diff: number } | null {
  let best: { multiplier: number; diff: number } | null = null

  for (const multiplier of SERVING_MULTIPLIERS) {
    const diff = Math.abs(servingKcal * multiplier - slotKcal)
    if (best === null || diff < best.diff) best = { multiplier, diff }
  }
  return best
}

/** 배수를 적용한 후보 하나. 정렬 전 중간 표현 */
type Candidate = {
  food: Food
  multiplier: number
  nutrition: Nutrition
  /** 끼니 몫과의 칼로리 차 */
  diff: number
}

function buildCandidates(pool: readonly Food[], slotKcal: number): Candidate[] {
  const candidates: Candidate[] = []

  for (const food of pool) {
    const serving = perServing(food)
    if (serving === null || serving.kcal <= 0) continue

    const best = closestMultiplier(serving.kcal, slotKcal)
    if (best === null) continue

    candidates.push({
      food,
      multiplier: best.multiplier,
      nutrition: scaleNutrition(serving, best.multiplier),
      diff: best.diff,
    })
  }
  return candidates
}

// ---------------------------------------------------------------------------
// ⑥ 정렬
// ---------------------------------------------------------------------------

/** 정렬 가중치를 매기는 세 영양소 */
const MACRO_KEYS = ['carb', 'protein', 'fat'] as const
type MacroKey = (typeof MACRO_KEYS)[number]

const MACRO_LABEL: Record<MacroKey, string> = {
  carb: '탄수화물',
  protein: '단백질',
  fat: '지방',
}

function macroWeight(key: MacroKey, hasStrengthWorkout: boolean): number {
  return key === 'protein' && hasStrengthWorkout ? STRENGTH_PROTEIN_WEIGHT : 1
}

/**
 * ⑥ 점수 — 부족한 영양소를 얼마나 채워주는지 (명세 337~338줄).
 *
 * ```
 * 가중치 = (잔여 ÷ 목표) × 근력 보정        ← 목표 대비 "부족률"
 * 점수   = Σ min(1, 후보 ÷ 잔여) × 가중치  ÷  Σ 가중치
 * ```
 *
 * **가중치를 절대 부족량이 아니라 부족률로 잡은 이유** — 명세 337줄은 "가장 부족한
 * 영양소"라고만 적어 두었다. 절대 부족량(kcal 환산)으로 잡으면 S4 케이스에서 탄수
 * 부족분 111g×4=444kcal가 단백질 101g×4=404kcal보다 커서 탄수화물이 최우선이 되고
 * 1위가 짬뽕·김밥이 된다. 부족률(탄 70% / 단 85% / 지 64%)로 잡으면 단백질이
 * 최상위가 되어 명세 463줄이 명시한 "단백질이 많은 음식을 우선 정렬"이 재현된다.
 *
 * 이미 채운 영양소(잔여 0)는 분자·분모에서 모두 빼서 점수에 영향을 주지 않는다.
 */
export function scoreCandidate(
  candidate: Nutrition,
  remaining: Nutrition,
  target: Nutrition,
  hasStrengthWorkout: boolean,
): number {
  let weighted = 0
  let totalWeight = 0

  for (const key of MACRO_KEYS) {
    const left = remaining[key]
    const goal = target[key]
    if (left <= 0 || goal <= 0) continue

    const weight = (left / goal) * macroWeight(key, hasStrengthWorkout)
    weighted += Math.min(1, candidate[key] / left) * weight
    totalWeight += weight
  }

  return totalWeight === 0 ? 0 : weighted / totalWeight
}

/** 부족률이 가장 높은 영양소. 채울 것이 없으면 `null` */
function mostDeficientMacro(
  remaining: Nutrition,
  target: Nutrition,
  hasStrengthWorkout: boolean,
): MacroKey | null {
  let best: { key: MacroKey; ratio: number } | null = null

  for (const key of MACRO_KEYS) {
    const left = remaining[key]
    const goal = target[key]
    if (left <= 0 || goal <= 0) continue

    const ratio = (left / goal) * macroWeight(key, hasStrengthWorkout)
    if (best === null || ratio > best.ratio) best = { key, ratio }
  }

  return best === null ? null : best.key
}

/**
 * 추천 이유 문구 (명세 343~344줄).
 *
 * 인분 배수는 이유가 아니라 표시 항목이므로 여기에 넣지 않는다.
 * 화면은 `MealSuggestion.servings`를 `formatServings`로 함께 보여준다.
 */
function buildReasons(
  remaining: Nutrition,
  target: Nutrition,
  exerciseKcal: number,
  hasStrengthWorkout: boolean,
): string[] {
  const reasons: string[] = []

  const deficient = mostDeficientMacro(remaining, target, hasStrengthWorkout)
  if (deficient !== null) {
    reasons.push(`${MACRO_LABEL[deficient]}이 ${formatGram(remaining[deficient])}g 부족해요`)
  }

  if (exerciseKcal > 0) {
    reasons.push(`운동으로 ${formatKcal(exerciseKcal)} kcal가 추가됐어요`)
  }

  return reasons
}

// ---------------------------------------------------------------------------
// 후보 풀
// ---------------------------------------------------------------------------

/**
 * 끼니에 어울리는 음식만 남긴다 (기획서 §3).
 *
 * `role`을 보지 않고 칼로리 밴드만 적용하면 S4 케이스에서 **소주 508kcal**와
 * **삼겹살(생) 497kcal**가 점심 후보로 잡힌다. 주류를 끼니로 추천하고 조리하지
 * 않은 생고기를 메뉴로 내놓게 된다.
 */
function poolFor(foods: readonly Food[], slot: MealSlot): Food[] {
  const wanted = slot === 'snack' ? 'snack' : 'meal'
  return foods.filter((food) => food.role === wanted)
}

/** 목표를 넘긴 날 제안할 저칼로리 음식 (명세 347줄) */
function lowKcalPool(foods: readonly Food[]): Food[] {
  return foods.filter((food) => {
    if (food.role !== 'meal' && food.role !== 'snack') return false

    const serving = perServing(food)
    return serving !== null && serving.kcal > 0 && serving.kcal <= LOW_KCAL_CEILING
  })
}

// ---------------------------------------------------------------------------
// 진입점
// ---------------------------------------------------------------------------

const NOTICE: Record<RecommendStatus, string | null> = {
  'profile-required': '프로필을 먼저 설정해 주세요. 목표 칼로리가 있어야 추천할 수 있어요.',
  'over-target': '오늘 목표를 넘었어요. 가벼운 음식은 어떨까요?',
  'snack-only': '남은 칼로리가 적어요. 정식 끼니보다 간식으로 채우는 걸 권해요.',
  ok: null,
}

function emptyResult(status: RecommendStatus, remainingSlotCount: number): Recommendation {
  return {
    status,
    todayTargetKcal: null,
    remainingKcal: null,
    remainingSlotCount,
    slotKcal: null,
    suggestions: [],
    notice: NOTICE[status],
  }
}

/**
 * 밴드 안의 후보를 골라 점수순으로 세운다.
 *
 * 밴드 내 후보가 3개 미만이면 오차를 ±30%로 한 번 넓히고, 그래도 모자라면
 * 칼로리가 가까운 순으로 채운다 — 명세는 3~5개를 내놓으라고 정했으므로(341줄)
 * 빈손으로 돌려주지 않는다.
 */
function selectByBand(candidates: Candidate[], slotKcal: number): Candidate[] {
  const within = (tolerance: number): Candidate[] =>
    candidates.filter((candidate) => candidate.diff <= slotKcal * tolerance)

  const tight = within(KCAL_TOLERANCE)
  if (tight.length >= MIN_SUGGESTIONS) return tight

  const wide = within(WIDE_TOLERANCE)
  if (wide.length >= MIN_SUGGESTIONS) return wide

  return [...candidates].sort((a, b) => a.diff - b.diff).slice(0, MAX_SUGGESTIONS)
}

function toSuggestion(candidate: Candidate, score: number, reasons: string[]): MealSuggestion {
  return {
    food: candidate.food,
    servings: candidate.multiplier,
    nutrition: candidate.nutrition,
    score,
    reasons,
  }
}

/**
 * 다음 끼니로 먹을 음식을 제안한다.
 *
 * `foods`는 씨드와 개인 음식을 합친 전체 목록을 넘기면 된다 — 후보 자격은
 * `role`로 이 안에서 걸러낸다.
 */
export function recommendNextMeal(
  input: RecommendInput,
  foods: readonly Food[],
): Recommendation {
  const { baseTarget, exerciseKcal, hasStrengthWorkout, consumed, slot, loggedSlots } = input

  const slots = remainingSlots(slot, loggedSlots)

  // F1 미완료 — 기준선이 없으면 배분할 것도 없다 (명세 349줄)
  if (baseTarget === null) return emptyResult('profile-required', slots.length)

  const target = baseTarget
  const todayKcal = todayTargetKcal(target.kcal, exerciseKcal)
  const remainingKcal = todayKcal - consumed.kcal
  const remaining = remainingMacros(target, consumed)

  // 목표를 넘긴 날 — 부족한 영양소를 채운다는 목적 자체가 성립하지 않으므로
  // 점수 대신 칼로리 오름차순으로 가벼운 음식만 제안한다 (명세 347줄).
  if (remainingKcal <= 0) {
    const suggestions = lowKcalPool(foods)
      .map((food) => ({ food, serving: perServing(food) }))
      .filter((item): item is { food: Food; serving: Nutrition } => item.serving !== null)
      .sort((a, b) => a.serving.kcal - b.serving.kcal)
      .slice(0, MAX_SUGGESTIONS)
      .map(({ food, serving }) =>
        toSuggestion({ food, multiplier: 1, nutrition: serving, diff: 0 }, 0, []),
      )

    return {
      status: 'over-target',
      todayTargetKcal: todayKcal,
      remainingKcal,
      remainingSlotCount: slots.length,
      slotKcal: null,
      suggestions,
      notice: NOTICE['over-target'],
    }
  }

  // 잔여가 적으면 정식 끼니 대신 간식 (명세 348줄)
  const snackOnly = remainingKcal < SNACK_ONLY_KCAL
  const status: RecommendStatus = snackOnly ? 'snack-only' : 'ok'
  const pool = poolFor(foods, snackOnly ? 'snack' : slot)

  const slotKcal = remainingKcal / slots.length
  const reasons = buildReasons(remaining, target, exerciseKcal, hasStrengthWorkout)

  const suggestions = selectByBand(buildCandidates(pool, slotKcal), slotKcal)
    .map((candidate) => ({
      candidate,
      score: scoreCandidate(candidate.nutrition, remaining, target, hasStrengthWorkout),
    }))
    // 점수가 같으면 끼니 몫에 가까운 쪽을 앞세운다. 정렬을 결정적으로 만든다.
    .sort((a, b) => b.score - a.score || a.candidate.diff - b.candidate.diff)
    .slice(0, MAX_SUGGESTIONS)
    .map(({ candidate, score }) => toSuggestion(candidate, score, reasons))

  return {
    status,
    todayTargetKcal: todayKcal,
    remainingKcal,
    remainingSlotCount: slots.length,
    slotKcal,
    suggestions,
    notice: NOTICE[status],
  }
}

// ---------------------------------------------------------------------------
// 표시용 포맷
// ---------------------------------------------------------------------------

/**
 * 인분 배수 표시 (기획서 §5-3).
 *
 * 사용자가 실제로 먹을 양을 오해하면 F2 기록까지 틀어지므로 배수가 1이 아니면
 * 반드시 드러내야 한다.
 */
export function formatServings(servings: number): string {
  return `${Number.isInteger(servings) ? servings : servings.toFixed(1)}인분`
}
