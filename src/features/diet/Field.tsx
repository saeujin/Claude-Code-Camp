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
