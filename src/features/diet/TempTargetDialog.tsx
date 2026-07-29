/**
 * 임시 목표 칼로리 입력 — F1 대역(代役).
 *
 * F1(사용자 프로필 및 목표 설정)이 구현되면 목표는 BMR·TDEE·목표 체중·기간에서
 * 자동 계산되고 이 파일은 삭제된다. 그때까지 F2의 잔여 칼로리 표시를 실제로
 * 확인할 수 있게 하는 임시 통로다.
 */

import { useState } from 'react'
import type { DailyTarget } from '../../domain/types'
import { SAMPLE_TARGET } from '../target/dailyTarget'
import { Field } from './Field'

type Props = {
  current: DailyTarget | null
  onSave: (target: DailyTarget | null) => void
  onClose: () => void
}

type Form = { kcal: string; carb: string; protein: string; fat: string }

function toForm(target: DailyTarget | null): Form {
  if (!target) return { kcal: '', carb: '', protein: '', fat: '' }

  return {
    kcal: String(target.kcal),
    carb: String(target.carb),
    protein: String(target.protein),
    fat: String(target.fat),
  }
}

/** 빈 값과 잘못된 값은 0으로 떨어뜨린다. 임시 입력이라 검증을 얕게 둔다 */
function toNumber(raw: string): number {
  const value = Number(raw.trim())
  return Number.isFinite(value) && value >= 0 ? value : 0
}

export function TempTargetDialog({ current, onSave, onClose }: Props) {
  const [form, setForm] = useState<Form>(() => toForm(current))

  const kcal = toNumber(form.kcal)
  const canSave = kcal > 0

  function update<K extends keyof Form>(field: K, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label="임시 목표 칼로리 설정"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="sheet-header">
          <h2>임시 목표 설정</h2>
          <button type="button" className="icon-button" onClick={onClose} aria-label="닫기">
            ✕
          </button>
        </header>

        <form
          className="sheet-body"
          onSubmit={(event) => {
            event.preventDefault()
            if (!canSave) return

            onSave({
              kcal,
              carb: toNumber(form.carb),
              protein: toNumber(form.protein),
              fat: toNumber(form.fat),
            })
          }}
        >
          <p className="form-hint">
            F1 프로필 설정이 들어오면 이 값은 <strong>BMR · TDEE · 목표 체중 · 목표 기간</strong>에서
            자동 계산됩니다. 지금은 F2의 잔여 칼로리 표시를 확인하기 위한 임시 입력입니다.
          </p>

          <button type="button" className="ghost-button" onClick={() => setForm(toForm(SAMPLE_TARGET))}>
            명세 F1 예시값 채우기 (1,581 kcal)
          </button>

          <Field label="오늘 목표 칼로리 (kcal)">
            <input
              type="number"
              className="text-input"
              inputMode="decimal"
              min={0}
              step="any"
              value={form.kcal}
              onChange={(event) => update('kcal', event.target.value)}
              autoFocus
            />
          </Field>

          <fieldset className="macro-fields">
            <legend>목표 탄단지 (g) — 비우면 진행바를 표시하지 않습니다</legend>
            <div className="macro-row">
              <Field label="탄수화물">
                <input
                  type="number"
                  className="text-input"
                  inputMode="decimal"
                  min={0}
                  value={form.carb}
                  onChange={(event) => update('carb', event.target.value)}
                />
              </Field>
              <Field label="단백질">
                <input
                  type="number"
                  className="text-input"
                  inputMode="decimal"
                  min={0}
                  value={form.protein}
                  onChange={(event) => update('protein', event.target.value)}
                />
              </Field>
              <Field label="지방">
                <input
                  type="number"
                  className="text-input"
                  inputMode="decimal"
                  min={0}
                  value={form.fat}
                  onChange={(event) => update('fat', event.target.value)}
                />
              </Field>
            </div>
          </fieldset>

          <button type="submit" className="primary-button" disabled={!canSave}>
            목표 저장
          </button>

          {current && (
            <button type="button" className="text-button danger" onClick={() => onSave(null)}>
              목표 해제 (잔여 칼로리 숨기기)
            </button>
          )}
        </form>
      </div>
    </div>
  )
}
