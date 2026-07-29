import { describe, expect, it } from 'vitest'
import {
  parseStoredProfile,
  validateProfileForm,
  type ProfileFormInput,
} from './profileValidation'

/** 명세 계산 예시 ㉮와 같은 입력 */
const VALID: ProfileFormInput = {
  sex: 'male',
  age: '30',
  heightCm: '175',
  weightKg: '75',
  activityLevel: 'sedentary',
  dietGoal: 'lose',
  targetWeightKg: '70',
  goalDurationDays: 84,
  goalStartDate: '2026-01-15',
}

describe('validateProfileForm', () => {
  it('정상 입력을 Profile로 바꾼다', () => {
    const { errors, profile } = validateProfileForm(VALID)

    expect(errors).toEqual({})
    expect(profile).toEqual({
      sex: 'male',
      age: 30,
      heightCm: 175,
      weightKg: 75,
      activityLevel: 'sedentary',
      dietGoal: 'lose',
      targetWeightKg: 70,
      goalDurationDays: 84,
      goalStartDate: '2026-01-15',
    })
  })

  describe('허용 범위 — 명세 193줄', () => {
    it('나이 10~100세', () => {
      expect(validateProfileForm({ ...VALID, age: '9' }).errors.age).toMatch(/10세 이상/)
      expect(validateProfileForm({ ...VALID, age: '101' }).errors.age).toMatch(/100세 이하/)
      expect(validateProfileForm({ ...VALID, age: '10' }).errors.age).toBeUndefined()
      expect(validateProfileForm({ ...VALID, age: '100' }).errors.age).toBeUndefined()
    })

    it('키 100~250cm', () => {
      expect(validateProfileForm({ ...VALID, heightCm: '99' }).errors.heightCm).toMatch(/100cm 이상/)
      expect(validateProfileForm({ ...VALID, heightCm: '251' }).errors.heightCm).toMatch(/250cm 이하/)
    })

    it('몸무게 30~300kg', () => {
      expect(validateProfileForm({ ...VALID, weightKg: '29' }).errors.weightKg).toMatch(/30kg 이상/)
      expect(validateProfileForm({ ...VALID, weightKg: '301' }).errors.weightKg).toMatch(/300kg 이하/)
    })

    it('나이는 정수여야 한다', () => {
      expect(validateProfileForm({ ...VALID, age: '30.5' }).errors.age).toMatch(/정수/)
    })

    it('키·몸무게는 소수를 허용한다', () => {
      const { errors } = validateProfileForm({ ...VALID, heightCm: '175.5', weightKg: '75.3' })
      expect(errors).toEqual({})
    })
  })

  describe('필수 항목 — 명세 192줄', () => {
    it('빈 값을 막는다', () => {
      const { errors, profile } = validateProfileForm({
        ...VALID,
        age: '',
        heightCm: '',
        weightKg: '',
      })

      expect(errors.age).toMatch(/입력해주세요/)
      expect(errors.heightCm).toMatch(/입력해주세요/)
      expect(errors.weightKg).toMatch(/입력해주세요/)
      expect(profile).toBeNull()
    })

    it('성별·활동 수준 미선택을 막는다', () => {
      const { errors } = validateProfileForm({ ...VALID, sex: '', activityLevel: '' })

      expect(errors.sex).toMatch(/선택해주세요/)
      expect(errors.activityLevel).toMatch(/선택해주세요/)
    })

    it('숫자가 아닌 값을 막는다', () => {
      expect(validateProfileForm({ ...VALID, weightKg: '칠십오' }).errors.weightKg).toBeDefined()
    })
  })

  describe('목표 체중·기간 — 유지 목표면 받지 않는다 (명세 99줄)', () => {
    it('유지 목표는 목표 체중·기간이 비어도 통과하고 null로 저장된다', () => {
      const { errors, profile } = validateProfileForm({
        ...VALID,
        dietGoal: 'maintain',
        targetWeightKg: '',
        goalDurationDays: null,
      })

      expect(errors).toEqual({})
      expect(profile?.targetWeightKg).toBeNull()
      expect(profile?.goalDurationDays).toBeNull()
    })

    it('유지 목표는 입력된 목표 체중을 무시한다', () => {
      const { profile } = validateProfileForm({ ...VALID, dietGoal: 'maintain' })
      expect(profile?.targetWeightKg).toBeNull()
    })

    it('감량 목표는 목표 체중이 필수다', () => {
      const { errors } = validateProfileForm({ ...VALID, targetWeightKg: '' })
      expect(errors.targetWeightKg).toMatch(/목표 체중을 입력/)
    })

    it('감량 목표는 기간이 필수다', () => {
      const { errors } = validateProfileForm({ ...VALID, goalDurationDays: null })
      expect(errors.goalDurationDays).toMatch(/목표 기간을 입력/)
    })

    it('기간은 최소 1일이다', () => {
      expect(validateProfileForm({ ...VALID, goalDurationDays: 0 }).errors.goalDurationDays).toMatch(
        /최소 1일/,
      )
    })

    it('기간이 지나치게 길면 막는다', () => {
      expect(
        validateProfileForm({ ...VALID, goalDurationDays: 99999 }).errors.goalDurationDays,
      ).toMatch(/너무 깁니다/)
    })

    // 명세 194줄 — 값 자체는 유효하다. 유지로 치환하는 것은 calcAllTargets의 일이다
    it('목표 체중 = 현재 체중도 입력으로는 유효하다', () => {
      const { errors, profile } = validateProfileForm({ ...VALID, targetWeightKg: '75' })

      expect(errors).toEqual({})
      expect(profile?.targetWeightKg).toBe(75)
    })
  })

  it('목표 시작일 형식이 틀리면 막는다', () => {
    expect(validateProfileForm({ ...VALID, goalStartDate: '2026-1-15' }).errors.goalStartDate)
      .toBeDefined()
    expect(validateProfileForm({ ...VALID, goalStartDate: '2026-02-31' }).errors.goalStartDate)
      .toBeDefined()
  })
})

describe('parseStoredProfile', () => {
  const stored = {
    sex: 'male',
    age: 30,
    heightCm: 175,
    weightKg: 75,
    activityLevel: 'sedentary',
    dietGoal: 'lose',
    targetWeightKg: 70,
    goalDurationDays: 84,
    goalStartDate: '2026-01-15',
  }

  it('저장된 형태를 되살린다', () => {
    expect(parseStoredProfile(stored)).toEqual(stored)
  })

  it('유지 목표는 null 필드를 그대로 되살린다', () => {
    const maintain = {
      ...stored,
      dietGoal: 'maintain',
      targetWeightKg: null,
      goalDurationDays: null,
    }
    expect(parseStoredProfile(maintain)).toEqual(maintain)
  })

  it('객체가 아니면 null', () => {
    expect(parseStoredProfile(null)).toBeNull()
    expect(parseStoredProfile('문자열')).toBeNull()
    expect(parseStoredProfile(42)).toBeNull()
  })

  it('필드가 빠졌으면 null — 저장된 JSON을 신뢰하지 않는다', () => {
    const { weightKg: _omitted, ...missing } = stored
    expect(parseStoredProfile(missing)).toBeNull()
  })

  it('범위를 벗어난 값이 저장돼 있으면 null', () => {
    expect(parseStoredProfile({ ...stored, age: 500 })).toBeNull()
  })

  it('알 수 없는 enum 값이면 null', () => {
    expect(parseStoredProfile({ ...stored, activityLevel: 'superhuman' })).toBeNull()
    expect(parseStoredProfile({ ...stored, sex: 'other' })).toBeNull()
  })
})
