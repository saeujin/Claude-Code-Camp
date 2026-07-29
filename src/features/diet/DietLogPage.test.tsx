/**
 * F2 화면 통합 테스트 — 사용자가 실제로 밟는 경로를 그대로 따라간다.
 *
 * 명세 203~226줄의 입력·출력·예외를 화면 수준에서 확인한다. 도메인 테스트가
 * 계산을 검증하고, 여기서는 그 계산이 화면에 제대로 흘러가는지를 본다.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { UserEvent } from '@testing-library/user-event'
import { DietLogPage } from './DietLogPage'
import { SAMPLE_TARGET } from '../target/dailyTarget'

/** 끼니 카드를 라벨로 집어온다 */
function slotCard(label: string): HTMLElement {
  const heading = screen.getByRole('heading', { name: label, level: 2 })
  const card = heading.closest('.slot-card')
  if (!card) throw new Error(`${label} 카드를 찾을 수 없습니다`)
  return card as HTMLElement
}

function summaryBar(): HTMLElement {
  const bar = document.querySelector('.summary-bar')
  if (!bar) throw new Error('요약바를 찾을 수 없습니다')
  return bar as HTMLElement
}

/** 열려 있는 시트. 기록 목록에 같은 이름이 있어도 시트 안만 보게 한다 */
function sheet(): HTMLElement {
  const el = document.querySelector('.sheet')
  if (!el) throw new Error('열린 시트가 없습니다')
  return el as HTMLElement
}

function consumedText(): string {
  return document.querySelector('.summary-consumed strong')?.textContent ?? ''
}

function remainingText(): string | null {
  return document.querySelector('.summary-remaining strong')?.textContent ?? null
}

/** 검색 → 선택 → 섭취량 입력 → 저장 */
async function addEntry(
  user: UserEvent,
  slot: string,
  query: string,
  foodName: string,
  amount?: string,
) {
  await user.click(within(slotCard(slot)).getByRole('button', { name: `+ ${slot} 추가` }))
  await user.type(screen.getByPlaceholderText('음식 이름으로 검색'), query)
  // 검색 결과는 시트 안에서 고른다 — 이미 기록된 같은 음식의 행과 헷갈리지 않게
  await user.click(within(sheet()).getByRole('button', { name: new RegExp(foodName) }))

  if (amount !== undefined) {
    const input = screen.getByLabelText(/섭취량/)
    await user.clear(input)
    await user.type(input, amount)
  }
  await user.click(screen.getByRole('button', { name: '기록에 추가' }))
}

describe('DietLogPage', () => {
  let user: UserEvent

  beforeEach(() => {
    user = userEvent.setup()
  })

  describe('초기 상태', () => {
    it('끼니 4개를 모두 보여준다', () => {
      render(<DietLogPage />)

      for (const label of ['아침', '점심', '저녁', '간식']) {
        expect(screen.getByRole('heading', { name: label, level: 2 })).toBeDefined()
      }
    })

    it('기록이 없는 끼니는 "기록 없음"으로 표시한다', () => {
      render(<DietLogPage />)
      expect(within(slotCard('아침')).getByText('기록 없음')).toBeDefined()
    })

    it('날짜는 오늘로 시작한다', () => {
      render(<DietLogPage />)
      expect(screen.getByText('오늘')).toBeDefined()
    })

    it('F1 미완료 상태에서는 잔여 칼로리를 표시하지 않는다 (명세 226줄)', () => {
      render(<DietLogPage />)

      expect(remainingText()).toBeNull()
      expect(within(summaryBar()).getByText(/목표 칼로리가 없어 잔여를 표시하지 못합니다/)).toBeDefined()
    })

    it('목표가 없어도 기록은 가능하다 (명세 226줄)', async () => {
      render(<DietLogPage />)
      await addEntry(user, '아침', '쌀밥', '쌀밥')

      expect(consumedText()).toContain('300')
      expect(remainingText()).toBeNull()
    })
  })

  describe('기록 추가', () => {
    it('쌀밥 1인분은 300kcal로 집계된다 — 210g × 1.43kcal/g', async () => {
      render(<DietLogPage />)
      await addEntry(user, '아침', '쌀밥', '쌀밥')

      expect(within(slotCard('아침')).getByText('300 kcal')).toBeDefined()
      expect(consumedText()).toContain('300')
    })

    it('저장 전에 환산 결과를 미리 보여준다', async () => {
      render(<DietLogPage />)

      await user.click(within(slotCard('아침')).getByRole('button', { name: '+ 아침 추가' }))
      await user.type(screen.getByPlaceholderText('음식 이름으로 검색'), '쌀밥')
      await user.click(screen.getByRole('button', { name: /쌀밥/ }))

      expect(document.querySelector('.preview-kcal')?.textContent).toContain('300')
    })

    it('g 단위로도 기록할 수 있다', async () => {
      render(<DietLogPage />)

      await user.click(within(slotCard('점심')).getByRole('button', { name: '+ 점심 추가' }))
      await user.type(screen.getByPlaceholderText('음식 이름으로 검색'), '쌀밥')
      await user.click(screen.getByRole('button', { name: /쌀밥/ }))
      await user.click(screen.getByRole('button', { name: 'g' }))

      const input = screen.getByLabelText(/섭취량/)
      await user.clear(input)
      await user.type(input, '100')
      await user.click(screen.getByRole('button', { name: '기록에 추가' }))

      expect(within(slotCard('점심')).getByText('143 kcal')).toBeDefined()
    })

    it('여러 끼니를 합산한다', async () => {
      render(<DietLogPage />)
      await addEntry(user, '아침', '쌀밥', '쌀밥')
      await addEntry(user, '점심', '바나나', '바나나')

      // 쌀밥 300.3 + 바나나 100.8 = 401.1 → 401
      expect(consumedText()).toContain('401')
    })

    it('1인분 중량 없이 등록한 음식은 인분 단위를 고를 수 없다', async () => {
      render(<DietLogPage />)

      // 씨드 음식은 전부 servingGram이 있으므로, 없는 음식을 직접 만들어야 한다
      await user.click(within(slotCard('점심')).getByRole('button', { name: '+ 점심 추가' }))
      await user.type(screen.getByPlaceholderText('음식 이름으로 검색'), '이름없는소스')
      await user.click(screen.getByRole('button', { name: '직접 입력해서 추가' }))
      await user.type(screen.getByLabelText('100g당 칼로리 (kcal)'), '250')
      await user.click(screen.getByRole('button', { name: '개인 음식으로 저장' }))

      expect(screen.getByRole('button', { name: '인분' })).toHaveProperty('disabled', true)
      expect(screen.getByRole('button', { name: 'g' })).toHaveProperty('disabled', false)
      // 기본 단위가 g으로 떨어져 있어야 한다
      expect(screen.getByLabelText('섭취량 (g)')).toBeDefined()
    })

    it('섭취량이 0이면 저장 버튼이 잠긴다', async () => {
      render(<DietLogPage />)

      await user.click(within(slotCard('아침')).getByRole('button', { name: '+ 아침 추가' }))
      await user.type(screen.getByPlaceholderText('음식 이름으로 검색'), '쌀밥')
      await user.click(screen.getByRole('button', { name: /쌀밥/ }))

      const input = screen.getByLabelText(/섭취량/)
      await user.clear(input)
      await user.type(input, '0')

      expect(screen.getByRole('button', { name: '기록에 추가' })).toHaveProperty('disabled', true)
      expect(screen.getByText(/0보다 커야/)).toBeDefined()
    })
  })

  describe('수정·삭제 시 즉시 재집계 (명세 224줄)', () => {
    it('0.5인분으로 줄이면 누적이 절반이 된다', async () => {
      render(<DietLogPage />)
      await addEntry(user, '아침', '쌀밥', '쌀밥')
      expect(consumedText()).toContain('300')

      await user.click(screen.getByRole('button', { name: '쌀밥 기록 수정' }))
      const input = screen.getByLabelText(/섭취량/)
      await user.clear(input)
      await user.type(input, '0.5')
      await user.click(screen.getByRole('button', { name: '기록에 추가' }))

      expect(consumedText()).toContain('150')
      expect(within(slotCard('아침')).getByText('150 kcal')).toBeDefined()
    })

    it('삭제하면 누적에서 빠진다', async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true)

      render(<DietLogPage />)
      await addEntry(user, '아침', '쌀밥', '쌀밥')
      await addEntry(user, '점심', '바나나', '바나나')
      expect(consumedText()).toContain('401')

      await user.click(screen.getByRole('button', { name: '쌀밥 기록 삭제' }))

      expect(consumedText()).toContain('101')
      expect(within(slotCard('아침')).getByText('기록 없음')).toBeDefined()
    })

    it('삭제 확인을 취소하면 기록이 남는다', async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(false)

      render(<DietLogPage />)
      await addEntry(user, '아침', '쌀밥', '쌀밥')
      await user.click(screen.getByRole('button', { name: '쌀밥 기록 삭제' }))

      expect(consumedText()).toContain('300')
    })
  })

  describe('잔여 칼로리', () => {
    async function setSampleTarget() {
      await user.click(screen.getByRole('button', { name: '임시 목표 설정' }))
      await user.click(screen.getByRole('button', { name: /명세 F1 예시값/ }))
      await user.click(screen.getByRole('button', { name: '목표 저장' }))
    }

    it('목표를 설정하면 잔여 칼로리가 나타난다', async () => {
      render(<DietLogPage />)
      await addEntry(user, '아침', '쌀밥', '쌀밥')
      await setSampleTarget()

      // 1,581 − 300 = 1,281
      expect(remainingText()).toContain('1,281')
      expect(within(summaryBar()).getByText('잔여')).toBeDefined()
    })

    it('목표를 초과하면 음수로 보여주고 기록을 막지 않는다 (명세 225줄)', async () => {
      render(<DietLogPage />)
      await setSampleTarget()
      // 후라이드 치킨 200g × 2인분 = 400g × 2.54 = 1,016kcal, 두 번이면 2,032
      await addEntry(user, '저녁', '후라이드', '후라이드 치킨', '2')
      await addEntry(user, '간식', '후라이드', '후라이드 치킨', '2')

      expect(within(summaryBar()).getByText('초과')).toBeDefined()
      expect(remainingText()).toContain('-')
      // 기록은 그대로 저장됐다
      expect(within(slotCard('저녁')).queryByText('기록 없음')).toBeNull()
    })

    it('목표를 해제하면 잔여 칼로리가 다시 사라진다', async () => {
      render(<DietLogPage />)
      await setSampleTarget()
      expect(remainingText()).not.toBeNull()

      await user.click(screen.getByRole('button', { name: '목표 수정' }))
      await user.click(screen.getByRole('button', { name: /목표 해제/ }))

      expect(remainingText()).toBeNull()
    })

    it('목표 탄단지가 있으면 진행바 3개를 보여준다', async () => {
      render(<DietLogPage />)
      await setSampleTarget()

      expect(document.querySelectorAll('.macro-bar-track')).toHaveLength(3)
      expect(SAMPLE_TARGET.carb).toBeGreaterThan(0)
    })
  })

  describe('개인 음식 직접 입력 (명세 215줄)', () => {
    async function registerCustomFood() {
      await user.click(within(slotCard('점심')).getByRole('button', { name: '+ 점심 추가' }))
      await user.type(screen.getByPlaceholderText('음식 이름으로 검색'), '엄마 김치볶음밥')

      await user.click(screen.getByRole('button', { name: '직접 입력해서 추가' }))
      await user.type(screen.getByLabelText('100g당 칼로리 (kcal)'), '180')
      await user.type(screen.getByLabelText('탄수화물'), '25')
      await user.type(screen.getByLabelText('단백질'), '6')
      await user.type(screen.getByLabelText('지방'), '5')
      await user.type(screen.getByLabelText(/1인분 중량/), '350')
      await user.click(screen.getByRole('button', { name: '개인 음식으로 저장' }))
    }

    it('검색 결과가 없으면 직접 입력을 안내한다', async () => {
      render(<DietLogPage />)

      await user.click(within(slotCard('점심')).getByRole('button', { name: '+ 점심 추가' }))
      await user.type(screen.getByPlaceholderText('음식 이름으로 검색'), '없는음식')

      expect(screen.getByText(/'없는음식'에 해당하는 음식이 없습니다/)).toBeDefined()
      expect(screen.getByRole('button', { name: '직접 입력해서 추가' })).toBeDefined()
    })

    it('검색어를 이름 초기값으로 물려받는다', async () => {
      render(<DietLogPage />)

      await user.click(within(slotCard('점심')).getByRole('button', { name: '+ 점심 추가' }))
      await user.type(screen.getByPlaceholderText('음식 이름으로 검색'), '엄마 김치볶음밥')
      await user.click(screen.getByRole('button', { name: '직접 입력해서 추가' }))

      expect(screen.getByLabelText('음식 이름')).toHaveProperty('value', '엄마 김치볶음밥')
    })

    it('저장하면 곧바로 섭취량 단계로 넘어간다', async () => {
      render(<DietLogPage />)
      await registerCustomFood()

      // 350g × 1.8kcal/g = 630kcal
      expect(document.querySelector('.preview-kcal')?.textContent).toContain('630')
    })

    it('등록한 음식으로 기록하면 누적에 반영된다', async () => {
      render(<DietLogPage />)
      await registerCustomFood()
      await user.click(screen.getByRole('button', { name: '기록에 추가' }))

      expect(within(slotCard('점심')).getByText('630 kcal')).toBeDefined()
    })

    it('다음 검색에서 재사용할 수 있다', async () => {
      render(<DietLogPage />)
      await registerCustomFood()
      await user.click(screen.getByRole('button', { name: '기록에 추가' }))

      await user.click(within(slotCard('간식')).getByRole('button', { name: '+ 간식 추가' }))
      await user.type(screen.getByPlaceholderText('음식 이름으로 검색'), '엄마')

      // 시트 안에서만 찾는다 — 점심 카드의 기록 행도 같은 이름을 갖고 있다
      expect(within(sheet()).getByRole('button', { name: /엄마 김치볶음밥/ })).toBeDefined()
      expect(within(sheet()).getByText('직접 입력')).toBeDefined()
    })

    it('칼로리를 비우면 저장할 수 없다', async () => {
      render(<DietLogPage />)

      await user.click(within(slotCard('점심')).getByRole('button', { name: '+ 점심 추가' }))
      await user.type(screen.getByPlaceholderText('음식 이름으로 검색'), '없는음식')
      await user.click(screen.getByRole('button', { name: '직접 입력해서 추가' }))

      expect(screen.getByRole('button', { name: '개인 음식으로 저장' })).toHaveProperty(
        'disabled',
        true,
      )
    })

    it('탄단지 역산과 크게 어긋나면 안내하지만 저장은 막지 않는다', async () => {
      render(<DietLogPage />)

      await user.click(within(slotCard('점심')).getByRole('button', { name: '+ 점심 추가' }))
      await user.type(screen.getByPlaceholderText('음식 이름으로 검색'), '수상한음식')
      await user.click(screen.getByRole('button', { name: '직접 입력해서 추가' }))
      await user.type(screen.getByLabelText('100g당 칼로리 (kcal)'), '500')
      await user.type(screen.getByLabelText('탄수화물'), '25')
      await user.type(screen.getByLabelText('단백질'), '6')
      await user.type(screen.getByLabelText('지방'), '5')

      expect(screen.getByText(/탄단지로 계산하면 약 169kcal입니다/)).toBeDefined()
      expect(screen.getByRole('button', { name: '개인 음식으로 저장' })).toHaveProperty(
        'disabled',
        false,
      )
    })
  })

  describe('날짜 이동', () => {
    it('어제로 옮기면 오늘 기록이 보이지 않는다', async () => {
      render(<DietLogPage />)
      await addEntry(user, '아침', '쌀밥', '쌀밥')

      await user.click(screen.getByRole('button', { name: '이전 날짜' }))

      expect(screen.getByText('어제')).toBeDefined()
      expect(within(slotCard('아침')).getByText('기록 없음')).toBeDefined()
      expect(consumedText()).toContain('0')
    })

    it('오늘로 돌아오면 기록이 복원된다', async () => {
      render(<DietLogPage />)
      await addEntry(user, '아침', '쌀밥', '쌀밥')

      await user.click(screen.getByRole('button', { name: '이전 날짜' }))
      await user.click(screen.getByRole('button', { name: '오늘로 이동' }))

      expect(consumedText()).toContain('300')
    })

    it('오늘일 때는 "오늘로 이동" 버튼이 없다', () => {
      render(<DietLogPage />)
      expect(screen.queryByRole('button', { name: '오늘로 이동' })).toBeNull()
    })
  })

  describe('저장 유지', () => {
    it('화면을 다시 마운트해도 기록이 남아 있다 — localStorage', async () => {
      const first = render(<DietLogPage />)
      await addEntry(user, '아침', '쌀밥', '쌀밥')
      first.unmount()

      render(<DietLogPage />)
      expect(consumedText()).toContain('300')
    })
  })
})
