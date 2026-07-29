/**
 * 날짜 유틸 — 모두 UTC 자정 기준으로 다뤄 타임존에 따라 하루가 밀리는 것을 막는다.
 * 저장·전달 형식은 항상 `YYYY-MM-DD` 문자열이다.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000

/** Date → 'YYYY-MM-DD' (해당 날짜의 로컬 달력일 기준) */
export function toISODate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** 'YYYY-MM-DD' → UTC 자정 Date. 형식이 틀리면 null */
export function fromISODate(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!m) return null
  const [, y, mo, d] = m
  const date = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d)))
  // 2026-02-31 같은 값이 3월로 굴러가는 것을 걸러낸다
  if (
    date.getUTCFullYear() !== Number(y) ||
    date.getUTCMonth() !== Number(mo) - 1 ||
    date.getUTCDate() !== Number(d)
  ) {
    return null
  }
  return date
}

export function addDays(iso: string, days: number): string | null {
  const base = fromISODate(iso)
  if (!base) return null
  const next = new Date(base.getTime() + days * MS_PER_DAY)
  const y = next.getUTCFullYear()
  const m = String(next.getUTCMonth() + 1).padStart(2, '0')
  const d = String(next.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** to − from 의 일수. 형식이 틀리면 null */
export function daysBetween(fromIso: string, toIso: string): number | null {
  const a = fromISODate(fromIso)
  const b = fromISODate(toIso)
  if (!a || !b) return null
  return Math.round((b.getTime() - a.getTime()) / MS_PER_DAY)
}
