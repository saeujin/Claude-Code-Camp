'use client'

import { DAYS_PER_WEEK } from '@/lib/nutrition/constants'
import type { Profile, Targets } from '@/lib/nutrition/types'

interface Props {
  profile: Profile
  targets: Targets
}

const kcal = (n: number) => `${Math.round(n).toLocaleString('ko-KR')} kcal`

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${y}년 ${Number(m)}월 ${Number(d)}일`
}

/**
 * 계산 결과 — 명세서 §F1 "출력"
 *
 * BMR → TDEE → 기본 목표를 단계별로 노출한다.
 * 사용자가 자기 목표 칼로리가 어디서 나왔는지 이해할 수 있어야 한다.
 */
export function ResultBreakdown({ profile, targets }: Props) {
  const {
    bmr,
    tdee,
    dailyAdjustmentKcal,
    baseTargetCalories,
    effectiveGoal,
    weeklyRateKg,
    targetDate,
    remainingDays,
    notices,
  } = targets

  const changeKg =
    profile.targetWeightKg != null
      ? Math.abs(profile.targetWeightKg - profile.weightKg)
      : 0
  const weeks =
    remainingDays != null && remainingDays > 0
      ? Math.round((remainingDays / DAYS_PER_WEEK) * 10) / 10
      : profile.goalDurationDays != null
        ? Math.round((profile.goalDurationDays / DAYS_PER_WEEK) * 10) / 10
        : 0

  return (
    <section className="space-y-4">
      {/* 단계별 계산 근거 */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-medium text-slate-700">계산 과정</h2>

        <ol className="mt-3 space-y-3">
          <li className="flex items-baseline justify-between gap-3">
            <span className="text-sm text-slate-600">
              기초대사량 <span className="text-xs text-slate-400">BMR</span>
            </span>
            <span className="tabular text-lg font-semibold text-slate-900">
              {kcal(bmr)}
            </span>
          </li>

          <li className="flex items-baseline justify-between gap-3">
            <span className="text-sm text-slate-600">
              하루 소비량 <span className="text-xs text-slate-400">TDEE</span>
              <span className="block text-xs text-slate-400">일상 활동 포함, 운동 제외</span>
            </span>
            <span className="tabular text-lg font-semibold text-slate-900">
              {kcal(tdee)}
            </span>
          </li>

          {effectiveGoal !== 'maintain' && (
            <li className="flex items-baseline justify-between gap-3">
              <span className="text-sm text-slate-600">
                목표에 따른 조정
                <span className="block text-xs text-slate-400">
                  {changeKg}kg × 7,700 kcal ÷ {remainingDays ?? profile.goalDurationDays}일
                </span>
              </span>
              <span className="tabular text-lg font-semibold text-slate-900">
                {effectiveGoal === 'lose' ? '−' : '+'}
                {dailyAdjustmentKcal.toLocaleString('ko-KR')} kcal
              </span>
            </li>
          )}

          <li className="flex items-baseline justify-between gap-3 border-t border-slate-200 pt-3">
            <span className="text-sm font-medium text-slate-900">기본 목표 칼로리</span>
            <span className="tabular text-2xl font-bold text-sky-700">
              {kcal(baseTargetCalories)}
            </span>
          </li>
        </ol>

        <p className="mt-3 border-t border-slate-100 pt-3 text-xs text-slate-500">
          운동을 하면 그만큼 오늘 목표가 늘어납니다. 운동 기록은 F3에서 추가될 예정입니다.
        </p>
      </div>

      {/* 목표 진행 정보 */}
      {effectiveGoal !== 'maintain' && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-medium text-slate-700">목표</h2>
          <p className="mt-2 text-slate-900">
            {changeKg}kg을 {weeks}주에{' '}
            {effectiveGoal === 'lose' ? '빼려면' : '늘리려면'} 하루{' '}
            <strong className="tabular">
              {dailyAdjustmentKcal.toLocaleString('ko-KR')} kcal
            </strong>
            를 {effectiveGoal === 'lose' ? '덜' : '더'} 드셔야 해요.
          </p>

          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-slate-500">주당 예상 변화</dt>
              <dd className="tabular font-medium text-slate-900">
                {weeklyRateKg} kg/주
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">목표 달성 예정일</dt>
              <dd className="tabular font-medium text-slate-900">
                {targetDate ? formatDate(targetDate) : '—'}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">현재 → 목표</dt>
              <dd className="tabular font-medium text-slate-900">
                {profile.weightKg}kg → {profile.targetWeightKg}kg
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">남은 기간</dt>
              <dd className="tabular font-medium text-slate-900">
                {remainingDays != null ? `${remainingDays}일` : '—'}
              </dd>
            </div>
          </dl>
        </div>
      )}

      {/* 안내 — 명세서는 이 상황들에서 값을 바꾸지 말고 알리기만 하라고 요구한다 */}
      {notices.length > 0 && (
        <div className="space-y-2">
          {notices.includes('belowBmr') && (
            <Notice tone="warn">
              이 목표는 기초대사량({kcal(bmr)})보다 낮아요. 기간을 늘리거나 운동을 병행하는
              걸 고려해보세요.
            </Notice>
          )}
          {notices.includes('nonPositiveTarget') && (
            <Notice tone="warn">
              목표 칼로리가 0 이하로 계산됐어요. 목표 체중과 기간을 다시 확인해주세요.
            </Notice>
          )}
          {notices.includes('goalWeightEqualsCurrent') && (
            <Notice tone="info">
              목표 체중이 현재 체중과 같아 유지 목표로 계산했어요.
            </Notice>
          )}
          {notices.includes('goalPeriodEnded') && (
            <Notice tone="warn">
              목표 기간이 지났어요. 달성 여부를 확인하고 새 목표를 설정해주세요. 그전까지는
              기존 목표 칼로리를 그대로 사용합니다.
            </Notice>
          )}
          {notices.includes('proteinFloorExceedsBudget') && (
            <Notice tone="warn">
              단백질 하한이 목표 칼로리를 넘어서 탄수화물이 0g으로 계산됐어요.
            </Notice>
          )}
        </div>
      )}

      <p className="text-xs text-slate-500">
        임신·수유 중이거나 질환이 있다면 이 계산식이 맞지 않을 수 있어요. 전문가와
        상의해주세요.
      </p>
    </section>
  )
}

function Notice({
  tone,
  children,
}: {
  tone: 'warn' | 'info'
  children: React.ReactNode
}) {
  const cls =
    tone === 'warn'
      ? 'border-amber-300 bg-amber-50 text-amber-900'
      : 'border-slate-300 bg-slate-100 text-slate-700'
  return <p className={`rounded-lg border p-3 text-sm ${cls}`}>{children}</p>
}
