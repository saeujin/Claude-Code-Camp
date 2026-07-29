/**
 * 입력 검증. 폼이 저장 버튼을 잠글 근거로 쓴다.
 *
 * 명세 225줄에 따라 **목표 칼로리 초과는 검증 대상이 아니다.** 초과해도 기록을
 * 막지 않고 잔여 칼로리를 음수로 보여줄 뿐이다. 여기서 막는 것은 물리적으로
 * 말이 안 되는 입력(음수 섭취량, 인분 기준량 없는 음식의 인분 입력)뿐이다.
 */

import type { Amount, Food, Nutrition } from './types'

/** 필드명 → 오류 메시지. 비어 있으면 통과 */
export type FieldErrors = Record<string, string>

/** 섭취량 상한 — 오타(3000g 대신 30000g)를 걸러내기 위한 값 */
const MAX_GRAM = 5000
const MAX_SERVING = 20

export function validateAmount(food: Food | undefined, amount: Amount): FieldErrors {
  const errors: FieldErrors = {}

  if (!Number.isFinite(amount.value)) {
    errors.amount = '섭취량을 숫자로 입력해 주세요.'
    return errors
  }
  if (amount.value <= 0) {
    errors.amount = '섭취량은 0보다 커야 합니다.'
    return errors
  }

  if (amount.unit === 'g' && amount.value > MAX_GRAM) {
    errors.amount = `섭취량이 너무 큽니다. ${MAX_GRAM}g 이하로 입력해 주세요.`
  }
  if (amount.unit === 'serving') {
    if (food && food.servingGram === undefined) {
      errors.amount = '이 음식은 1인분 기준량이 없어 g으로 입력해야 합니다.'
    } else if (amount.value > MAX_SERVING) {
      errors.amount = `섭취량이 너무 큽니다. ${MAX_SERVING}인분 이하로 입력해 주세요.`
    }
  }

  return errors
}

/** 개인 음식 등록 폼의 입력값. 폼은 문자열을 들고 있으므로 여기서 파싱한다 */
export type CustomFoodInput = {
  name: string
  kcal: string
  carb: string
  protein: string
  fat: string
  servingGram: string
}

export type ParsedCustomFood = {
  name: string
  per100g: Nutrition
  servingGram?: number
}

/** 100g당 값의 상한. 지방 100g(=900kcal)이 이론적 최대라 넉넉히 잡는다 */
const MAX_PER_100G_KCAL = 1000
const MAX_PER_100G_MACRO = 100

function parseNumber(raw: string): number | null {
  const trimmed = raw.trim()
  if (trimmed === '') return null

  const value = Number(trimmed)
  return Number.isFinite(value) ? value : null
}

/** 필수 영양 필드 하나를 검사한다. 빈 값은 0으로 취급한다(탄단지에 한해) */
function validateMacro(raw: string, label: string, errors: FieldErrors, field: string): number {
  if (raw.trim() === '') return 0

  const value = parseNumber(raw)
  if (value === null) {
    errors[field] = `${label}을 숫자로 입력해 주세요.`
    return 0
  }
  if (value < 0) {
    errors[field] = `${label}은 0 이상이어야 합니다.`
    return 0
  }
  if (value > MAX_PER_100G_MACRO) {
    errors[field] = `100g당 ${label}이 ${MAX_PER_100G_MACRO}g을 넘을 수 없습니다.`
    return 0
  }
  return value
}

export function validateCustomFood(
  input: CustomFoodInput,
): { errors: FieldErrors; parsed: ParsedCustomFood | null } {
  const errors: FieldErrors = {}

  const name = input.name.trim()
  if (name === '') errors.name = '음식 이름을 입력해 주세요.'

  const kcal = parseNumber(input.kcal)
  if (kcal === null) {
    errors.kcal = '100g당 칼로리를 입력해 주세요.'
  } else if (kcal < 0) {
    errors.kcal = '칼로리는 0 이상이어야 합니다.'
  } else if (kcal > MAX_PER_100G_KCAL) {
    errors.kcal = `100g당 칼로리가 ${MAX_PER_100G_KCAL}kcal을 넘을 수 없습니다.`
  }

  const carb = validateMacro(input.carb, '탄수화물', errors, 'carb')
  const protein = validateMacro(input.protein, '단백질', errors, 'protein')
  const fat = validateMacro(input.fat, '지방', errors, 'fat')

  let servingGram: number | undefined
  if (input.servingGram.trim() !== '') {
    const value = parseNumber(input.servingGram)
    if (value === null || value <= 0) {
      errors.servingGram = '1인분 중량은 0보다 큰 숫자여야 합니다.'
    } else if (value > MAX_GRAM) {
      errors.servingGram = `1인분 중량은 ${MAX_GRAM}g 이하로 입력해 주세요.`
    } else {
      servingGram = value
    }
  }

  if (Object.keys(errors).length > 0 || kcal === null) {
    return { errors, parsed: null }
  }

  return {
    errors,
    parsed: {
      name,
      per100g: { kcal, carb, protein, fat },
      ...(servingGram === undefined ? {} : { servingGram }),
    },
  }
}

/**
 * 탄단지 그램에서 역산한 칼로리. 사용자가 입력한 칼로리와 크게 다르면
 * 오타일 가능성이 높다 — 막지는 않고 안내만 한다.
 */
export function kcalFromMacros(per100g: Nutrition): number {
  return per100g.carb * 4 + per100g.protein * 4 + per100g.fat * 9
}

/** 입력 칼로리와 탄단지 역산값의 차이가 30%를 넘으면 경고 문구를 돌려준다 */
export function macroMismatchWarning(per100g: Nutrition): string | null {
  const derived = kcalFromMacros(per100g)
  if (derived === 0 || per100g.kcal === 0) return null

  const gap = Math.abs(derived - per100g.kcal) / per100g.kcal
  if (gap <= 0.3) return null

  return `탄단지로 계산하면 약 ${Math.round(derived)}kcal입니다. 입력값을 확인해 주세요.`
}
