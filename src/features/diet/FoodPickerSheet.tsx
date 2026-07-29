/**
 * 음식 선택 시트 — 검색 → 선택 → 섭취량 입력의 3단계.
 *
 * 검색 결과가 없으면 직접 입력으로 넘어간다 (명세 215줄). 직접 입력한 음식은
 * 개인 음식 목록에 저장되어 다음에 검색으로 다시 찾을 수 있다.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import type { Amount, Food, MealSlot } from '../../domain/types'
import { MEAL_SLOT_LABEL } from '../../domain/types'
import { computeNutrition, formatGram, formatKcal, toGrams } from '../../domain/nutrition'
import { filterFoodsByName } from '../../domain/foodSearch'
import { validateAmount } from '../../domain/validation'
import type { CustomFoodDraft } from '../../data/repo'
import { CustomFoodForm } from './CustomFoodForm'

type Props = {
  /** 검색 대상 — 개인 음식 + 기본 DB */
  foods: readonly Food[]
  slot: MealSlot
  /** 수정 모드일 때 채워둘 초기값 */
  initial?: { food: Food; amount: Amount }
  onSubmit: (foodId: string, amount: Amount) => void
  onAddCustomFood: (draft: CustomFoodDraft) => Food
  onClose: () => void
}

export function FoodPickerSheet({
  foods,
  slot,
  initial,
  onSubmit,
  onAddCustomFood,
  onClose,
}: Props) {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Food | undefined>(initial?.food)
  const [showCustomForm, setShowCustomForm] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

  const results = useMemo(() => filterFoodsByName(foods, query), [foods, query])

  useEffect(() => {
    if (!selected) searchRef.current?.focus()
  }, [selected])

  // Esc로 닫는다. 시트는 모달이라 키보드 탈출구가 필요하다.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  function handleCustomFoodSubmit(draft: CustomFoodDraft) {
    const food = onAddCustomFood(draft)
    setShowCustomForm(false)
    setSelected(food)
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={`${MEAL_SLOT_LABEL[slot]} 음식 ${initial ? '수정' : '추가'}`}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="sheet-header">
          <h2>
            {MEAL_SLOT_LABEL[slot]} · {initial ? '기록 수정' : '음식 추가'}
          </h2>
          <button type="button" className="icon-button" onClick={onClose} aria-label="닫기">
            ✕
          </button>
        </header>

        {showCustomForm ? (
          <CustomFoodForm
            initialName={query}
            onSubmit={handleCustomFoodSubmit}
            onCancel={() => setShowCustomForm(false)}
          />
        ) : selected ? (
          <AmountStep
            food={selected}
            initialAmount={initial?.amount}
            onBack={() => setSelected(undefined)}
            onSubmit={(amount) => onSubmit(selected.id, amount)}
          />
        ) : (
          <div className="sheet-body">
            <input
              ref={searchRef}
              type="search"
              className="text-input"
              placeholder="음식 이름으로 검색"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />

            {results.length === 0 ? (
              <div className="empty-state">
                <p>'{query}'에 해당하는 음식이 없습니다.</p>
                <button type="button" className="primary-button" onClick={() => setShowCustomForm(true)}>
                  직접 입력해서 추가
                </button>
              </div>
            ) : (
              <>
                <ul className="food-list">
                  {results.map((food) => (
                    <li key={food.id}>
                      <button type="button" className="food-row" onClick={() => setSelected(food)}>
                        <span className="food-name">
                          {food.name}
                          {food.source === 'custom' && <span className="badge">직접 입력</span>}
                        </span>
                        <span className="food-kcal">100g · {formatKcal(food.per100g.kcal)}kcal</span>
                      </button>
                    </li>
                  ))}
                </ul>
                <button type="button" className="ghost-button" onClick={() => setShowCustomForm(true)}>
                  찾는 음식이 없나요? 직접 입력
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------

type AmountStepProps = {
  food: Food
  initialAmount?: Amount
  onBack: () => void
  onSubmit: (amount: Amount) => void
}

/** 섭취량 입력 단계. 저장 전에 환산 결과를 미리 보여준다 */
function AmountStep({ food, initialAmount, onBack, onSubmit }: AmountStepProps) {
  const canUseServing = food.servingGram !== undefined

  const [unit, setUnit] = useState<Amount['unit']>(
    initialAmount?.unit ?? (canUseServing ? 'serving' : 'g'),
  )
  const [value, setValue] = useState(String(initialAmount?.value ?? (canUseServing ? 1 : 100)))

  const amount: Amount = { unit, value: Number(value) }
  const errors = validateAmount(food, amount)
  const isValid = Object.keys(errors).length === 0

  const preview = isValid ? computeNutrition(food, amount) : null
  const grams = isValid ? toGrams(food, amount) : null

  return (
    <form
      className="sheet-body"
      onSubmit={(event) => {
        event.preventDefault()
        if (isValid) onSubmit(amount)
      }}
    >
      <button type="button" className="back-button" onClick={onBack}>
        ← 다른 음식 선택
      </button>

      <div className="selected-food">
        <strong>{food.name}</strong>
        <span>
          100g당 {formatKcal(food.per100g.kcal)}kcal · 탄 {formatGram(food.per100g.carb)}g / 단{' '}
          {formatGram(food.per100g.protein)}g / 지 {formatGram(food.per100g.fat)}g
        </span>
      </div>

      <div className="unit-toggle" role="group" aria-label="섭취량 단위">
        <button
          type="button"
          className={unit === 'serving' ? 'active' : ''}
          disabled={!canUseServing}
          title={canUseServing ? undefined : '1인분 기준량이 없는 음식입니다'}
          onClick={() => setUnit('serving')}
        >
          인분
        </button>
        <button type="button" className={unit === 'g' ? 'active' : ''} onClick={() => setUnit('g')}>
          g
        </button>
      </div>

      <label className="field">
        <span>섭취량 ({unit === 'g' ? 'g' : '인분'})</span>
        <input
          type="number"
          className="text-input"
          inputMode="decimal"
          step={unit === 'g' ? 10 : 0.5}
          min={0}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          autoFocus
        />
        {errors.amount && <span className="field-error">{errors.amount}</span>}
      </label>

      {preview && grams !== null && (
        <div className="preview">
          <div className="preview-kcal">
            {formatKcal(preview.kcal)}
            <span>kcal</span>
          </div>
          <div className="preview-macros">
            {unit === 'serving' && <span>{formatGram(grams)}g</span>}
            <span>탄 {formatGram(preview.carb)}g</span>
            <span>단 {formatGram(preview.protein)}g</span>
            <span>지 {formatGram(preview.fat)}g</span>
          </div>
        </div>
      )}

      <button type="submit" className="primary-button" disabled={!isValid}>
        기록에 추가
      </button>
    </form>
  )
}
