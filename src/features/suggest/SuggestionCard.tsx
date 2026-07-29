/**
 * 추천 음식 한 장 — 명세 341~342줄.
 *
 * 칼로리와 탄단지를 함께 낸다. 인분 배수는 1이 아닐 때만 강조한다 — 사용자가
 * 먹을 양을 오해하면 F2 기록까지 틀어진다 (`formatServings` 주석).
 */

import type { MealSuggestion } from '../../domain/types'
import { formatGram, formatKcal } from '../../domain/nutrition'
import { formatServings } from '../../domain/recommend'

type Props = {
  suggestion: MealSuggestion
  /** 목록에서 몇 번째인지 (1부터). 최상단을 시각적으로 구분한다 */
  rank: number
}

export function SuggestionCard({ suggestion, rank }: Props) {
  const { food, servings, nutrition } = suggestion
  const scaled = servings !== 1

  return (
    <li className={`suggestion-card${rank === 1 ? ' top' : ''}`}>
      <div className="suggestion-head">
        <span className="suggestion-rank" aria-hidden="true">
          {rank}
        </span>

        <div className="suggestion-title">
          <strong className="suggestion-name">{food.name}</strong>
          <span className={`suggestion-servings${scaled ? ' scaled' : ''}`}>
            {formatServings(servings)}
          </span>
        </div>

        <span className="suggestion-kcal">
          {formatKcal(nutrition.kcal)}
          <span className="suggestion-unit">kcal</span>
        </span>
      </div>

      <dl className="suggestion-macros">
        <div>
          <dt>탄수</dt>
          <dd>{formatGram(nutrition.carb)}g</dd>
        </div>
        <div>
          <dt>단백</dt>
          <dd>{formatGram(nutrition.protein)}g</dd>
        </div>
        <div>
          <dt>지방</dt>
          <dd>{formatGram(nutrition.fat)}g</dd>
        </div>
      </dl>
    </li>
  )
}
