/**
 * F5 화면 통합 테스트 — 명세 318~349줄, 시나리오 S4(459~467줄).
 *
 * 도메인 테스트(`domain/recommend.test.ts`)가 배분·정렬 계산을 검증한다. 여기서는
 * 저장된 프로필·기록이 화면까지 제대로 흘러가는지, 명세가 요구한 네 갈래 분기가
 * 실제로 갈리는지를 본다.
 *
 * **S4를 그대로 재현할 수는 없다.** S4의 잔여 1,472kcal은 운동 소모 311kcal을
 * 전제하는데 F3(운동 기록)이 아직 없어 화면이 넣을 값이 0이다. 그래서 운동을 뺀
 * 같은 상황(잔여 1,163kcal)으로 검증하고, 운동이 붙었을 때의 값은 도메인
 * 테스트가 이미 고정해 두었다.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { MealSlot, Profile } from '../../domain/types'
import { todayKey } from '../../domain/date'
import { saveProfile } from '../../data/profileRepo'
import { createLocalDietRepository } from '../../data/repo'
import { SuggestPage } from './SuggestPage'

/**
 * 명세 계산 예시 ㉮ — 남 30세 175cm 75kg 사무직, 70kg · 12주 감량.
 * 기본 목표 1,581kcal / 탄 158 · 단 119 · 지 53g.
 */
const 예시_프로필: Profile = {
  sex: 'male',
  age: 30,
  heightCm: 175,
  weightKg: 75,
  activityLevel: 'sedentary',
  dietGoal: 'lose',
  targetWeightKg: 70,
  goalDurationDays: 84,
  goalStartDate: todayKey(),
}

/**
 * S4의 아침 상태를 만든다. 식빵 100g + 달걀 100g = 418kcal (탄 51.7 · 단 21.6 · 지 13).
 *
 * 명세 S2의 420kcal에 가깝고, **탄수 위주라 단백질이 최대 부족 영양소가 된다** —
 * 명세 463줄이 요구하는 "단백질이 많은 음식을 우선 정렬"이 이 조건에서 나온다.
 * 달걀만 기록하면 탄수가 최대 부족이 되어 명세와 반대 결과가 된다.
 */
function 아침을_기록한다(slot: MealSlot = 'breakfast') {
  const repo = createLocalDietRepository()
  const date = todayKey()

  repo.addEntry({ date, slot, foodId: 'seed-bread-white', amount: { unit: 'g', value: 100 } })
  repo.addEntry({ date, slot, foodId: 'seed-egg', amount: { unit: 'g', value: 100 } })
}

/** 배분 근거 카드에서 한 줄을 라벨로 집어온다 */
function budgetRow(label: string | RegExp): HTMLElement {
  const node = screen.getByText(label).closest('.budget-row')
  if (!node) throw new Error(`배분 근거에서 ${label} 줄을 찾을 수 없습니다`)
  return node as HTMLElement
}

function suggestionCards(): HTMLElement[] {
  return Array.from(document.querySelectorAll('.suggestion-card')) as HTMLElement[]
}

beforeEach(() => {
  // 점심 시각에 화면을 연 것으로 고정한다. 기본 끼니 선택이 시각에 따라 달라진다.
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(new Date(2026, 6, 29, 12, 0, 0))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('F1 미완료', () => {
  it('추천 대신 프로필 설정으로 유도한다 (명세 349줄)', () => {
    render(<SuggestPage onGoToProfile={() => {}} />)

    expect(screen.getByText(/프로필을 먼저 설정해 주세요/)).toBeTruthy()
    expect(screen.getByRole('button', { name: '프로필 설정하기' })).toBeTruthy()
    // 기준선이 없으면 배분도 목록도 낼 수 없다
    expect(suggestionCards()).toHaveLength(0)
  })

  it('버튼이 프로필 화면으로 보낸다', async () => {
    const onGoToProfile = vi.fn()
    render(<SuggestPage onGoToProfile={onGoToProfile} />)

    await userEvent.click(screen.getByRole('button', { name: '프로필 설정하기' }))
    expect(onGoToProfile).toHaveBeenCalledOnce()
  })
})

describe('정상 추천 — S4 상황 (운동 제외)', () => {
  beforeEach(() => {
    saveProfile(예시_프로필)
    아침을_기록한다()
  })

  it('아침을 먹었으면 점심을 기본으로 고른다', () => {
    render(<SuggestPage />)

    expect(screen.getByRole('button', { name: /점심/ }).getAttribute('aria-pressed')).toBe('true')
  })

  it('오늘 목표와 잔여를 근거로 낸다', () => {
    render(<SuggestPage />)

    // 기본 목표 1,581 + 운동 0
    expect(within(budgetRow('오늘 목표')).getByText('1,581 kcal')).toBeTruthy()
    // 1,581 − 418
    expect(within(budgetRow('잔여')).getByText('+1,163 kcal')).toBeTruthy()
  })

  it('남은 세 끼로 균등 분할해 점심 몫을 보여준다 (명세 334~336줄)', () => {
    render(<SuggestPage />)

    const row = budgetRow(/점심 몫/)
    // 1,163 ÷ 3 = 387.67
    expect(within(row).getByText('약 388 kcal')).toBeTruthy()
    expect(within(row).getByText(/잔여 ÷ 남은 3끼/)).toBeTruthy()
  })

  it('부족한 영양소를 이유로 밝힌다 — 단백질 (명세 343줄, 463줄)', () => {
    render(<SuggestPage />)

    const reasons = screen.getByLabelText('추천 이유')
    // 목표 119g − 섭취 21.6g = 97.4g
    expect(within(reasons).getByText('단백질이 97g 부족해요')).toBeTruthy()
  })

  it('운동 기록이 없으면 운동 문구를 내지 않는다', () => {
    render(<SuggestPage />)

    expect(screen.queryByText(/운동으로 .* kcal가 추가됐어요/)).toBeNull()
  })

  it('추천 음식을 3~5개 낸다 (명세 341줄)', () => {
    render(<SuggestPage />)

    const cards = suggestionCards()
    expect(cards.length).toBeGreaterThanOrEqual(3)
    expect(cards.length).toBeLessThanOrEqual(5)
  })

  it('각 음식의 칼로리와 탄단지를 함께 낸다 (명세 342줄)', () => {
    render(<SuggestPage />)

    const first = suggestionCards()[0]!
    expect(first.querySelector('.suggestion-kcal')?.textContent).toMatch(/[\d,]+kcal/)

    const macros = within(first)
    expect(macros.getByText('탄수')).toBeTruthy()
    expect(macros.getByText('단백')).toBeTruthy()
    expect(macros.getByText('지방')).toBeTruthy()
  })

  it('최상단 후보를 시각적으로 구분한다', () => {
    render(<SuggestPage />)

    const cards = suggestionCards()
    expect(cards[0]!.className).toContain('top')
    expect(cards[1]!.className).not.toContain('top')
  })

  it('1인분이 아닌 후보는 배수를 드러낸다', () => {
    render(<SuggestPage />)

    // 씨드 1인분 칼로리가 몫보다 작은 음식은 배수가 붙는다.
    // 후보가 하나도 없으면 이 테스트가 무의미해지므로 존재부터 고정한다.
    const scaled = document.querySelectorAll('.suggestion-servings.scaled')
    expect(scaled.length).toBeGreaterThan(0)

    Array.from(scaled).forEach((node) => {
      expect(node.textContent).toMatch(/^\d+(\.\d)?인분$/)
      expect(node.textContent).not.toBe('1인분')
    })
  })

  it('끼니를 바꾸면 남은 끼니 수가 줄어 몫이 커진다', async () => {
    render(<SuggestPage />)

    await userEvent.click(screen.getByRole('button', { name: /저녁/ }))

    // 저녁·간식 두 끼 → 1,163 ÷ 2 = 581.5
    const row = budgetRow(/저녁 몫/)
    expect(within(row).getByText('약 582 kcal')).toBeTruthy()
    expect(within(row).getByText(/잔여 ÷ 남은 2끼/)).toBeTruthy()
  })

  it('기록이 있는 끼니를 표시한다', () => {
    render(<SuggestPage />)

    expect(within(screen.getByRole('button', { name: /아침/ })).getByLabelText('기록 있음')).toBeTruthy()
    expect(within(screen.getByRole('button', { name: /저녁/ })).queryByLabelText('기록 있음')).toBeNull()
  })
})

describe('목표를 넘긴 날 (명세 347줄)', () => {
  beforeEach(() => {
    saveProfile(예시_프로필)

    // 1,581kcal을 넘기도록 식빵 700g = 1,925kcal
    const repo = createLocalDietRepository()
    repo.addEntry({
      date: todayKey(),
      slot: 'breakfast',
      foodId: 'seed-bread-white',
      amount: { unit: 'g', value: 700 },
    })
  })

  it('경고가 아니라 가벼운 음식을 권한다', () => {
    render(<SuggestPage />)

    expect(screen.getByText('오늘 목표를 넘었어요. 가벼운 음식은 어떨까요?')).toBeTruthy()
    expect(suggestionCards().length).toBeGreaterThan(0)
  })

  it('초과분을 음수로 그대로 보여준다 (명세 225줄)', () => {
    render(<SuggestPage />)

    // 1,581 − 1,925
    expect(within(budgetRow('초과')).getByText('-344 kcal')).toBeTruthy()
  })

  it('배분이 무의미하므로 끼니 몫을 내지 않는다', () => {
    render(<SuggestPage />)

    expect(screen.queryByText(/몫/)).toBeNull()
  })

  it('제안하는 음식은 모두 저칼로리다', () => {
    render(<SuggestPage />)

    suggestionCards().forEach((card) => {
      const text = card.querySelector('.suggestion-kcal')?.textContent ?? ''
      const kcal = Number(text.replace(/[^\d]/g, ''))
      expect(kcal).toBeLessThanOrEqual(200)
    })
  })
})

describe('잔여가 적은 날 (명세 348줄)', () => {
  beforeEach(() => {
    saveProfile(예시_프로필)

    // 잔여를 200kcal 미만으로 만든다. 식빵 520g = 1,430kcal → 잔여 151kcal
    const repo = createLocalDietRepository()
    repo.addEntry({
      date: todayKey(),
      slot: 'breakfast',
      foodId: 'seed-bread-white',
      amount: { unit: 'g', value: 520 },
    })
  })

  it('정식 끼니 대신 간식을 권한다', () => {
    render(<SuggestPage />)

    expect(
      screen.getByText('남은 칼로리가 적어요. 정식 끼니보다 간식으로 채우는 걸 권해요.'),
    ).toBeTruthy()
  })
})

describe('네 끼니를 모두 기록한 날 (명세 349줄)', () => {
  beforeEach(() => {
    saveProfile(예시_프로필)
    ;(['breakfast', 'lunch', 'dinner', 'snack'] as MealSlot[]).forEach((slot) => {
      const repo = createLocalDietRepository()
      repo.addEntry({ date: todayKey(), slot, foodId: 'seed-egg', amount: { unit: 'g', value: 50 } })
    })
  })

  it('기록이 끝났음을 알린다', () => {
    render(<SuggestPage />)

    expect(screen.getByText(/오늘 기록이 끝났어요/)).toBeTruthy()
  })
})
