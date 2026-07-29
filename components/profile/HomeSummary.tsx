'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { calcAllTargets } from '@/lib/nutrition/calculate'
import { useHydrated, useProfile } from '@/lib/profile/useProfile'

/**
 * 홈에서 보여주는 프로필 요약.
 *
 * 프로필이 없으면 설정으로 유도한다 (명세서 §F5·§F7: "F1 미완료 시 프로필 설정으로 유도").
 */
export function HomeSummary() {
  const hydrated = useHydrated()
  const profile = useProfile()
  const targets = useMemo(
    () => (profile ? calcAllTargets(profile) : null),
    [profile],
  )

  if (!hydrated) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <p className="text-sm text-slate-500">불러오는 중…</p>
      </div>
    )
  }

  if (!profile || !targets) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-5 text-center">
        <p className="text-slate-700">아직 프로필이 없어요.</p>
        <p className="mt-1 text-sm text-slate-500">
          신체 정보를 입력하면 하루에 몇 kcal를 먹어야 하는지 계산해드려요.
        </p>
        <Link
          href="/profile"
          className="mt-4 inline-block rounded-xl bg-sky-600 px-5 py-3 font-medium text-white transition hover:bg-sky-700"
        >
          프로필 설정하기
        </Link>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-medium text-slate-700">기본 목표 칼로리</h2>
        <Link href="/profile" className="text-sm text-sky-700 hover:underline">
          수정
        </Link>
      </div>

      <p className="tabular mt-1 text-3xl font-bold text-sky-700">
        {targets.baseTargetCalories.toLocaleString('ko-KR')}
        <span className="ml-1 text-base font-medium text-slate-500">kcal</span>
      </p>

      <dl className="tabular mt-4 grid grid-cols-3 gap-3 border-t border-slate-100 pt-3 text-sm">
        <div>
          <dt className="text-xs text-slate-500">탄수화물</dt>
          <dd className="font-medium text-slate-900">{targets.macros.carbsG} g</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">단백질</dt>
          <dd className="font-medium text-slate-900">{targets.macros.proteinG} g</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">지방</dt>
          <dd className="font-medium text-slate-900">{targets.macros.fatG} g</dd>
        </div>
      </dl>

      {targets.effectiveGoal !== 'maintain' && targets.remainingDays != null && (
        <p className="tabular mt-3 border-t border-slate-100 pt-3 text-sm text-slate-600">
          {profile.weightKg}kg → {profile.targetWeightKg}kg · 남은 기간{' '}
          {targets.remainingDays}일
        </p>
      )}
    </div>
  )
}
