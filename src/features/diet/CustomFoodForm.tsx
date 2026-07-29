/**
 * 개인 음식 직접 입력 폼.
 *
 * 명세 215줄 — "DB에 없는 음식은 사용자가 칼로리를 직접 입력 → 개인 음식 목록에
 * 저장해 재사용". 저장하면 곧바로 검색 대상이 되고 다음 기록에서 다시 고를 수 있다.
 *
 * 오류 문구는 **사용자가 건드린 필드에만** 보여준다. 빈 폼이 열리자마자 "칼로리를
 * 입력해 주세요"를 띄우는 것은 아직 잘못한 게 없는 사용자를 꾸짖는 셈이다.
 * 저장 버튼은 그와 별개로 검증 결과에 따라 잠긴다.
 */

import { useMemo, useState } from 'react'
import type { CustomFoodDraft } from '../../data/repo'
import {
  macroMismatchWarning,
  validateCustomFood,
  type CustomFoodInput,
} from '../../domain/validation'
import { Field } from './Field'

type Props = {
  /** 검색어를 이름 초기값으로 물려받는다 */
  initialName: string
  onSubmit: (draft: CustomFoodDraft) => void
  onCancel: () => void
}

const EMPTY: CustomFoodInput = {
  name: '',
  kcal: '',
  carb: '',
  protein: '',
  fat: '',
  servingGram: '',
}

export function CustomFoodForm({ initialName, onSubmit, onCancel }: Props) {
  const [input, setInput] = useState<CustomFoodInput>({ ...EMPTY, name: initialName })
  const [touched, setTouched] = useState<Partial<Record<keyof CustomFoodInput, boolean>>>({})

  const { errors, parsed } = useMemo(() => validateCustomFood(input), [input])

  // 탄단지 역산값과 입력 칼로리가 크게 다르면 알려준다. 저장은 막지 않는다.
  const warning = parsed ? macroMismatchWarning(parsed.per100g) : null

  function update<K extends keyof CustomFoodInput>(field: K, value: string) {
    setInput((prev) => ({ ...prev, [field]: value }))
    setTouched((prev) => ({ ...prev, [field]: true }))
  }

  /** 건드린 필드의 오류만 노출한다 */
  function errorFor(field: keyof CustomFoodInput): string | undefined {
    return touched[field] ? errors[field] : undefined
  }

  return (
    <form
      className="sheet-body"
      onSubmit={(event) => {
        event.preventDefault()
        if (parsed) onSubmit(parsed)
      }}
    >
      <button type="button" className="back-button" onClick={onCancel}>
        ← 검색으로 돌아가기
      </button>

      <p className="form-hint">
        영양값은 <strong>100g 기준</strong>으로 입력해 주세요. 저장하면 개인 음식 목록에 남아 다음에
        검색으로 바로 찾을 수 있습니다.
      </p>

      <Field label="음식 이름" error={errorFor('name')}>
        <input
          type="text"
          className="text-input"
          value={input.name}
          onChange={(event) => update('name', event.target.value)}
          placeholder="예: 엄마 김치볶음밥"
          autoFocus={initialName === ''}
        />
      </Field>

      <Field label="100g당 칼로리 (kcal)" error={errorFor('kcal')}>
        <input
          type="number"
          className="text-input"
          inputMode="decimal"
          min={0}
          step="any"
          value={input.kcal}
          onChange={(event) => update('kcal', event.target.value)}
          placeholder="필수"
          autoFocus={initialName !== ''}
        />
      </Field>

      <fieldset className="macro-fields">
        <legend>100g당 탄단지 (g) — 모르면 비워두세요</legend>
        <div className="macro-row">
          <Field label="탄수화물" error={errorFor('carb')}>
            <input
              type="number"
              className="text-input"
              inputMode="decimal"
              min={0}
              step="any"
              value={input.carb}
              onChange={(event) => update('carb', event.target.value)}
            />
          </Field>
          <Field label="단백질" error={errorFor('protein')}>
            <input
              type="number"
              className="text-input"
              inputMode="decimal"
              min={0}
              step="any"
              value={input.protein}
              onChange={(event) => update('protein', event.target.value)}
            />
          </Field>
          <Field label="지방" error={errorFor('fat')}>
            <input
              type="number"
              className="text-input"
              inputMode="decimal"
              min={0}
              step="any"
              value={input.fat}
              onChange={(event) => update('fat', event.target.value)}
            />
          </Field>
        </div>
      </fieldset>

      <Field label="1인분 중량 (g) — 선택" error={errorFor('servingGram')}>
        <input
          type="number"
          className="text-input"
          inputMode="decimal"
          min={0}
          step="any"
          value={input.servingGram}
          onChange={(event) => update('servingGram', event.target.value)}
          placeholder="입력하면 '인분' 단위로 기록할 수 있어요"
        />
      </Field>

      {warning && <p className="form-warning">{warning}</p>}

      <button type="submit" className="primary-button" disabled={parsed === null}>
        개인 음식으로 저장
      </button>
    </form>
  )
}
