/**
 * 목표 기간 입력 — 명세 100줄.
 *
 * "주 수 또는 목표 날짜 … 둘 중 하나를 입력하면 나머지를 환산해 함께 보여줌"
 *
 * 정본은 일수다. 주 수를 넣으면 ×7로 환산하므로 12주 → 84일이 되어 명세 계산
 * 예시 ㉮와 일치한다.
 */

import { useState } from 'react'
import { DAYS_PER_WEEK } from '../../domain/profileConstants'
import { isValidDateKey, shiftDateKey } from '../../domain/date'
import { Field } from '../diet/Field'

type Props = {
  /** 목표 시작일 ('YYYY-MM-DD') */
  startDate: string
  /** 목표 기간(일). 미입력이면 null */
  value: number | null
  onChange: (durationDays: number | null) => void
  error?: string | undefined
}

function daysToWeeksText(days: number): string {
  return String(Math.round((days / DAYS_PER_WEEK) * 10) / 10)
}

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

  const canShift = isValidDateKey(startDate)
  const dateValue = canShift && value != null ? shiftDateKey(startDate, value) : ''
  const minDate = canShift ? shiftDateKey(startDate, 1) : undefined

  function handleWeeks(text: string) {
    setWeeksText(text)

    const weeks = Number(text)
    if (text.trim() === '' || !Number.isFinite(weeks) || weeks <= 0) {
      onChange(null)
      return
    }
    onChange(Math.round(weeks * DAYS_PER_WEEK))
  }

  function handleDate(text: string) {
    if (text === '' || !canShift || !isValidDateKey(text)) {
      onChange(null)
      return
    }

    // 시작일로부터 며칠 뒤인지 세어 일수로 되돌린다
    const days = Math.round(
      (new Date(text).getTime() - new Date(startDate).getTime()) / 86_400_000,
    )
    onChange(days > 0 ? days : null)
  }

  return (
    <div className="goal-period">
      <div className="goal-period-row">
        <Field label="목표 기간 (주)">
          <input
            type="number"
            className="text-input"
            inputMode="decimal"
            min={0}
            step="any"
            value={weeksText}
            onChange={(event) => handleWeeks(event.target.value)}
            placeholder="예: 12"
          />
        </Field>
        <Field label="또는 목표 날짜">
          <input
            type="date"
            className="text-input"
            value={dateValue}
            min={minDate}
            onChange={(event) => handleDate(event.target.value)}
          />
        </Field>
      </div>

      {value != null && (
        <p className="form-hint">
          {daysToWeeksText(value)}주 = <strong>{value}일</strong>
          {dateValue !== '' && ` · ${dateValue} 목표`}
        </p>
      )}
      {error && <span className="field-error">{error}</span>}
    </div>
  )
}
