'use client'

import { useState } from 'react'
import { DAYS_PER_WEEK } from '@/lib/nutrition/constants'
import { addDays, daysBetween } from '@/lib/nutrition/date'

interface Props {
  /** 목표 시작일 (YYYY-MM-DD) */
  startDate: string
  /** 목표 기간(일). 미입력이면 null */
  value: number | null
  onChange: (durationDays: number | null) => void
  error?: string
}

function daysToWeeksText(days: number): string {
  const weeks = days / DAYS_PER_WEEK
  return String(Math.round(weeks * 10) / 10)
}

/**
 * 목표 기간 입력 — 명세서 §F1 입력표
 * "주 수 또는 목표 날짜 … 둘 중 하나를 입력하면 나머지를 환산해 함께 보여줌"
 *
 * 정본은 일수(durationDays)다. 주 수를 입력하면 ×7로 환산하므로
 * 12주 → 84일이 되어 명세서 계산 예시와 일치한다.
 */
export function GoalPeriodInput({ startDate, value, onChange, error }: Props) {
  const [weeksText, setWeeksText] = useState(value != null ? daysToWeeksText(value) : '')
  const [syncedValue, setSyncedValue] = useState(value)

  // 외부에서 값이 바뀌면(저장된 프로필 불러오기, 날짜 입력) 주 수 표시를 맞춘다.
  // 렌더 중 상태 조정 — effect보다 권장되는 React 공식 패턴이다.
  if (value !== syncedValue) {
    setSyncedValue(value)
    // 지금 입력 중인 주 수가 이미 이 값을 뜻한다면 건드리지 않는다.
    // ("12." 처럼 입력 도중인 문자열이 "12"로 덮어써지는 것을 막는다)
    const weeksImpliesValue =
      weeksText.trim() !== '' && Math.round(Number(weeksText) * DAYS_PER_WEEK) === value
    if (!weeksImpliesValue) {
      setWeeksText(value != null ? daysToWeeksText(value) : '')
    }
  }

  const dateValue = value != null ? (addDays(startDate, value) ?? '') : ''
  const minDate = addDays(startDate, 1) ?? undefined

  function handleWeeks(text: string) {
    setWeeksText(text)
    const n = Number(text)
    if (text.trim() === '' || !Number.isFinite(n) || n <= 0) {
      onChange(null)
      return
    }
    onChange(Math.round(n * DAYS_PER_WEEK))
  }

  function handleDate(text: string) {
    if (text === '') {
      onChange(null)
      return
    }
    const days = daysBetween(startDate, text)
    if (days == null || days <= 0) {
      onChange(null)
      return
    }
    onChange(days)
  }

  return (
    <div>
      <span className="text-sm font-medium text-slate-700">목표 기간</span>
      <p className="mt-1 text-sm text-slate-500">
        둘 중 하나만 입력하면 나머지는 자동으로 환산됩니다.
      </p>

      <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs text-slate-500">주 수</span>
          <div className="mt-1 flex items-center gap-2">
            <input
              type="number"
              inputMode="decimal"
              min={1}
              step={1}
              value={weeksText}
              onChange={(e) => handleWeeks(e.target.value)}
              placeholder="12"
              className="tabular w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:border-sky-500 focus:outline-none"
            />
            <span className="shrink-0 text-sm text-slate-500">주</span>
          </div>
        </label>

        <label className="block">
          <span className="text-xs text-slate-500">목표 날짜</span>
          <input
            type="date"
            value={dateValue}
            min={minDate}
            onChange={(e) => handleDate(e.target.value)}
            className="tabular mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:border-sky-500 focus:outline-none"
          />
        </label>
      </div>

      {value != null && (
        <p className="tabular mt-2 text-xs text-slate-500">총 {value}일</p>
      )}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  )
}
