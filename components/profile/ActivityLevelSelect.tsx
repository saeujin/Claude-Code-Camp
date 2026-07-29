'use client'

import { ACTIVITY_FACTORS, ACTIVITY_LABELS, ACTIVITY_ORDER } from '@/lib/nutrition/constants'
import type { ActivityLevel } from '@/lib/nutrition/types'

interface Props {
  value: ActivityLevel | ''
  onChange: (value: ActivityLevel) => void
  error?: string
}

/**
 * 활동 수준 선택 — 명세서 §F1 입력표 / 출력
 *
 * 안내 문구는 필수다. 이게 없으면 사용자가 운동 빈도를 여기에 반영해
 * F3의 운동 기록과 이중으로 계산된다. (§2 "활동계수와 운동을 분리하는 이유")
 */
export function ActivityLevelSelect({ value, onChange, error }: Props) {
  return (
    <fieldset>
      <legend className="text-sm font-medium text-slate-700">활동 수준</legend>
      <p className="mt-1 text-sm text-sky-700">
        운동은 따로 기록하니 여기서는 빼고 골라주세요.
      </p>

      <div className="mt-3 space-y-2">
        {ACTIVITY_ORDER.map((level) => (
          <label
            key={level}
            className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition ${
              value === level
                ? 'border-sky-500 bg-sky-50'
                : 'border-slate-200 bg-white hover:border-slate-300'
            }`}
          >
            <input
              type="radio"
              name="activityLevel"
              value={level}
              checked={value === level}
              onChange={() => onChange(level)}
              className="mt-1 size-4 accent-sky-600"
            />
            <span className="flex-1 text-sm">
              <span className="block text-slate-900">{ACTIVITY_LABELS[level]}</span>
              <span className="tabular block text-xs text-slate-500">
                활동계수 ×{ACTIVITY_FACTORS[level]}
              </span>
            </span>
          </label>
        ))}
      </div>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </fieldset>
  )
}
