/**
 * F2 화면 상태.
 *
 * 누적값을 state로 들고 있지 않다는 점이 핵심이다. 기록 목록만 state에 두고
 * 집계는 매 렌더에서 `summarizeDay`로 파생한다. 그래서 기록을 수정·삭제하면
 * 누적값이 자동으로 다시 계산된다 (명세 224줄).
 */

import { useCallback, useMemo, useState } from 'react'
import type { DailyTarget, MealEntry, MealEntryDraft } from '../../domain/types'
import { remainingNutrition, summarizeDay } from '../../domain/nutrition'
import { shiftDateKey, todayKey } from '../../domain/date'
import { createLocalDietRepository, type CustomFoodDraft } from '../../data/repo'
import { SEED_FOODS } from '../../data/foods'
import { readDailyTarget, writeDailyTarget } from '../target/dailyTarget'

export function useDietLog() {
  // 저장소는 한 번만 만든다. 재생성되면 localStorage를 다시 읽어 낭비다.
  const [repo] = useState(createLocalDietRepository)

  const [date, setDate] = useState(todayKey)
  const [entries, setEntries] = useState<MealEntry[]>(() => repo.listEntries())
  const [customFoods, setCustomFoods] = useState(() => repo.listCustomFoods())
  const [target, setTarget] = useState<DailyTarget | null>(readDailyTarget)

  const summary = useMemo(() => summarizeDay(entries, date), [entries, date])
  const remaining = useMemo(() => remainingNutrition(summary.total, target), [summary.total, target])

  /**
   * 검색 대상 목록. 개인 음식을 앞에 둔다 — 직접 등록한 음식이 먼저 잡히는 게
   * 자연스럽다. `customFoods`가 유일한 의존성이라 개인 음식을 추가하면 목록이
   * 새 배열이 되고 검색 결과도 자연히 다시 계산된다.
   */
  const foods = useMemo(() => [...customFoods, ...SEED_FOODS], [customFoods])

  const addEntry = useCallback(
    (draft: MealEntryDraft) => {
      repo.addEntry(draft)
      setEntries(repo.listEntries())
    },
    [repo],
  )

  const updateEntry = useCallback(
    (entryId: string, patch: Partial<MealEntryDraft>) => {
      repo.updateEntry(entryId, patch)
      setEntries(repo.listEntries())
    },
    [repo],
  )

  const deleteEntry = useCallback(
    (entryId: string) => {
      repo.deleteEntry(entryId)
      setEntries(repo.listEntries())
    },
    [repo],
  )

  const addCustomFood = useCallback(
    (draft: CustomFoodDraft) => {
      const food = repo.addCustomFood(draft)
      setCustomFoods(repo.listCustomFoods())
      return food
    },
    [repo],
  )

  const changeTarget = useCallback((next: DailyTarget | null) => {
    writeDailyTarget(next)
    setTarget(next)
  }, [])

  const goToDate = useCallback((next: string) => setDate(next), [])
  const shiftDate = useCallback((days: number) => setDate((prev) => shiftDateKey(prev, days)), [])

  return {
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
  }
}
