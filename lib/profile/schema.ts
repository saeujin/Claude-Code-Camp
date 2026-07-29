import { z } from 'zod'
import { INPUT_RANGES } from '@/lib/nutrition/constants'
import type { Profile } from '@/lib/nutrition/types'

/**
 * 입력 검증 — 명세서 §F1 "예외 및 제약"
 *
 * 허용 범위: 나이 10~100세, 키 100~250cm, 몸무게 30~300kg.
 * 유지 목표일 때는 목표 체중·기간을 입력받지 않는다.
 */

const { age, heightCm, weightKg, targetWeightKg, goalDurationDays } = INPUT_RANGES

export const profileSchema = z
  .object({
    sex: z.enum(['male', 'female'], { message: '성별을 선택해주세요.' }),

    age: z
      .number({ message: '나이를 입력해주세요.' })
      .int('나이는 정수로 입력해주세요.')
      .min(age.min, `나이는 ${age.min}세 이상이어야 해요.`)
      .max(age.max, `나이는 ${age.max}세 이하여야 해요.`),

    heightCm: z
      .number({ message: '키를 입력해주세요.' })
      .min(heightCm.min, `키는 ${heightCm.min}cm 이상이어야 해요.`)
      .max(heightCm.max, `키는 ${heightCm.max}cm 이하여야 해요.`),

    weightKg: z
      .number({ message: '몸무게를 입력해주세요.' })
      .min(weightKg.min, `몸무게는 ${weightKg.min}kg 이상이어야 해요.`)
      .max(weightKg.max, `몸무게는 ${weightKg.max}kg 이하여야 해요.`),

    activityLevel: z.enum(['sedentary', 'light', 'active', 'veryActive'], {
      message: '활동 수준을 선택해주세요.',
    }),

    dietGoal: z.enum(['lose', 'maintain', 'gain'], {
      message: '식단 목표를 선택해주세요.',
    }),

    targetWeightKg: z
      .number()
      .min(targetWeightKg.min, `목표 체중은 ${targetWeightKg.min}kg 이상이어야 해요.`)
      .max(targetWeightKg.max, `목표 체중은 ${targetWeightKg.max}kg 이하여야 해요.`)
      .nullable(),

    goalDurationDays: z
      .number()
      .int()
      .min(goalDurationDays.min, '목표 기간은 최소 1일이어야 해요.')
      .max(goalDurationDays.max, '목표 기간이 너무 깁니다.')
      .nullable(),

    goalStartDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, '목표 시작일 형식이 올바르지 않아요.'),
  })
  // 유지가 아니면 목표 체중·기간이 반드시 있어야 한다
  .refine((v) => v.dietGoal === 'maintain' || v.targetWeightKg != null, {
    message: '목표 체중을 입력해주세요.',
    path: ['targetWeightKg'],
  })
  .refine((v) => v.dietGoal === 'maintain' || v.goalDurationDays != null, {
    message: '목표 기간을 입력해주세요.',
    path: ['goalDurationDays'],
  })

export type ProfileInput = z.infer<typeof profileSchema>

/** 저장된 값이 현재 스키마에 맞는지 확인한다. 맞지 않으면 null */
export function parseProfile(value: unknown): Profile | null {
  const result = profileSchema.safeParse(value)
  return result.success ? (result.data as Profile) : null
}

/** 필드별 오류 메시지 맵 (`{ age: '나이는 ...' }`) */
export function collectFieldErrors(
  value: unknown,
): Partial<Record<keyof ProfileInput, string>> {
  const result = profileSchema.safeParse(value)
  if (result.success) return {}

  const errors: Partial<Record<keyof ProfileInput, string>> = {}
  for (const issue of result.error.issues) {
    const key = issue.path[0] as keyof ProfileInput | undefined
    if (key && !errors[key]) errors[key] = issue.message
  }
  return errors
}
