/**
 * F5. 다음 식사 추천 — 화면 전체.
 *
 * 명세 318~349줄, 시나리오 S4(459~467줄).
 *
 * 계산은 전부 `domain/recommend.ts`가 한다. 이 파일은 저장된 값을 읽어 넘기고
 * 결과를 배치하는 일만 한다. **배분 근거와 추천 이유를 반드시 함께 낸다** —
 * 목록만 내놓으면 이 기능은 의미가 없다 (명세 343~344줄).
 */

import type { MealSlot } from '../../domain/types'
import { MEAL_SLOTS, MEAL_SLOT_LABEL } from '../../domain/types'
import { formatKcal, formatSignedKcal } from '../../domain/nutrition'
import { useSuggest } from './useSuggest'
import { SuggestionCard } from './SuggestionCard'
import './suggest.css'

/**
 * 프로필을 저장하고 돌아왔을 때 목표를 다시 읽는 방법 — App이 `key`를 바꿔
 * 이 화면을 새로 마운트한다. 저장소를 마운트 시점에 한 번만 읽는 구조라
 * 별도의 갱신 신호(prop)가 필요하지 않다.
 */
type Props = {
  /** 프로필 화면으로 이동. F1 미완료일 때 안내와 함께 노출한다 (명세 349줄) */
  onGoToProfile?: () => void
}

type SlotTabsProps = {
  slot: MealSlot
  loggedSlots: readonly MealSlot[]
  onSelect: (slot: MealSlot) => void
}

function SlotTabs({ slot, loggedSlots, onSelect }: SlotTabsProps) {
  return (
    <div className="slot-tabs" role="group" aria-label="추천받을 끼니">
      {MEAL_SLOTS.map((candidate) => (
        <button
          key={candidate}
          type="button"
          className={`slot-tab${candidate === slot ? ' active' : ''}`}
          aria-pressed={candidate === slot}
          onClick={() => onSelect(candidate)}
        >
          {MEAL_SLOT_LABEL[candidate]}
          {/* 기록이 있는 끼니를 표시해 둔다. 배분에서 빠진 이유가 드러난다 */}
          {loggedSlots.includes(candidate) && (
            <span className="slot-tab-logged" aria-label="기록 있음">
              ·
            </span>
          )}
        </button>
      ))}
    </div>
  )
}

export function SuggestPage({ onGoToProfile }: Props) {
  const { slot, setSlot, loggedSlots, allSlotsLogged, recommendation } = useSuggest()

  const { status, todayTargetKcal, remainingKcal, remainingSlotCount, slotKcal, suggestions, notice } =
    recommendation

  // 이유는 후보마다 같다(같은 잔여에서 파생) — 목록 위에 한 번만 낸다
  const reasons = suggestions[0]?.reasons ?? []

  if (status === 'profile-required') {
    return (
      <div className="suggest-page">
        <header className="suggest-header">
          <h1>다음 식사 추천</h1>
        </header>

        <div className="suggest-empty">
          <p className="suggest-empty-text">{notice}</p>
          {onGoToProfile && (
            <button type="button" className="suggest-primary" onClick={onGoToProfile}>
              프로필 설정하기
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="suggest-page">
      <header className="suggest-header">
        <h1>다음 식사 추천</h1>
        <SlotTabs slot={slot} loggedSlots={loggedSlots} onSelect={setSlot} />
      </header>

      {/* 배분 근거 — 왜 이 칼로리대인지 사용자가 따라올 수 있어야 한다 */}
      <section className="suggest-budget" aria-label="칼로리 배분">
        <div className="budget-row">
          <span className="budget-label">오늘 목표</span>
          <span className="budget-value">{formatKcal(todayTargetKcal ?? 0)} kcal</span>
        </div>
        <div className={`budget-row${(remainingKcal ?? 0) < 0 ? ' over' : ''}`}>
          <span className="budget-label">{(remainingKcal ?? 0) < 0 ? '초과' : '잔여'}</span>
          <span className="budget-value">{formatSignedKcal(remainingKcal ?? 0)} kcal</span>
        </div>

        {slotKcal !== null && (
          <div className="budget-row emphasis">
            <span className="budget-label">
              {MEAL_SLOT_LABEL[slot]} 몫
              <small>
                {' '}
                잔여 ÷ 남은 {remainingSlotCount}끼
              </small>
            </span>
            <span className="budget-value">약 {formatKcal(slotKcal)} kcal</span>
          </div>
        )}
      </section>

      {notice && <p className="suggest-notice">{notice}</p>}

      {allSlotsLogged && (
        <p className="suggest-notice">
          오늘 기록이 끝났어요. 그래도 더 드실 거라면 아래를 참고하세요.
        </p>
      )}

      {reasons.length > 0 && (
        <section className="suggest-reasons" aria-label="추천 이유">
          <h2>이 메뉴를 고른 이유</h2>
          <ul>
            {reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </section>
      )}

      {suggestions.length === 0 ? (
        <p className="suggest-empty-text">
          추천할 음식을 찾지 못했어요. 끼니를 바꾸거나 개인 음식을 등록해 보세요.
        </p>
      ) : (
        <ul className="suggestion-list">
          {suggestions.map((suggestion, index) => (
            <SuggestionCard key={suggestion.food.id} suggestion={suggestion} rank={index + 1} />
          ))}
        </ul>
      )}

      <p className="suggest-foot">
        먹은 뒤에는 <strong>식단 기록</strong>에서 실제로 먹은 양을 기록해 주세요. 추천은 기록을
        대신하지 않습니다.
      </p>
    </div>
  )
}
