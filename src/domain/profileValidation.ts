/**
 * F1 프로필 입력 검증 — 명세 191~199줄.
 *
 * JMS 브랜치는 zod로 이 검증을 했다. 이 저장소는 런타임 의존성 없이 자체
 * 검증(`validation.ts`)을 쓰고 있어, 같은 규칙을 그 방식으로 옮겼다. 오류 메시지와
 * 허용 범위는 그대로 유지했다.
 */

import { INPUT_RANGES } from './profileConstants'
import { isValidDateKey } from './date'
import type { ActivityLevel, DietGoal, Profile, Sex } from './types'

const SEXES: readonly string[] = ['male', 'female']
const ACTIVITY_LEVELS: readonly string[] = ['sedentary', 'light', 'active', 'veryActive']
const DIET_GOALS: readonly string[] = ['lose', 'maintain', 'gain']

/** 화면 폼이 들고 있는 값. 숫자 입력은 타이핑 중 빈 문자열이 될 수 있어 문자열이다 */
export type ProfileFormInput = {
  sex: Sex | ''
  age: string
  heightCm: string
  weightKg: string
  activityLevel: ActivityLevel | ''
  dietGoal: DietGoal
  targetWeightKg: string
  /** 주 수 또는 목표 날짜에서 환산된 일수. 미입력이면 null */
  goalDurationDays: number | null
  goalStartDate: string
}

export type ProfileFieldErrors = Partial<Record<keyof ProfileFormInput, string>>

function parseNumber(raw: string): number | null {
  const trimmed = raw.trim()
  if (trimmed === '') return null

  const value = Number(trimmed)
  return Number.isFinite(value) ? value : null
}

type RangeCheck = {
  raw: string
  label: string
  range: { min: number; max: number }
  unit: string
  integer?: boolean
}

/** 범위 검사 한 건. 통과하면 숫자를, 실패하면 메시지를 돌려준다 */
function checkRange(check: RangeCheck): { value: number } | { error: string } {
  const { raw, label, range, unit, integer = false } = check

  const value = parseNumber(raw)
  if (value === null) return { error: `${label}를 입력해주세요.` }
  if (integer && !Number.isInteger(value)) return { error: `${label}는 정수로 입력해주세요.` }
  if (value < range.min) return { error: `${label}는 ${range.min}${unit} 이상이어야 해요.` }
  if (value > range.max) return { error: `${label}는 ${range.max}${unit} 이하여야 해요.` }

  return { value }
}

/**
 * 폼 입력을 검증해 저장 가능한 `Profile`로 바꾼다.
 *
 * 유지 목표면 목표 체중·기간을 받지 않는다 (명세 99줄). 감량·증량이면 둘 다 필수다.
 */
export function validateProfileForm(
  input: ProfileFormInput,
): { errors: ProfileFieldErrors; profile: Profile | null } {
  const errors: ProfileFieldErrors = {}

  if (!SEXES.includes(input.sex)) errors.sex = '성별을 선택해주세요.'
  if (!ACTIVITY_LEVELS.includes(input.activityLevel)) {
    errors.activityLevel = '활동 수준을 선택해주세요.'
  }
  if (!DIET_GOALS.includes(input.dietGoal)) errors.dietGoal = '식단 목표를 선택해주세요.'

  const age = checkRange({
    raw: input.age,
    label: '나이',
    range: INPUT_RANGES.age,
    unit: '세',
    integer: true,
  })
  if ('error' in age) errors.age = age.error

  const height = checkRange({
    raw: input.heightCm,
    label: '키',
    range: INPUT_RANGES.heightCm,
    unit: 'cm',
  })
  if ('error' in height) errors.heightCm = height.error

  const weight = checkRange({
    raw: input.weightKg,
    label: '몸무게',
    range: INPUT_RANGES.weightKg,
    unit: 'kg',
  })
  if ('error' in weight) errors.weightKg = weight.error

  if (!isValidDateKey(input.goalStartDate)) {
    errors.goalStartDate = '목표 시작일 형식이 올바르지 않아요.'
  }

  // ── 목표 체중·기간 — 유지 목표면 받지 않는다 ──────────────────
  const isMaintain = input.dietGoal === 'maintain'
  let targetWeightKg: number | null = null
  let goalDurationDays: number | null = null

  if (!isMaintain) {
    const target = checkRange({
      raw: input.targetWeightKg,
      label: '목표 체중',
      range: INPUT_RANGES.targetWeightKg,
      unit: 'kg',
    })
    if ('error' in target) {
      errors.targetWeightKg =
        input.targetWeightKg.trim() === '' ? '목표 체중을 입력해주세요.' : target.error
    } else {
      targetWeightKg = target.value
    }

    const days = input.goalDurationDays
    if (days === null) {
      errors.goalDurationDays = '목표 기간을 입력해주세요.'
    } else if (!Number.isInteger(days) || days < INPUT_RANGES.goalDurationDays.min) {
      errors.goalDurationDays = '목표 기간은 최소 1일이어야 해요.'
    } else if (days > INPUT_RANGES.goalDurationDays.max) {
      errors.goalDurationDays = '목표 기간이 너무 깁니다.'
    } else {
      goalDurationDays = days
    }
  }

  if (Object.keys(errors).length > 0) return { errors, profile: null }

  return {
    errors,
    profile: {
      sex: input.sex as Sex,
      age: (age as { value: number }).value,
      heightCm: (height as { value: number }).value,
      weightKg: (weight as { value: number }).value,
      activityLevel: input.activityLevel as ActivityLevel,
      dietGoal: input.dietGoal,
      targetWeightKg,
      goalDurationDays,
      goalStartDate: input.goalStartDate,
    },
  }
}

/**
 * 저장된 값이 현재 형식에 맞는지 확인한다. 맞지 않으면 null.
 *
 * 저장소에서 읽은 임의의 JSON을 신뢰하지 않기 위한 관문이다.
 */
export function parseStoredProfile(value: unknown): Profile | null {
  if (typeof value !== 'object' || value === null) return null
  const raw = value as Record<string, unknown>

  const isMaintain = raw.dietGoal === 'maintain'
  const numberOrEmpty = (v: unknown): string => (typeof v === 'number' ? String(v) : '')

  const { profile } = validateProfileForm({
    sex: (SEXES.includes(raw.sex as string) ? raw.sex : '') as Sex | '',
    age: numberOrEmpty(raw.age),
    heightCm: numberOrEmpty(raw.heightCm),
    weightKg: numberOrEmpty(raw.weightKg),
    activityLevel: (ACTIVITY_LEVELS.includes(raw.activityLevel as string)
      ? raw.activityLevel
      : '') as ActivityLevel | '',
    dietGoal: (DIET_GOALS.includes(raw.dietGoal as string) ? raw.dietGoal : 'lose') as DietGoal,
    targetWeightKg: isMaintain ? '' : numberOrEmpty(raw.targetWeightKg),
    goalDurationDays: isMaintain
      ? null
      : typeof raw.goalDurationDays === 'number'
        ? raw.goalDurationDays
        : null,
    goalStartDate: typeof raw.goalStartDate === 'string' ? raw.goalStartDate : '',
  })

  return profile
}
