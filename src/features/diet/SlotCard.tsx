/**
 * 끼니 1개 카드 — 명세 219줄 "끼니별 기록 목록".
 *
 * 소계는 `SlotSummary.subtotal`을 그대로 쓴다. 이 값은 `summarizeDay`가 매번
 * 파생 계산한 것이라 기록을 지우면 별도 처리 없이 즉시 반영된다.
 */

import type { MealEntry, SlotSummary } from '../../domain/types'
import { MEAL_SLOT_LABEL } from '../../domain/types'
import { formatGram, formatKcal } from '../../domain/nutrition'

type Props = {
  summary: SlotSummary
  onAdd: () => void
  onEdit: (entry: MealEntry) => void
  onDelete: (entry: MealEntry) => void
}

/** 섭취량을 사람이 읽는 형태로. 인분은 소수점을 남기고 g은 정수로 */
function formatAmount(entry: MealEntry): string {
  const { unit, value } = entry.amount
  if (unit === 'g') return `${Math.round(value)}g`

  // 1.5인분처럼 소수가 의미 있으므로 불필요한 0만 떼어낸다
  return `${Number(value.toFixed(2))}인분`
}

export function SlotCard({ summary, onAdd, onEdit, onDelete }: Props) {
  const { slot, entries, subtotal } = summary
  const label = MEAL_SLOT_LABEL[slot]

  return (
    <section className="slot-card">
      <header className="slot-header">
        <h2>{label}</h2>
        <span className="slot-subtotal">
          {entries.length === 0 ? '기록 없음' : `${formatKcal(subtotal.kcal)} kcal`}
        </span>
      </header>

      {entries.length > 0 && (
        <ul className="entry-list">
          {entries.map((entry) => (
            <li key={entry.id} className="entry-row">
              <button
                type="button"
                className="entry-main"
                onClick={() => onEdit(entry)}
                aria-label={`${entry.foodName} 기록 수정`}
              >
                <span className="entry-name">{entry.foodName}</span>
                <span className="entry-meta">
                  {formatAmount(entry)} · 탄 {formatGram(entry.nutrition.carb)}g / 단{' '}
                  {formatGram(entry.nutrition.protein)}g / 지 {formatGram(entry.nutrition.fat)}g
                </span>
              </button>
              <span className="entry-kcal">{formatKcal(entry.nutrition.kcal)}</span>
              <button
                type="button"
                className="icon-button danger"
                onClick={() => onDelete(entry)}
                aria-label={`${entry.foodName} 기록 삭제`}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      <button type="button" className="add-button" onClick={onAdd}>
        + {label} 추가
      </button>
    </section>
  )
}
