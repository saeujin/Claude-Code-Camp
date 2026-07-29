/**
 * 라벨 + 입력 + 오류 문구를 한 덩어리로 묶는다.
 *
 * 오류 문구를 `<label>` **밖에** 둔다. 안에 두면 라벨의 텍스트가
 * "100g당 칼로리 (kcal)100g당 칼로리를 입력해 주세요."처럼 합쳐져, 스크린리더가
 * 필드 이름을 읽을 때 오류까지 이름의 일부로 읽어버린다.
 */

import type { ReactNode } from 'react'

type Props = {
  label: string
  error?: string | undefined
  children: ReactNode
}

export function Field({ label, error, children }: Props) {
  return (
    <div className="field">
      <label className="field-label">
        <span>{label}</span>
        {children}
      </label>
      {error && <span className="field-error">{error}</span>}
    </div>
  )
}

/**
 * 버튼 묶음처럼 `<label>`로 감쌀 수 없는 입력용.
 *
 * `<label>`은 자기가 감싼 컨트롤의 접근명을 덮어쓴다. 버튼 여러 개를 label 안에
 * 넣으면 버튼 이름이 전부 라벨 텍스트로 바뀌어 "남성"을 찾을 수 없게 된다.
 * 그래서 여기서는 라벨을 평범한 `<span>`으로 두고, 묶음 자체는 감싸는 쪽에서
 * `role="group"`과 `aria-label`로 설명한다.
 */
export function FieldGroup({ label, error, children }: Props) {
  return (
    <div className="field">
      <span className="field-label-text">{label}</span>
      {children}
      {error && <span className="field-error">{error}</span>}
    </div>
  )
}
