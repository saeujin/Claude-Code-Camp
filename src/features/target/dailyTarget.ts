/**
 * 오늘 목표 칼로리 — F1·F3과의 경계.
 *
 * `오늘 목표 = 기본 목표 칼로리(F1) + 운동 소모 칼로리(F3)`
 * F2는 이 값을 계산하지 않는다. 목표가 없으면 `null`이고, 그때 화면은 잔여
 * 칼로리를 표시하지 않는다 (명세 226줄).
 *
 * F1이 구현되면 `readDailyTarget`이 프로필·운동 기록에서 목표를 계산하도록
 * 바뀐다. 그때까지는 아래 임시 목표를 읽는다 — F2의 잔여 칼로리 표시를 실제로
 * 확인할 수 있게 하기 위한 자리이며, F1 완성 시 이 파일만 교체하면 된다.
 */

import type { DailyTarget } from '../../domain/types'

const TEMP_TARGET_KEY = 'diet-app/temp-daily-target/v1'

export function readDailyTarget(): DailyTarget | null {
  try {
    const raw = localStorage.getItem(TEMP_TARGET_KEY)
    if (raw === null) return null

    const parsed = JSON.parse(raw) as Partial<DailyTarget>
    if (typeof parsed.kcal !== 'number') return null

    return {
      kcal: parsed.kcal,
      carb: parsed.carb ?? 0,
      protein: parsed.protein ?? 0,
      fat: parsed.fat ?? 0,
    }
  } catch {
    return null
  }
}

export function writeDailyTarget(target: DailyTarget | null): void {
  if (target === null) {
    localStorage.removeItem(TEMP_TARGET_KEY)
    return
  }
  localStorage.setItem(TEMP_TARGET_KEY, JSON.stringify(target))
}

/**
 * F1의 계산 예시 ㉮ (남 30세 175cm 75kg 사무직, 목표 70kg·12주) 결과값.
 * 임시 목표 버튼이 이 값을 채운다 — 명세 146~166줄의 검산된 수치와 같다.
 */
export const SAMPLE_TARGET: DailyTarget = {
  kcal: 1581,
  carb: 158,
  protein: 119,
  fat: 53,
}
