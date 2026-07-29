/**
 * F2. 하루 식단 기록 — 화면 전체.
 *
 * 날짜 헤더 + 끼니 4섹션 + 하단 요약바. 기록 추가·수정은 같은 시트를 재사용하고,
 * `initial`이 있으면 수정 모드가 된다.
 */

import { useState } from 'react'
import type { Amount, MealEntry, MealSlot } from '../../domain/types'
import { formatKcal } from '../../domain/nutrition'
import { formatDateLabel, formatRelativeDateLabel, todayKey } from '../../domain/date'
import { useDietLog } from './useDietLog'
import { SlotCard } from './SlotCard'
import { FoodPickerSheet } from './FoodPickerSheet'
import { DaySummaryBar } from './DaySummaryBar'
import { TempTargetDialog } from './TempTargetDialog'
import './diet.css'

/** 열린 시트의 상태. `entry`가 있으면 수정, 없으면 새 기록 */
type SheetState = { slot: MealSlot; entry?: MealEntry }

export function DietLogPage() {
  const {
    repo,
    date,
    goToDate,
    shiftDate,
    summary,
    target,
    remaining,
    foods,
    addEntry,
    updateEntry,
    deleteEntry,
    addCustomFood,
    changeTarget,
  } = useDietLog()

  const [sheet, setSheet] = useState<SheetState | null>(null)
  const [showTargetDialog, setShowTargetDialog] = useState(false)

  const isToday = date === todayKey()

  function handleSubmit(foodId: string, amount: Amount) {
    if (!sheet) return

    if (sheet.entry) {
      updateEntry(sheet.entry.id, { foodId, amount })
    } else {
      addEntry({ date, slot: sheet.slot, foodId, amount })
    }
    setSheet(null)
  }

  function handleDelete(entry: MealEntry) {
    if (confirm(`'${entry.foodName}' 기록을 삭제할까요?`)) {
      deleteEntry(entry.id)
    }
  }

  // 수정 모드로 시트를 열 때 넘길 초기값. 음식이 삭제됐으면 검색부터 다시 시작한다.
  const initial = (() => {
    if (!sheet?.entry) return undefined

    const food = repo.getFood(sheet.entry.foodId)
    return food ? { food, amount: sheet.entry.amount } : undefined
  })()

  return (
    <div className="diet-page">
      <header className="date-header">
        <button type="button" className="icon-button" onClick={() => shiftDate(-1)} aria-label="이전 날짜">
          ‹
        </button>

        <div className="date-title">
          <strong>{formatRelativeDateLabel(date)}</strong>
          <span>{formatDateLabel(date)}</span>
        </div>

        <button type="button" className="icon-button" onClick={() => shiftDate(1)} aria-label="다음 날짜">
          ›
        </button>
      </header>

      {!isToday && (
        <button type="button" className="text-button center" onClick={() => goToDate(todayKey())}>
          오늘로 이동
        </button>
      )}

      <main className="slot-list">
        {summary.bySlot.map((slotSummary) => (
          <SlotCard
            key={slotSummary.slot}
            summary={slotSummary}
            onAdd={() => setSheet({ slot: slotSummary.slot })}
            onEdit={(entry) => setSheet({ slot: entry.slot, entry })}
            onDelete={handleDelete}
          />
        ))}

        <p className="day-total-note">
          {formatRelativeDateLabel(date)} 총 {formatKcal(summary.total.kcal)} kcal
        </p>
      </main>

      <DaySummaryBar
        total={summary.total}
        target={target}
        remaining={remaining}
        onOpenTargetDialog={() => setShowTargetDialog(true)}
      />

      {sheet && (
        <FoodPickerSheet
          foods={foods}
          slot={sheet.slot}
          initial={initial}
          onSubmit={handleSubmit}
          onAddCustomFood={addCustomFood}
          onClose={() => setSheet(null)}
        />
      )}

      {showTargetDialog && (
        <TempTargetDialog
          current={target}
          onSave={(next) => {
            changeTarget(next)
            setShowTargetDialog(false)
          }}
          onClose={() => setShowTargetDialog(false)}
        />
      )}
    </div>
  )
}
