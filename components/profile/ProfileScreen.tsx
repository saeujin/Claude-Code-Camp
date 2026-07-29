'use client'

import { useMemo, useState } from 'react'
import { calcAllTargets } from '@/lib/nutrition/calculate'
import { DIET_GOAL_LABELS, INPUT_RANGES, SEX_LABELS } from '@/lib/nutrition/constants'
import { toISODate } from '@/lib/nutrition/date'
import type { ActivityLevel, DietGoal, Profile, Sex, Targets } from '@/lib/nutrition/types'
import { collectFieldErrors, parseProfile } from '@/lib/profile/schema'
import { saveProfile } from '@/lib/profile/storage'
import { useHydrated, useProfile } from '@/lib/profile/useProfile'
import { ActivityLevelSelect } from './ActivityLevelSelect'
import { GoalPeriodInput } from './GoalPeriodInput'
import { MacroTargetsCard } from './MacroTargets'
import { ResultBreakdown } from './ResultBreakdown'

/** 숫자 입력은 타이핑 도중 빈 문자열이 될 수 있으므로 문자열로 들고 있는다 */
interface FormState {
  sex: Sex | ''
  age: string
  heightCm: string
  weightKg: string
  activityLevel: ActivityLevel | ''
  dietGoal: DietGoal
  targetWeightKg: string
  goalDurationDays: number | null
}

const EMPTY_FORM: FormState = {
  sex: '',
  age: '',
  heightCm: '',
  weightKg: '',
  activityLevel: '',
  dietGoal: 'lose',
  targetWeightKg: '',
  goalDurationDays: null,
}

function toForm(p: Profile): FormState {
  return {
    sex: p.sex,
    age: String(p.age),
    heightCm: String(p.heightCm),
    weightKg: String(p.weightKg),
    activityLevel: p.activityLevel,
    dietGoal: p.dietGoal,
    targetWeightKg: p.targetWeightKg != null ? String(p.targetWeightKg) : '',
    goalDurationDays: p.goalDurationDays,
  }
}

/** 폼 문자열을 Profile 후보 객체로. 검증은 zod가 한다 */
function toCandidate(form: FormState, goalStartDate: string): unknown {
  const isMaintain = form.dietGoal === 'maintain'
  const num = (s: string) => (s.trim() === '' ? undefined : Number(s))
  return {
    sex: form.sex || undefined,
    age: num(form.age),
    heightCm: num(form.heightCm),
    weightKg: num(form.weightKg),
    activityLevel: form.activityLevel || undefined,
    dietGoal: form.dietGoal,
    targetWeightKg: isMaintain ? null : (num(form.targetWeightKg) ?? null),
    goalDurationDays: isMaintain ? null : form.goalDurationDays,
    goalStartDate,
  }
}

export function ProfileScreen() {
  // 서버에는 localStorage가 없다. useSyncExternalStore가 서버 스냅샷(null)과
  // 클라이언트 스냅샷을 따로 주므로 hydration 불일치 없이 읽을 수 있다.
  const hydrated = useHydrated()
  const saved = useProfile()

  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [changeNotice, setChangeNotice] = useState<string | null>(null)

  // 저장된 프로필이 바뀌면(최초 로드, 다른 탭에서 수정) 폼을 맞춘다.
  // 렌더 중 상태 조정 — effect보다 권장되는 React 공식 패턴이다.
  const [syncedFrom, setSyncedFrom] = useState<Profile | null>(null)
  if (saved !== syncedFrom) {
    setSyncedFrom(saved)
    setForm(saved ? toForm(saved) : EMPTY_FORM)
  }

  const today = useMemo(() => new Date(), [])
  const todayIso = toISODate(today)

  const targets: Targets | null = useMemo(
    () => (saved ? calcAllTargets(saved, { today }) : null),
    [saved, today],
  )

  const isMaintain = form.dietGoal === 'maintain'

  /**
   * 목표 자체(식단 목표·목표 체중·기간)를 바꾸면 새 목표로 보고 시작일을 오늘로 되돌린다.
   * 몸무게만 바꾼 경우에는 기존 시작일을 유지해야 남은 기간 기준 재계산이 성립한다.
   * (명세서 §F1 예외: "목표 체중·기간 자체는 사용자가 바꾸지 않는 한 유지한다")
   */
  function resolveGoalStartDate(): string {
    if (!saved) return todayIso
    const goalChanged =
      saved.dietGoal !== form.dietGoal ||
      saved.targetWeightKg !== (isMaintain ? null : Number(form.targetWeightKg)) ||
      saved.goalDurationDays !== (isMaintain ? null : form.goalDurationDays)
    return goalChanged ? todayIso : saved.goalStartDate
  }

  const candidate = toCandidate(form, resolveGoalStartDate())
  const isValid = parseProfile(candidate) !== null

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const fieldErrors = collectFieldErrors(candidate)
    setErrors(fieldErrors)
    if (Object.keys(fieldErrors).length > 0) return

    const next = parseProfile(candidate)
    if (!next) return

    // 변경 사실 알림 — 명세서 §F1 예외
    // "몸무게 또는 목표 변경 시 기본 목표 칼로리를 즉시 재계산하고 변경 사실을 알림"
    if (saved && targets) {
      const nextTargets = calcAllTargets(next, { today })
      const changes: string[] = []
      if (saved.weightKg !== next.weightKg) {
        changes.push(`몸무게 ${saved.weightKg} → ${next.weightKg}kg`)
      }
      if (saved.targetWeightKg !== next.targetWeightKg) {
        changes.push(`목표 체중 ${saved.targetWeightKg ?? '없음'} → ${next.targetWeightKg ?? '없음'}kg`)
      }
      if (saved.goalDurationDays !== next.goalDurationDays) {
        changes.push(`목표 기간 ${saved.goalDurationDays ?? '없음'} → ${next.goalDurationDays ?? '없음'}일`)
      }
      if (saved.dietGoal !== next.dietGoal) {
        changes.push(`목표 ${DIET_GOAL_LABELS[saved.dietGoal]} → ${DIET_GOAL_LABELS[next.dietGoal]}`)
      }

      if (changes.length > 0 && nextTargets.baseTargetCalories !== targets.baseTargetCalories) {
        setChangeNotice(
          `${changes.join(', ')}(으)로 바뀌어 기본 목표 칼로리를 ` +
            `${targets.baseTargetCalories.toLocaleString('ko-KR')} → ` +
            `${nextTargets.baseTargetCalories.toLocaleString('ko-KR')} kcal로 다시 계산했어요.`,
        )
      } else if (changes.length > 0) {
        setChangeNotice(`${changes.join(', ')}(으)로 수정했어요.`)
      } else {
        setChangeNotice(null)
      }
    } else {
      setChangeNotice(null)
    }

    // 저장하면 useProfile()이 변경을 감지해 saved·form이 함께 갱신된다
    saveProfile(next)
  }

  if (!hydrated) {
    return <p className="text-sm text-slate-500">불러오는 중…</p>
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-medium text-slate-700">신체 정보</h2>

          <div className="mt-3 space-y-4">
            <fieldset>
              <legend className="text-sm text-slate-600">성별</legend>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {(['male', 'female'] as const).map((s) => (
                  <label
                    key={s}
                    className={`cursor-pointer rounded-lg border py-2 text-center text-sm transition ${
                      form.sex === s
                        ? 'border-sky-500 bg-sky-50 text-sky-900'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="sex"
                      className="sr-only"
                      checked={form.sex === s}
                      onChange={() => setForm({ ...form, sex: s })}
                    />
                    {SEX_LABELS[s]}
                  </label>
                ))}
              </div>
              {errors.sex && <p className="mt-1 text-sm text-red-600">{errors.sex}</p>}
            </fieldset>

            <NumberField
              label="나이"
              unit="세"
              value={form.age}
              onChange={(v) => setForm({ ...form, age: v })}
              min={INPUT_RANGES.age.min}
              max={INPUT_RANGES.age.max}
              step={1}
              placeholder="30"
              error={errors.age}
            />
            <NumberField
              label="키"
              unit="cm"
              value={form.heightCm}
              onChange={(v) => setForm({ ...form, heightCm: v })}
              min={INPUT_RANGES.heightCm.min}
              max={INPUT_RANGES.heightCm.max}
              step={0.1}
              placeholder="175"
              error={errors.heightCm}
            />
            <NumberField
              label="몸무게"
              unit="kg"
              value={form.weightKg}
              onChange={(v) => setForm({ ...form, weightKg: v })}
              min={INPUT_RANGES.weightKg.min}
              max={INPUT_RANGES.weightKg.max}
              step={0.1}
              placeholder="75"
              error={errors.weightKg}
            />
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <ActivityLevelSelect
            value={form.activityLevel}
            onChange={(v) => setForm({ ...form, activityLevel: v })}
            error={errors.activityLevel}
          />
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <fieldset>
            <legend className="text-sm font-medium text-slate-700">식단 목표</legend>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {(['lose', 'maintain', 'gain'] as const).map((g) => (
                <label
                  key={g}
                  className={`cursor-pointer rounded-lg border py-2 text-center text-sm transition ${
                    form.dietGoal === g
                      ? 'border-sky-500 bg-sky-50 text-sky-900'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="dietGoal"
                    className="sr-only"
                    checked={form.dietGoal === g}
                    onChange={() => setForm({ ...form, dietGoal: g })}
                  />
                  {DIET_GOAL_LABELS[g]}
                </label>
              ))}
            </div>
          </fieldset>

          {/* 유지 목표일 때는 목표 체중·기간을 입력받지 않는다 (명세서 §F1 입력표) */}
          {!isMaintain && (
            <div className="mt-4 space-y-4 border-t border-slate-100 pt-4">
              <NumberField
                label="목표 체중"
                unit="kg"
                value={form.targetWeightKg}
                onChange={(v) => setForm({ ...form, targetWeightKg: v })}
                min={INPUT_RANGES.targetWeightKg.min}
                max={INPUT_RANGES.targetWeightKg.max}
                step={0.1}
                placeholder={form.dietGoal === 'lose' ? '70' : '78'}
                error={errors.targetWeightKg}
              />
              <GoalPeriodInput
                startDate={resolveGoalStartDate()}
                value={form.goalDurationDays}
                onChange={(days) => setForm({ ...form, goalDurationDays: days })}
                error={errors.goalDurationDays}
              />
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={!isValid}
          className="w-full rounded-xl bg-sky-600 py-3 font-medium text-white transition enabled:hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {saved ? '다시 계산하기' : '계산하기'}
        </button>
        {!isValid && (
          <p className="text-center text-xs text-slate-500">
            필수 항목을 모두 입력하면 계산할 수 있어요.
          </p>
        )}
      </form>

      {changeNotice && (
        <p className="rounded-lg border border-sky-300 bg-sky-50 p-3 text-sm text-sky-900">
          {changeNotice}
        </p>
      )}

      {saved && targets && (
        <>
          <ResultBreakdown profile={saved} targets={targets} />
          <MacroTargetsCard macros={targets.macros} />
        </>
      )}
    </div>
  )
}

function NumberField({
  label,
  unit,
  value,
  onChange,
  min,
  max,
  step,
  placeholder,
  error,
}: {
  label: string
  unit: string
  value: string
  onChange: (v: string) => void
  min: number
  max: number
  step: number
  placeholder?: string
  error?: string
}) {
  return (
    <label className="block">
      <span className="text-sm text-slate-600">{label}</span>
      <div className="mt-1 flex items-center gap-2">
        <input
          type="number"
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          min={min}
          max={max}
          step={step}
          placeholder={placeholder}
          className="tabular w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:border-sky-500 focus:outline-none"
        />
        <span className="w-8 shrink-0 text-sm text-slate-500">{unit}</span>
      </div>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </label>
  )
}
