/**
 * 계산 결과 표시 — 명세 182~189줄.
 *
 * 사용자가 근거를 이해할 수 있도록 BMR → TDEE → 기본 목표를 **단계별로** 노출한다.
 * 안내 문구는 값을 바꾸지 않는다 — 명세 130~133줄, 188줄이 요구하는 그대로다.
 */

import type { Targets, TargetNotice } from '../../domain/types'
import { DIET_GOAL_LABELS } from '../../domain/profileConstants'
import { formatDateLabel } from '../../domain/date'

type Props = { targets: Targets }

function kcal(value: number): string {
  return Math.round(value).toLocaleString('ko-KR')
}

/** 안내 문구와 심각도. 어느 것도 계산값을 바꾸지 않는다 */
const NOTICE_TEXT: Record<TargetNotice, { level: 'warn' | 'info'; text: string }> = {
  belowBmr: {
    level: 'warn',
    text: '기본 목표가 기초대사량보다 낮습니다. 값을 조정하지 않고 사실만 알려드립니다 — 기간을 늘리거나, 운동을 기록해 오늘 목표를 올릴 수 있습니다.',
  },
  nonPositiveTarget: {
    level: 'warn',
    text: '목표 기간이 너무 짧아 목표 칼로리가 0 이하로 계산됐습니다. 입력을 다시 확인해 주세요.',
  },
  goalWeightEqualsCurrent: {
    level: 'info',
    text: '목표 체중이 현재 체중과 같아 유지 목표로 처리했습니다.',
  },
  goalPeriodEnded: {
    level: 'warn',
    text: '목표 기간이 지났습니다. 달성 여부를 확인하고 새 목표를 설정해 주세요.',
  },
  proteinFloorExceedsBudget: {
    level: 'warn',
    text: '단백질 하한이 목표 칼로리를 넘어서 탄수화물이 0g으로 내려갔습니다.',
  },
}

export function TargetBreakdown({ targets }: Props) {
  const { bmr, tdee, dailyAdjustmentKcal, baseTargetCalories, effectiveGoal, macros } = targets
  const isMaintain = effectiveGoal === 'maintain'

  return (
    <section className="breakdown">
      <h2>계산 결과</h2>

      <ol className="calc-steps">
        <li>
          <span className="calc-label">
            기초대사량 <em>BMR</em>
          </span>
          {/* 명세 예시가 1,698.75로 소수점을 쓰므로 반올림하지 않고 그대로 보여준다 */}
          <span className="calc-value">{bmr.toLocaleString('ko-KR')} kcal</span>
        </li>
        <li>
          <span className="calc-label">
            일일 총 소비 <em>TDEE</em>
          </span>
          <span className="calc-value">{kcal(tdee)} kcal</span>
        </li>
        {!isMaintain && (
          <li>
            <span className="calc-label">
              일일 조정량
              <em>{effectiveGoal === 'lose' ? '덜 먹기' : '더 먹기'}</em>
            </span>
            <span className="calc-value">
              {effectiveGoal === 'lose' ? '−' : '+'}
              {kcal(dailyAdjustmentKcal)} kcal
            </span>
          </li>
        )}
      </ol>

      <div className="target-headline">
        <span className="calc-label">기본 목표 칼로리</span>
        <strong>
          {kcal(baseTargetCalories)}
          <span className="unit">kcal</span>
        </strong>
        <span className="target-sub">
          {DIET_GOAL_LABELS[effectiveGoal]}
          {!isMaintain && ` · 하루 ${kcal(dailyAdjustmentKcal)} kcal ${
            effectiveGoal === 'lose' ? '덜' : '더'
          } 먹게 됩니다`}
        </span>
      </div>

      {!isMaintain && (
        <dl className="goal-facts">
          <div>
            <dt>주당 예상 변화</dt>
            <dd>{targets.weeklyRateKg ?? 0} kg/주</dd>
          </div>
          {targets.targetDate && (
            <div>
              <dt>목표 달성 예정일</dt>
              <dd>{formatDateLabel(targets.targetDate)}</dd>
            </div>
          )}
          {targets.remainingDays != null && (
            <div>
              <dt>남은 기간</dt>
              <dd>{targets.remainingDays}일</dd>
            </div>
          )}
        </dl>
      )}

      <div className="macro-targets">
        <h3>목표 탄단지</h3>
        <div className="macro-target-row">
          <div>
            <span>탄수화물</span>
            <strong>{macros.carbsG}g</strong>
          </div>
          <div>
            <span>단백질</span>
            <strong>{macros.proteinG}g</strong>
          </div>
          <div>
            <span>지방</span>
            <strong>{macros.fatG}g</strong>
          </div>
        </div>
        {macros.proteinFloorApplied && (
          <p className="form-hint">
            단백질이 하한 {macros.proteinFloorG}g에 못 미쳐 하한값을 적용하고, 부족분을
            탄수화물에서 뺐습니다.
          </p>
        )}
      </div>

      {targets.notices.length > 0 && (
        <ul className="notice-list">
          {targets.notices.map((notice) => (
            <li key={notice} className={`notice ${NOTICE_TEXT[notice].level}`}>
              {NOTICE_TEXT[notice].text}
            </li>
          ))}
        </ul>
      )}

      <p className="form-hint">
        임신·수유·질환 등 특수 상황은 이 공식이 다루지 않습니다. 전문가와 상의해 주세요.
      </p>
    </section>
  )
}
