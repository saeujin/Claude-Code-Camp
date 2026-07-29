import { describe, expect, it } from 'vitest'
import {
  daysBetweenKeys,
  formatDateLabel,
  formatRelativeDateLabel,
  fromDateKey,
  isValidDateKey,
  shiftDateKey,
  toDateKey,
} from './date'

describe('toDateKey', () => {
  it('로컬 타임존 기준으로 YYYY-MM-DD를 만든다', () => {
    expect(toDateKey(new Date(2026, 6, 29))).toBe('2026-07-29')
  })

  it('월·일을 두 자리로 채운다', () => {
    expect(toDateKey(new Date(2026, 0, 5))).toBe('2026-01-05')
  })

  it('자정 직후에도 날짜가 밀리지 않는다 — toISOString()을 쓰지 않기 때문', () => {
    // UTC로 변환하면 KST 00:30은 전날 15:30이 되어 하루가 밀린다.
    expect(toDateKey(new Date(2026, 6, 29, 0, 30))).toBe('2026-07-29')
  })

  it('밤 11시 59분도 같은 날로 남는다', () => {
    expect(toDateKey(new Date(2026, 6, 29, 23, 59))).toBe('2026-07-29')
  })
})

describe('fromDateKey', () => {
  it('로컬 자정 Date로 되돌린다', () => {
    const date = fromDateKey('2026-07-29')

    expect(date.getFullYear()).toBe(2026)
    expect(date.getMonth()).toBe(6)
    expect(date.getDate()).toBe(29)
    expect(date.getHours()).toBe(0)
  })

  it('toDateKey와 왕복해도 값이 같다', () => {
    expect(toDateKey(fromDateKey('2026-02-28'))).toBe('2026-02-28')
  })

  it('형식이 어긋나면 던진다', () => {
    expect(() => fromDateKey('2026-7-29')).toThrow(/날짜 형식/)
    expect(() => fromDateKey('오늘')).toThrow(/날짜 형식/)
    expect(() => fromDateKey('')).toThrow(/날짜 형식/)
  })
})

describe('shiftDateKey', () => {
  it('하루씩 앞뒤로 옮긴다', () => {
    expect(shiftDateKey('2026-07-29', -1)).toBe('2026-07-28')
    expect(shiftDateKey('2026-07-29', 1)).toBe('2026-07-30')
  })

  it('월 경계를 넘긴다', () => {
    expect(shiftDateKey('2026-07-31', 1)).toBe('2026-08-01')
    expect(shiftDateKey('2026-08-01', -1)).toBe('2026-07-31')
  })

  it('연 경계를 넘긴다', () => {
    expect(shiftDateKey('2026-12-31', 1)).toBe('2027-01-01')
  })

  it('윤년 2월을 제대로 넘긴다', () => {
    expect(shiftDateKey('2028-02-28', 1)).toBe('2028-02-29')
    expect(shiftDateKey('2026-02-28', 1)).toBe('2026-03-01')
  })
})

describe('formatDateLabel', () => {
  it('월·일과 요일을 함께 보여준다', () => {
    // 2026-07-29는 수요일
    expect(formatDateLabel('2026-07-29')).toBe('7월 29일 (수)')
  })
})

describe('formatRelativeDateLabel', () => {
  const today = '2026-07-29'

  it('오늘·어제·내일은 이름으로 보여준다', () => {
    expect(formatRelativeDateLabel('2026-07-29', today)).toBe('오늘')
    expect(formatRelativeDateLabel('2026-07-28', today)).toBe('어제')
    expect(formatRelativeDateLabel('2026-07-30', today)).toBe('내일')
  })

  it('그 밖의 날짜는 날짜 그대로 보여준다', () => {
    expect(formatRelativeDateLabel('2026-07-27', today)).toBe('7월 27일 (월)')
  })
})

describe('isValidDateKey', () => {
  it('올바른 형식을 통과시킨다', () => {
    expect(isValidDateKey('2026-07-29')).toBe(true)
    expect(isValidDateKey('2028-02-29')).toBe(true) // 윤년
  })

  it('형식이 어긋나면 거부한다', () => {
    expect(isValidDateKey('2026-7-29')).toBe(false)
    expect(isValidDateKey('')).toBe(false)
    expect(isValidDateKey('오늘')).toBe(false)
  })

  it('달력에 없는 날짜를 거부한다 — 3월로 굴러가지 않게', () => {
    expect(isValidDateKey('2026-02-31')).toBe(false)
    expect(isValidDateKey('2026-02-29')).toBe(false) // 평년
    expect(isValidDateKey('2026-13-01')).toBe(false)
  })
})

describe('daysBetweenKeys', () => {
  it('두 날짜의 일수 차이를 센다', () => {
    expect(daysBetweenKeys('2026-01-15', '2026-04-09')).toBe(84)
  })

  it('같은 날은 0이다', () => {
    expect(daysBetweenKeys('2026-07-29', '2026-07-29')).toBe(0)
  })

  it('거꾸로면 음수다 — 기간이 지났는지 판단하는 근거', () => {
    expect(daysBetweenKeys('2026-07-29', '2026-07-28')).toBe(-1)
  })

  it('연 경계를 넘어 센다', () => {
    expect(daysBetweenKeys('2026-12-31', '2027-01-01')).toBe(1)
  })

  it('윤년의 2월을 포함해 센다', () => {
    // 2028은 윤년이라 2월이 29일
    expect(daysBetweenKeys('2028-02-01', '2028-03-01')).toBe(29)
    expect(daysBetweenKeys('2026-02-01', '2026-03-01')).toBe(28)
  })

  it('shiftDateKey와 왕복이 맞는다', () => {
    const start = '2026-01-15'
    const end = shiftDateKey(start, 84)
    expect(daysBetweenKeys(start, end)).toBe(84)
  })
})
