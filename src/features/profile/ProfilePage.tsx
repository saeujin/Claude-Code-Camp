// F1. 사용자 프로필 및 목표 설정
// 계약: .claude/skills/f1-profile/SKILL.md
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../app/AuthContext'
import { useDay } from '../../app/DayContext'
import { Button, Card, Field, Formula, Notice, Stat, inputClass } from '../../components/ui'
import { profileRepo } from '../../db/repositories'
import { buildGoalPlan } from '../../domain/calc'
import { ACTIVITY_LEVELS, GOAL_LABEL, INPUT_RANGE } from '../../domain/constants'
import type { ActivityLevel, DietGoal, Profile, Sex } from '../../domain/types'
import { addWeeks, diffDays, todayKey } from '../../lib/date'
import { dateLabel, gram, kcal, num, rate } from '../../lib/format'

interface FormState {
  sex: Sex
  age: string
  heightCm: string
  weightKg: string
  activityLevel: ActivityLevel
  goal: DietGoal
  targetWeightKg: string
  periodMode: 'weeks' | 'date'
  weeks: string
  targetDate: string
}

export default function ProfilePage() {
  const { user } = useAuth()
  const { profile, setProfile, reload } = useDay()
  const navigate = useNavigate()
  const today = todayKey()

  const [form, setForm] = useState<FormState>(() => ({
    sex: profile?.sex ?? 'male',
    age: profile ? String(profile.age) : '',
    heightCm: profile ? String(profile.heightCm) : '',
    weightKg: profile ? String(profile.weightKg) : '',
    activityLevel: profile?.activityLevel ?? 1.2,
    goal: profile?.goal ?? 'lose',
    targetWeightKg: profile?.targetWeightKg ? String(profile.targetWeightKg) : '',
    periodMode: 'weeks',
    weeks: profile?.targetDate ? String(Math.round(diffDays(today, profile.targetDate) / 7)) : '12',
    targetDate: profile?.targetDate ?? addWeeks(today, 12),
  }))
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  const needsGoalFields = form.goal !== 'maintain'

  // 주 수 ↔ 날짜는 하나만 입력받고 나머지를 환산해 함께 보여준다 (명세 100행)
  const resolvedTargetDate = useMemo(() => {
    if (!needsGoalFields) return null
    if (form.periodMode === 'date') return form.targetDate || null
    const w = Number(form.weeks)
    return Number.isFinite(w) && w > 0 ? addWeeks(today, w) : null
  }, [form.periodMode, form.weeks, form.targetDate, needsGoalFields, today])

  const resolvedWeeks = useMemo(() => {
    if (!resolvedTargetDate) return null
    return Math.round((diffDays(today, resolvedTargetDate) / 7) * 10) / 10
  }, [resolvedTargetDate, today])

  const errors = validate(form, needsGoalFields, resolvedTargetDate, today)
  const complete = Object.keys(errors).length === 0

  const candidate: Profile | null = useMemo(() => {
    if (!complete || !user) return null
    return {
      userId: user.id,
      sex: form.sex,
      age: Number(form.age),
      heightCm: Number(form.heightCm),
      weightKg: Number(form.weightKg),
      activityLevel: form.activityLevel,
      goal: form.goal,
      targetWeightKg: needsGoalFields ? Number(form.targetWeightKg) : null,
      targetDate: needsGoalFields ? resolvedTargetDate : null,
      startedOn: profile?.startedOn ?? today,
      startWeightKg: profile?.startWeightKg ?? Number(form.weightKg),
    }
  }, [complete, user, form, needsGoalFields, resolvedTargetDate, profile, today])

  const plan = candidate ? buildGoalPlan(candidate, today) : null

  async function save() {
    if (!candidate || !user) return
    setSaving(true)
    setSaveError(null)
    try {
      const { userId: _ignored, ...rest } = candidate
      const saved = await profileRepo.upsert(user.id, rest)
      setProfile(saved)
      await reload()
      navigate('/')
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : '저장하지 못했습니다')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-bold">프로필 · 목표 설정</h1>
        <p className="mt-1 text-sm text-sub">
          여기서 나온 기본 목표 칼로리가 나머지 모든 기능의 기준이 됩니다.
        </p>
      </header>

      <Card title="신체 정보">
        <div className="space-y-3">
          <Field label="성별">
            <div className="flex gap-2">
              {(['male', 'female'] as Sex[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => set('sex', s)}
                  className={`flex-1 rounded-[12px] border px-3 py-2.5 text-sm ${
                    form.sex === s ? 'border-accent bg-accent-soft font-semibold' : 'border-line'
                  }`}
                >
                  {s === 'male' ? '남' : '여'}
                </button>
              ))}
            </div>
          </Field>

          <div className="grid grid-cols-3 gap-2">
            <Field label="나이" error={errors.age}>
              <input
                type="number"
                inputMode="numeric"
                className={inputClass}
                value={form.age}
                onChange={(e) => set('age', e.target.value)}
              />
            </Field>
            <Field label="키 (cm)" error={errors.heightCm}>
              <input
                type="number"
                inputMode="decimal"
                className={inputClass}
                value={form.heightCm}
                onChange={(e) => set('heightCm', e.target.value)}
              />
            </Field>
            <Field label="몸무게 (kg)" error={errors.weightKg}>
              <input
                type="number"
                inputMode="decimal"
                className={inputClass}
                value={form.weightKg}
                onChange={(e) => set('weightKg', e.target.value)}
              />
            </Field>
          </div>
        </div>
      </Card>

      <Card title="활동 수준">
        <div className="space-y-2">
          {ACTIVITY_LEVELS.map((a) => (
            <button
              key={a.value}
              type="button"
              onClick={() => set('activityLevel', a.value)}
              className={`w-full rounded-[12px] border px-3 py-2.5 text-left text-sm ${
                form.activityLevel === a.value
                  ? 'border-accent bg-accent-soft'
                  : 'border-line bg-card'
              }`}
            >
              <div className="font-medium">{a.label}</div>
              <div className="text-xs text-sub">
                {a.hint} · 계수 {a.value}
              </div>
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-sub">운동은 따로 기록하니 여기서는 빼고 골라주세요.</p>
      </Card>

      <Card title="목표">
        <div className="space-y-3">
          <Field label="식단 목표">
            <div className="flex gap-2">
              {(['lose', 'maintain', 'gain'] as DietGoal[]).map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => set('goal', g)}
                  className={`flex-1 rounded-[12px] border px-3 py-2.5 text-sm ${
                    form.goal === g ? 'border-accent bg-accent-soft font-semibold' : 'border-line'
                  }`}
                >
                  {GOAL_LABEL[g]}
                </button>
              ))}
            </div>
          </Field>

          {needsGoalFields && (
            <>
              <Field label="목표 체중 (kg)" error={errors.targetWeightKg}>
                <input
                  type="number"
                  inputMode="decimal"
                  className={inputClass}
                  value={form.targetWeightKg}
                  onChange={(e) => set('targetWeightKg', e.target.value)}
                />
              </Field>

              <Field label="목표 기간" error={errors.period}>
                <div className="mb-2 flex gap-2">
                  {(['weeks', 'date'] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => set('periodMode', m)}
                      className={`flex-1 rounded-[12px] border px-3 py-2 text-xs ${
                        form.periodMode === m ? 'border-accent bg-accent-soft' : 'border-line'
                      }`}
                    >
                      {m === 'weeks' ? '주 수로 입력' : '날짜로 입력'}
                    </button>
                  ))}
                </div>
                {form.periodMode === 'weeks' ? (
                  <input
                    type="number"
                    inputMode="numeric"
                    placeholder="예: 12"
                    className={inputClass}
                    value={form.weeks}
                    onChange={(e) => set('weeks', e.target.value)}
                  />
                ) : (
                  <input
                    type="date"
                    min={today}
                    className={inputClass}
                    value={form.targetDate}
                    onChange={(e) => set('targetDate', e.target.value)}
                  />
                )}
                {resolvedTargetDate && resolvedWeeks !== null && (
                  <span className="mt-1 block text-xs text-sub">
                    {resolvedWeeks}주 · 목표일 {dateLabel(resolvedTargetDate)}
                  </span>
                )}
              </Field>
            </>
          )}
        </div>
      </Card>

      {plan && (
        <Card title="계산 결과">
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              <Stat label="기초대사량" value={num(plan.bmr)} unit="kcal" tone="sub" />
              <Stat label="하루 소비량" value={num(plan.tdee)} unit="kcal" tone="sub" />
              <Stat label="기본 목표" value={num(plan.baseTarget)} unit="kcal" tone="accent" />
            </div>

            <Formula>
              {plan.bmrRaw.toFixed(2)} × {form.activityLevel} = {num(plan.tdee)} kcal
              {plan.dailyAdjustment > 0 &&
                ` · ${num(plan.tdee)} ${form.goal === 'lose' ? '−' : '+'} ${num(
                  plan.dailyAdjustment,
                )} = ${num(plan.baseTarget)} kcal`}
            </Formula>

            {plan.dailyAdjustment > 0 && candidate?.targetWeightKg != null && (
              <Notice tone="info">
                {Math.abs(candidate.targetWeightKg - candidate.weightKg).toFixed(1)}kg을{' '}
                {resolvedWeeks}주에 {form.goal === 'lose' ? '빼려면' : '찌우려면'} 하루{' '}
                {num(plan.dailyAdjustment)} kcal를 {form.goal === 'lose' ? '덜' : '더'} 드셔야
                해요. 주당 {rate(plan.weeklyRateKg)} 속도예요.
              </Notice>
            )}

            {plan.targetDate && (
              <p className="text-sm">
                목표 달성 예정일 <strong>{dateLabel(plan.targetDate)}</strong>
              </p>
            )}

            <div>
              <div className="mb-1 text-xs text-sub">목표 탄단지</div>
              <div className="tnum text-sm">
                탄수화물 {gram(plan.macros.carbG)} · 단백질 {gram(plan.macros.proteinG)} · 지방{' '}
                {gram(plan.macros.fatG)}
              </div>
            </div>

            {plan.belowBmr && (
              <Notice tone="caution">
                이 목표는 기초대사량({kcal(plan.bmr)})보다 낮아요. 기간을 늘리거나 운동을 병행하는
                걸 고려해보세요. 목표 값 자체는 바꾸지 않습니다.
              </Notice>
            )}

            {plan.baseTarget <= 0 && (
              <Notice tone="caution">
                목표가 0 kcal 이하로 계산됐어요. 기간이 너무 짧지 않은지 확인해주세요. 앱은 값을
                임의로 올리지 않습니다.
              </Notice>
            )}
          </div>
        </Card>
      )}

      {saveError && <Notice tone="caution">{saveError}</Notice>}

      <Button onClick={save} disabled={!complete || saving} className="w-full">
        {saving ? '저장 중…' : '저장하고 시작하기'}
      </Button>

      <p className="pb-2 text-center text-xs text-sub">
        임신·수유·질환 등 특수 상황은 이 공식이 다루지 않습니다. 의료 상담을 우선하세요.
      </p>
    </div>
  )
}

function validate(
  f: FormState,
  needsGoalFields: boolean,
  targetDate: string | null,
  today: string,
): Record<string, string> {
  const e: Record<string, string> = {}
  const age = Number(f.age)
  const h = Number(f.heightCm)
  const w = Number(f.weightKg)

  if (!f.age) e.age = '필수'
  else if (age < INPUT_RANGE.age.min || age > INPUT_RANGE.age.max)
    e.age = `${INPUT_RANGE.age.min}~${INPUT_RANGE.age.max}세`

  if (!f.heightCm) e.heightCm = '필수'
  else if (h < INPUT_RANGE.heightCm.min || h > INPUT_RANGE.heightCm.max)
    e.heightCm = `${INPUT_RANGE.heightCm.min}~${INPUT_RANGE.heightCm.max}cm`

  if (!f.weightKg) e.weightKg = '필수'
  else if (w < INPUT_RANGE.weightKg.min || w > INPUT_RANGE.weightKg.max)
    e.weightKg = `${INPUT_RANGE.weightKg.min}~${INPUT_RANGE.weightKg.max}kg`

  if (needsGoalFields) {
    const t = Number(f.targetWeightKg)
    if (!f.targetWeightKg) e.targetWeightKg = '필수'
    else if (t < INPUT_RANGE.weightKg.min || t > INPUT_RANGE.weightKg.max)
      e.targetWeightKg = `${INPUT_RANGE.weightKg.min}~${INPUT_RANGE.weightKg.max}kg`

    if (!targetDate) e.period = '필수'
    else if (diffDays(today, targetDate) <= 0) e.period = '오늘 이후로 정해주세요'
  }

  return e
}
