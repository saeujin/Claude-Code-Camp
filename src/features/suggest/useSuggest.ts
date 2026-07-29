/**
 * F5 화면 상태.
 *
 * 추천 결과를 state에 두지 않는다. 저장된 기록과 프로필만 읽고 추천은 매 렌더에서
 * `recommendNextMeal`로 파생한다 — F2의 `useDietLog`가 누적값을 파생하는 방식과 같다.
 * 사용자가 끼니를 바꾸면 그것만 state이므로 결과가 자연히 다시 계산된다.
 *
 * 저장소를 읽는 시점은 마운트 한 번뿐이다. 탭을 전환하면 App이 이 화면을
 * 언마운트하므로 다시 들어올 때마다 최신 기록을 읽는다.
 */

import { useMemo, useState } from 'react'
import type { MealSlot } from '../../domain/types'
import { MEAL_SLOTS } from '../../domain/types'
import { summarizeDay } from '../../domain/nutrition'
import { todayKey } from '../../domain/date'
import { defaultSlotFor, recommendNextMeal } from '../../domain/recommend'
import { createLocalDietRepository } from '../../data/repo'
import { SEED_FOODS } from '../../data/foods'
import { readDailyTarget } from '../target/dailyTarget'

type Options = {
  /** F3 오늘 운동 소모 합계. F3가 없으므로 지금은 항상 0이다 */
  exerciseKcal?: number
  /** F3 근력 유형 기록 여부. 단백질 정렬 가중치에 쓰인다 */
  hasStrengthWorkout?: boolean
}

export function useSuggest({ exerciseKcal = 0, hasStrengthWorkout = false }: Options = {}) {
  const [repo] = useState(createLocalDietRepository)

  const [entries] = useState(() => repo.listEntries())
  const [customFoods] = useState(() => repo.listCustomFoods())

  /**
   * F1 기본 목표. **운동 소모를 더하지 않은 값을 읽는다** —
   * `recommendNextMeal`이 `exerciseKcal`을 따로 받아 더하므로, 여기서도 더하면
   * 운동분이 두 번 들어간다.
   */
  const [baseTarget] = useState(() => readDailyTarget())

  // 추천은 오늘에 대해서만 한다. "다음 식사"에 과거 날짜는 성립하지 않는다.
  const date = todayKey()
  const summary = useMemo(() => summarizeDay(entries, date), [entries, date])

  const loggedSlots = useMemo(
    () => summary.bySlot.filter((slot) => slot.entries.length > 0).map((slot) => slot.slot),
    [summary],
  )

  // 기본값만 시각에서 얻고, 이후로는 사용자의 선택이 이긴다
  const [slot, setSlot] = useState<MealSlot>(() => defaultSlotFor(new Date(), loggedSlots))

  // 개인 음식을 앞에 둔다 — F2 검색과 같은 순서다
  const foods = useMemo(() => [...customFoods, ...SEED_FOODS], [customFoods])

  const recommendation = useMemo(
    () =>
      recommendNextMeal(
        { baseTarget, exerciseKcal, hasStrengthWorkout, consumed: summary.total, slot, loggedSlots },
        foods,
      ),
    [baseTarget, exerciseKcal, hasStrengthWorkout, summary.total, slot, loggedSlots, foods],
  )

  /**
   * 네 끼니 모두 기록이 있는 상태 (명세 349줄).
   *
   * `recommendation.remainingSlotCount`로는 알 수 없다 — `remainingSlots`가 요청
   * 끼니를 언제나 포함하므로 그 값은 1보다 작아지지 않는다.
   */
  const allSlotsLogged = loggedSlots.length === MEAL_SLOTS.length

  return { date, slot, setSlot, loggedSlots, allSlotsLogged, summary, baseTarget, recommendation }
}
