// 숫자·단위 표기는 여기 한 곳에서만 만든다.

/** 1581 → '1,581' */
export function num(n: number): string {
  return Math.round(n).toLocaleString('ko-KR')
}

/** 1581 → '1,581 kcal' */
export function kcal(n: number): string {
  return `${num(n)} kcal`
}

/** 부호를 붙인다. 311 → '+311 kcal' */
export function signedKcal(n: number): string {
  const sign = n > 0 ? '+' : n < 0 ? '−' : ''
  return `${sign}${num(Math.abs(n))} kcal`
}

/** 119 → '119g' */
export function gram(n: number): string {
  return `${Math.round(n)}g`
}

/** 75 → '75.0kg' */
export function weight(n: number): string {
  return `${n.toFixed(1)}kg`
}

export function percent(n: number): string {
  return `${Math.round(n)}%`
}

/** 0.42 → '0.42kg' */
export function rate(n: number): string {
  return `${n.toFixed(2)}kg`
}

/** '2026-07-29' → '2026년 7월 29일' */
export function dateLabel(key: string): string {
  const [y, m, d] = key.split('-').map(Number)
  return `${y}년 ${m}월 ${d}일`
}

/** '2026-07-29' → '7월 29일 (수)' */
export function shortDateLabel(key: string): string {
  const [y, m, d] = key.split('-').map(Number)
  const day = ['일', '월', '화', '수', '목', '금', '토'][new Date(y, m - 1, d).getDay()]
  return `${m}월 ${d}일 (${day})`
}
