/**
 * 오늘 목표 칼로리 — F1·F3과 F2의 경계.
 *
 * `오늘 목표 = 기본 목표 칼로리(F1) + 운동 소모 칼로리(F3)`
 *
 * F1이 구현되면서 임시 목표 입력은 사라졌다. 이제 저장된 프로필에서
 * `calcAllTargets`로 기본 목표를 계산해 F2에 넘긴다. 프로필이 없으면 `null`이고,
 * 그때 F2는 잔여 칼로리를 표시하지 않는다 (명세 226줄).
 *
 * F3(운동 기록)은 아직 없다. 들어오면 `exerciseKcal`만 더하면 된다 —
 * `readDailyTarget`의 계산식에 자리를 비워뒀다.
 */

import type { DailyTarget } from '../../domain/types'
import { calcAllTargets } from '../../domain/profile'
import { loadProfile } from '../../data/profileRepo'

/**
 * 오늘 목표. 프로필이 없으면 null.
 *
 * @param exerciseKcal 그날 운동으로 태운 열량 (F3). 아직 F3가 없어 기본값 0.
 */
export function readDailyTarget(exerciseKcal = 0): DailyTarget | null {
  const profile = loadProfile()
  if (!profile) return null

  const targets = calcAllTargets(profile)

  return {
    // 명세 226~227줄의 "오늘 목표 = 기본 목표 + 운동 소모"
    kcal: targets.baseTargetCalories + exerciseKcal,
    carb: targets.macros.carbsG,
    protein: targets.macros.proteinG,
    fat: targets.macros.fatG,
  }
}
