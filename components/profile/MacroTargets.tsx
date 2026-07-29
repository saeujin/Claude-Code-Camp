'use client'

import { KCAL_PER_GRAM } from '@/lib/nutrition/constants'
import type { MacroTargets as Macros } from '@/lib/nutrition/types'

interface Props {
  macros: Macros
}

const ROWS = [
  { key: 'carbsG', label: '탄수화물', kcalPerG: KCAL_PER_GRAM.carbs, color: 'bg-amber-400' },
  { key: 'proteinG', label: '단백질', kcalPerG: KCAL_PER_GRAM.protein, color: 'bg-rose-400' },
  { key: 'fatG', label: '지방', kcalPerG: KCAL_PER_GRAM.fat, color: 'bg-sky-400' },
] as const

/** 목표 탄·단·지 — 명세서 §F1 ④ */
export function MacroTargetsCard({ macros }: Props) {
  const totals = ROWS.map((r) => macros[r.key] * r.kcalPerG)
  const sum = totals.reduce((a, b) => a + b, 0)

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-medium text-slate-700">목표 영양소</h2>

      <div className="mt-3 space-y-3">
        {ROWS.map((row, i) => {
          const grams = macros[row.key]
          const share = sum > 0 ? (totals[i] / sum) * 100 : 0
          return (
            <div key={row.key}>
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-slate-600">{row.label}</span>
                <span className="tabular text-sm">
                  <strong className="text-slate-900">{grams} g</strong>
                  <span className="ml-2 text-xs text-slate-400">
                    {totals[i].toLocaleString('ko-KR')} kcal
                  </span>
                </span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div className={`h-full ${row.color}`} style={{ width: `${share}%` }} />
              </div>
            </div>
          )
        })}
      </div>

      {macros.proteinFloorApplied && (
        <p className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs text-slate-600">
          단백질이 하한({macros.proteinFloorG}g)에 못 미쳐 하한값으로 올렸고, 올린 만큼
          탄수화물에서 뺐어요. 감량 중 근손실을 막기 위한 조정입니다.
        </p>
      )}
    </div>
  )
}
