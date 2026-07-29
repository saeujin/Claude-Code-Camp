/**
 * 하단 고정 요약바 — 명세 220~221줄, 225~226줄.
 *
 * - 누적 섭취 칼로리·탄단지
 * - 잔여 칼로리 = 오늘 목표 − 누적 섭취
 * - 목표가 없으면(F1 미완료) 잔여를 표시하지 않고 안내로 대체한다 (226줄)
 * - 목표를 초과해도 막지 않는다. 음수를 그대로 보여줄 뿐이다 (225줄)
 */

import type { DailyTarget, Nutrition } from '../../domain/types'
import { formatGram, formatKcal, formatSignedKcal, progressRatio } from '../../domain/nutrition'

type Props = {
  total: Nutrition
  target: DailyTarget | null
  remaining: Nutrition | null
  /** 프로필 화면으로 이동. 목표가 없을 때만 쓰인다 */
  onGoToProfile?: (() => void) | undefined
}

type MacroBarProps = {
  label: string
  consumed: number
  target: number | undefined
}

function MacroBar({ label, consumed, target }: MacroBarProps) {
  const ratio = target === undefined ? null : progressRatio(consumed, target)

  return (
    <div className={`macro-bar${ratio === null ? ' no-target' : ''}`}>
      <span className="macro-bar-label">{label}</span>
      {ratio === null ? (
        <span className="macro-bar-value">{formatGram(consumed)}g</span>
      ) : (
        <>
          <span className="macro-bar-track">
            <span
              className={`macro-bar-fill${ratio > 1 ? ' over' : ''}`}
              // 100%를 넘어도 바는 꽉 찬 상태로 멈춘다. 초과분은 숫자로 읽는다.
              style={{ width: `${Math.min(ratio, 1) * 100}%` }}
            />
          </span>
          <span className="macro-bar-value">
            {formatGram(consumed)} / {formatGram(target ?? 0)}g
          </span>
        </>
      )}
    </div>
  )
}

export function DaySummaryBar({ total, target, remaining, onGoToProfile }: Props) {
  const isOver = remaining !== null && remaining.kcal < 0

  return (
    <footer className="summary-bar">
      <div className="summary-top">
        <div className="summary-consumed">
          <span className="summary-caption">오늘 섭취</span>
          <strong>
            {formatKcal(total.kcal)}
            {target && <span className="summary-target"> / {formatKcal(target.kcal)}</span>}
            <span className="summary-unit">kcal</span>
          </strong>
        </div>

        {remaining === null ? (
          onGoToProfile && (
            <button type="button" className="ghost-button compact" onClick={onGoToProfile}>
              목표 설정하기
            </button>
          )
        ) : (
          <div className={`summary-remaining${isOver ? ' over' : ''}`}>
            <span className="summary-caption">{isOver ? '초과' : '잔여'}</span>
            <strong>
              {formatSignedKcal(remaining.kcal)}
              <span className="summary-unit">kcal</span>
            </strong>
          </div>
        )}
      </div>

      {remaining === null && (
        <p className="summary-notice">
          프로필을 설정하면 목표 칼로리가 계산되어 잔여 칼로리가 표시됩니다.
        </p>
      )}

      <div className="macro-bars">
        <MacroBar label="탄수" consumed={total.carb} target={target?.carb} />
        <MacroBar label="단백" consumed={total.protein} target={target?.protein} />
        <MacroBar label="지방" consumed={total.fat} target={target?.fat} />
      </div>

      {target && onGoToProfile && (
        <button type="button" className="text-button" onClick={onGoToProfile}>
          목표 수정
        </button>
      )}
    </footer>
  )
}
