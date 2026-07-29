/**
 * 날짜 유틸 — 기록의 날짜 키는 'YYYY-MM-DD' 문자열이다.
 *
 * `toISOString()`은 UTC로 변환하므로 쓰지 않는다. 한국 시간 기준 자정 직후에
 * 기록하면 전날로 밀려버린다. 항상 로컬 타임존 기준으로 자릿수를 만든다.
 */

const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토'] as const

/** Date → 'YYYY-MM-DD' (로컬 기준) */
export function toDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** 'YYYY-MM-DD' → Date (로컬 자정). 형식이 어긋나면 던진다 */
export function fromDateKey(key: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key)
  if (!match?.[1] || !match[2] || !match[3]) {
    throw new Error(`날짜 형식이 올바르지 않습니다: ${key}`)
  }

  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
}

export function todayKey(): string {
  return toDateKey(new Date())
}

/** 날짜 키를 일 단위로 이동한다. 월·연 경계는 Date가 알아서 넘긴다 */
export function shiftDateKey(key: string, days: number): string {
  const date = fromDateKey(key)
  date.setDate(date.getDate() + days)
  return toDateKey(date)
}

/** 형식이 맞는 날짜 키인지. 2026-02-31처럼 굴러가는 값도 걸러낸다 */
export function isValidDateKey(key: string): boolean {
  try {
    return toDateKey(fromDateKey(key)) === key
  } catch {
    return false
  }
}

/**
 * `toKey − fromKey`의 일수. F1의 남은 기간 계산에 쓴다.
 *
 * 달력일 차이를 세야 하므로 UTC 자정으로 정규화한 뒤 뺀다. 로컬 시각으로 빼면
 * 일광절약시간 경계에서 한 시간이 모자라 하루가 깎일 수 있다.
 */
export function daysBetweenKeys(fromKey: string, toKey: string): number {
  const from = fromDateKey(fromKey)
  const to = fromDateKey(toKey)

  const fromUtc = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate())
  const toUtc = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate())

  return Math.round((toUtc - fromUtc) / 86_400_000)
}

/** '7월 29일 (수)' — 화면 헤더용 */
export function formatDateLabel(key: string): string {
  const date = fromDateKey(key)
  return `${date.getMonth() + 1}월 ${date.getDate()}일 (${WEEKDAY[date.getDay()]})`
}

/** 오늘/어제/내일은 이름으로 보여준다. 그 밖은 날짜 그대로 */
export function formatRelativeDateLabel(key: string, today = todayKey()): string {
  if (key === today) return '오늘'
  if (key === shiftDateKey(today, -1)) return '어제'
  if (key === shiftDateKey(today, 1)) return '내일'
  return formatDateLabel(key)
}
