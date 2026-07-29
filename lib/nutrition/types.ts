/**
 * F1 — 사용자 프로필 및 목표 설정
 *
 * 기능명세서 §F1의 입력·출력을 타입으로 옮긴 것.
 * 이 파일과 calculate.ts는 React·Next.js·localStorage를 모른다.
 * F3(운동)·F5(다음 식사 추천)·F7(대시보드) 담당자가 그대로 import해서 쓴다.
 */

export type Sex = 'male' | 'female'

/**
 * 활동 수준 — 명세서 §F1 ②
 *
 * 운동은 포함하지 않는다. 직업과 일상 생활의 움직임만 나타낸다.
 * 운동은 F3에서 그날그날 별도로 더한다. (§2 "활동계수와 운동을 분리하는 이유")
 */
export type ActivityLevel = 'sedentary' | 'light' | 'active' | 'veryActive'

export type DietGoal = 'lose' | 'maintain' | 'gain'

/** 사용자가 입력하는 값. localStorage에 저장되는 형태이기도 하다. */
export interface Profile {
  sex: Sex
  age: number
  heightCm: number
  weightKg: number
  activityLevel: ActivityLevel
  dietGoal: DietGoal

  /** 유지 목표일 때는 null (명세서 §F1 입력표) */
  targetWeightKg: number | null
  /** 유지 목표일 때는 null. 주 수는 UI에서 일수로 환산해 저장한다. */
  goalDurationDays: number | null

  /**
   * 목표를 설정한 날 (YYYY-MM-DD).
   *
   * 명세서 §F1 예외: "몸무게를 갱신하면 ... 남은 기간도 줄었으므로
   * `남은 체중 변화량 ÷ 남은 기간`으로 일일 조정량을 다시 계산한다."
   * 남은 기간을 알려면 시작일이 필요하다.
   */
  goalStartDate: string
}

export interface MacroTargets {
  carbsG: number
  proteinG: number
  fatG: number
  /** 단백질 하한(체중 × 1.2g, 근력운동일 1.6g)이 실제로 적용됐는지 */
  proteinFloorApplied: boolean
  /** 이번 계산에 쓰인 단백질 하한 그램 수 */
  proteinFloorG: number
}

/**
 * 사용자에게 보여줄 안내. 명세서는 이 상황들에서 **값을 바꾸지 말고 알리기만** 하라고 요구한다.
 */
export type TargetNotice =
  /** 기본 목표가 BMR보다 낮다. 값은 그대로 두고 안내만 한다 (§F1 ③, 계산 예시 ㉮) */
  | 'belowBmr'
  /** 기간이 너무 짧아 목표가 0 이하다. 값은 그대로 두고 입력 재확인을 유도한다 (§F1 예외) */
  | 'nonPositiveTarget'
  /** 목표 체중 = 현재 체중 → 유지로 처리했다 (§F1 예외) */
  | 'goalWeightEqualsCurrent'
  /** 목표 기간이 지났다. 달성 여부를 확인하고 새 목표를 유도한다 (§F1 예외) */
  | 'goalPeriodEnded'
  /** 단백질 하한이 목표 칼로리를 잡아먹어 탄수화물이 0으로 내려갔다 */
  | 'proteinFloorExceedsBudget'

export interface Targets {
  /** 기초대사량. 명세서 예시가 1,698.75로 소수점을 그대로 쓰므로 반올림하지 않는다 */
  bmr: number
  /** 일일 총 소비 열량 (반올림) */
  tdee: number

  /**
   * 목표 때문에 하루에 덜/더 먹게 되는 열량. 항상 0 이상이며 방향은 effectiveGoal이 정한다.
   * 유지 목표면 0.
   */
  dailyAdjustmentKcal: number

  /** 운동을 하지 않았을 때 하루에 먹어야 할 열량. **어떤 경우에도 보정하지 않는다.** */
  baseTargetCalories: number

  /** 목표 체중 = 현재 체중이면 dietGoal이 무엇이든 'maintain'으로 치환된다 */
  effectiveGoal: DietGoal

  /** 주당 예상 변화 속도 (kg/주, 소수 2자리). 유지 목표면 null */
  weeklyRateKg: number | null
  /** 목표 달성 예정일 (YYYY-MM-DD). 유지 목표면 null */
  targetDate: string | null
  /** 오늘 기준 남은 일수. 기간이 지났으면 0. 유지 목표면 null */
  remainingDays: number | null

  macros: MacroTargets
  notices: TargetNotice[]
}

export interface CalcOptions {
  /** 계산 기준일. 테스트에서 고정하기 위해 주입받는다. 기본값은 실행 시점의 오늘 */
  today?: Date
  /**
   * 그날 근력운동 기록이 있는지 — F3가 넘긴다.
   * true면 단백질 하한이 체중 × 1.2g → × 1.6g으로 올라간다 (§F1 ④, §F3 ③).
   * F1 화면은 항상 false를 넘긴다.
   */
  hasStrengthTraining?: boolean
}
