/**
 * F1. 사용자 프로필 및 목표 설정 — 화면.
 *
 * 명세 87줄 — "앱을 쓰기 위해 반드시 먼저 완료해야 하는 기능. 여기서 나온 기본
 * 목표 칼로리가 다른 모든 기능의 기준이 된다."
 *
 * JMS 브랜치의 `components/profile/*`(Next.js + Tailwind)를 이 저장소의 Vite +
 * 순수 CSS 구조로 다시 쓴 것이다. 계산과 검증은 도메인에 있고 여기서는 입력만 모은다.
 */

import { useMemo, useState } from 'react'
import type { ActivityLevel, DietGoal, Profile, Sex } from '../../domain/types'
import {
  ACTIVITY_LABELS,
  ACTIVITY_ORDER,
  DIET_GOAL_LABELS,
  DIET_GOAL_ORDER,
  INPUT_RANGES,
  SEX_LABELS,
  SEX_ORDER,
} from '../../domain/profileConstants'
import { calcAllTargets } from '../../domain/profile'
import {
  validateProfileForm,
  type ProfileFieldErrors,
  type ProfileFormInput,
} from '../../domain/profileValidation'
import { todayKey } from '../../domain/date'
import { loadProfile, saveProfile } from '../../data/profileRepo'
import { Field, FieldGroup } from '../diet/Field'
import { GoalPeriodInput } from './GoalPeriodInput'
import { TargetBreakdown } from './TargetBreakdown'
import './profile.css'

type Props = {
  /** 저장 직후 F2가 목표를 다시 읽도록 알린다 */
  onSaved?: () => void
}

function toFormInput(profile: Profile): ProfileFormInput {
  return {
    sex: profile.sex,
    age: String(profile.age),
    heightCm: String(profile.heightCm),
    weightKg: String(profile.weightKg),
    activityLevel: profile.activityLevel,
    dietGoal: profile.dietGoal,
    targetWeightKg: profile.targetWeightKg != null ? String(profile.targetWeightKg) : '',
    goalDurationDays: profile.goalDurationDays,
    goalStartDate: profile.goalStartDate,
  }
}

function emptyForm(startDate: string): ProfileFormInput {
  return {
    sex: '',
    age: '',
    heightCm: '',
    weightKg: '',
    activityLevel: '',
    dietGoal: 'lose',
    targetWeightKg: '',
    goalDurationDays: null,
    goalStartDate: startDate,
  }
}

export function ProfilePage({ onSaved }: Props) {
  const today = useMemo(() => todayKey(), [])
  const [saved, setSaved] = useState<Profile | null>(() => loadProfile())
  const [form, setForm] = useState<ProfileFormInput>(() => {
    const profile = loadProfile()
    return profile ? toFormInput(profile) : emptyForm(today)
  })
  const [errors, setErrors] = useState<ProfileFieldErrors>({})
  const [savedNotice, setSavedNotice] = useState<string | null>(null)

  const isMaintain = form.dietGoal === 'maintain'

  /**
   * 목표 자체(식단 목표·목표 체중·기간)를 바꾸면 새 목표로 보고 시작일을 오늘로
   * 되돌린다. 몸무게만 바꾼 경우에는 기존 시작일을 유지해야 남은 기간 기준
   * 재계산이 성립한다 (명세 196줄 — "목표 체중·기간 자체는 사용자가 바꾸지 않는
   * 한 유지한다").
   */
  const goalStartDate = useMemo(() => {
    if (!saved) return today

    const goalChanged =
      saved.dietGoal !== form.dietGoal ||
      saved.targetWeightKg !== (isMaintain ? null : Number(form.targetWeightKg)) ||
      saved.goalDurationDays !== (isMaintain ? null : form.goalDurationDays)

    return goalChanged ? today : saved.goalStartDate
  }, [saved, form.dietGoal, form.targetWeightKg, form.goalDurationDays, isMaintain, today])

  // 매 렌더마다 새 객체를 만들면 아래 useMemo가 무의미해진다
  const candidate = useMemo<ProfileFormInput>(
    () => ({ ...form, goalStartDate }),
    [form, goalStartDate],
  )
  const { profile: validProfile } = useMemo(() => validateProfileForm(candidate), [candidate])

  // 명세 183줄 — 값이 유효해지는 즉시 계산 근거를 보여준다
  const targets = useMemo(
    () => (validProfile ? calcAllTargets(validProfile) : null),
    [validProfile],
  )

  function update<K extends keyof ProfileFormInput>(field: K, value: ProfileFormInput[K]) {
    setForm((prev) => ({ ...prev, [field]: value }))
    setSavedNotice(null)
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()

    const result = validateProfileForm(candidate)
    setErrors(result.errors)
    if (!result.profile) return

    saveProfile(result.profile)
    setSaved(result.profile)
    setSavedNotice(
      saved
        ? '목표를 다시 계산했습니다. 식단 기록의 잔여 칼로리에 바로 반영됩니다.'
        : '목표를 저장했습니다. 이제 식단 기록에서 잔여 칼로리를 볼 수 있습니다.',
    )
    onSaved?.()
  }

  return (
    <div className="profile-page">
      <header className="profile-header">
        <h1>프로필 및 목표 설정</h1>
        <p>
          여기서 나온 <strong>기본 목표 칼로리</strong>가 식단 기록과 추천의 기준이 됩니다.
        </p>
      </header>

      <form className="profile-form" onSubmit={handleSubmit} noValidate>
        <fieldset className="form-group">
          <legend>신체 정보</legend>

          <FieldGroup label="성별" error={errors.sex}>
            <div className="choice-row" role="group" aria-label="성별 선택">
              {SEX_ORDER.map((sex) => (
                <button
                  key={sex}
                  type="button"
                  className={form.sex === sex ? 'choice active' : 'choice'}
                  aria-pressed={form.sex === sex}
                  onClick={() => update('sex', sex satisfies Sex)}
                >
                  {SEX_LABELS[sex]}
                </button>
              ))}
            </div>
          </FieldGroup>

          <div className="body-row">
            <Field label={`나이 (${INPUT_RANGES.age.min}~${INPUT_RANGES.age.max}세)`} error={errors.age}>
              <input
                type="number"
                className="text-input"
                inputMode="numeric"
                step="any"
                min={0}
                value={form.age}
                onChange={(event) => update('age', event.target.value)}
              />
            </Field>
            <Field label="키 (cm)" error={errors.heightCm}>
              <input
                type="number"
                className="text-input"
                inputMode="decimal"
                step="any"
                min={0}
                value={form.heightCm}
                onChange={(event) => update('heightCm', event.target.value)}
              />
            </Field>
            <Field label="몸무게 (kg)" error={errors.weightKg}>
              <input
                type="number"
                className="text-input"
                inputMode="decimal"
                step="any"
                min={0}
                value={form.weightKg}
                onChange={(event) => update('weightKg', event.target.value)}
              />
            </Field>
          </div>
        </fieldset>

        <fieldset className="form-group">
          <legend>활동 수준</legend>
          {/* 명세 189줄이 요구하는 안내 문구 */}
          <p className="form-hint">운동은 따로 기록하니 여기서는 빼고 골라주세요.</p>

          <div className="activity-list" role="radiogroup" aria-label="활동 수준">
            {ACTIVITY_ORDER.map((level) => (
              <button
                key={level}
                type="button"
                role="radio"
                aria-checked={form.activityLevel === level}
                className={form.activityLevel === level ? 'activity active' : 'activity'}
                onClick={() => update('activityLevel', level satisfies ActivityLevel)}
              >
                {ACTIVITY_LABELS[level]}
              </button>
            ))}
          </div>
          {errors.activityLevel && <span className="field-error">{errors.activityLevel}</span>}
        </fieldset>

        <fieldset className="form-group">
          <legend>식단 목표</legend>

          <div className="choice-row" role="group" aria-label="식단 목표 선택">
            {DIET_GOAL_ORDER.map((goal) => (
              <button
                key={goal}
                type="button"
                className={form.dietGoal === goal ? 'choice active' : 'choice'}
                aria-pressed={form.dietGoal === goal}
                onClick={() => update('dietGoal', goal satisfies DietGoal)}
              >
                {DIET_GOAL_LABELS[goal]}
              </button>
            ))}
          </div>

          {/* 유지 목표는 목표 체중·기간을 입력받지 않는다 (명세 99줄) */}
          {isMaintain ? (
            <p className="form-hint">
              유지 목표는 목표 체중과 기간을 받지 않습니다. 기본 목표 칼로리가 TDEE와 같아집니다.
            </p>
          ) : (
            <>
              <Field label="목표 체중 (kg)" error={errors.targetWeightKg}>
                <input
                  type="number"
                  className="text-input"
                  inputMode="decimal"
                  step="any"
                  min={0}
                  value={form.targetWeightKg}
                  onChange={(event) => update('targetWeightKg', event.target.value)}
                />
              </Field>

              <GoalPeriodInput
                startDate={goalStartDate}
                value={form.goalDurationDays}
                onChange={(days) => update('goalDurationDays', days)}
                error={errors.goalDurationDays}
              />
            </>
          )}
        </fieldset>

        {/* 명세 192줄 — 필수 항목 미입력 시 계산 불가 */}
        <button type="submit" className="primary-button" disabled={validProfile === null}>
          {saved ? '목표 다시 저장' : '목표 저장'}
        </button>

        {savedNotice && <p className="saved-notice">{savedNotice}</p>}
      </form>

      {targets ? (
        <TargetBreakdown targets={targets} />
      ) : (
        <p className="form-hint center">
          모든 항목을 채우면 BMR · TDEE · 기본 목표 칼로리를 계산해 보여드립니다.
        </p>
      )}
    </div>
  )
}
