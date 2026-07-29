// 하루의 경계는 로컬 타임존 자정. 날짜 키는 'YYYY-MM-DD' 문자열이며
// UTC로 변환하지 않는다 — 변환하면 자정 전후 기록이 다른 날로 샌다.
import type { DateKey } from '../domain/types'

const pad = (n: number) => String(n).padStart(2, '0')

export function toKey(d: Date): DateKey {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function todayKey(): DateKey {
  return toKey(new Date())
}

/** 'YYYY-MM-DD' → 로컬 자정의 Date */
export function parseKey(key: DateKey): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(key: DateKey, days: number): DateKey {
  const d = parseKey(key)
  d.setDate(d.getDate() + days)
  return toKey(d)
}

/** from → to 사이의 일수. to가 미래면 양수 */
export function diffDays(from: DateKey, to: DateKey): number {
  const ms = parseKey(to).getTime() - parseKey(from).getTime()
  return Math.round(ms / 86_400_000)
}

export function addWeeks(key: DateKey, weeks: number): DateKey {
  return addDays(key, weeks * 7)
}

/** 일수를 '11주 6일' 형태로. 주 단위가 0이면 '6일' */
export function formatPeriod(days: number): string {
  if (days <= 0) return '0일'
  const weeks = Math.floor(days / 7)
  const rest = days % 7
  if (weeks === 0) return `${rest}일`
  if (rest === 0) return `${weeks}주`
  return `${weeks}주 ${rest}일`
}

/** 현재 시각을 'HH:mm' 으로 */
export function nowTime(): string {
  const d = new Date()
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function currentHour(): number {
  return new Date().getHours()
}
