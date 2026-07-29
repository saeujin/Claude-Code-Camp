/**
 * F1 화면 통합 테스트.
 *
 * 계산 정확성은 `domain/profile.test.ts`가 명세 예시로 검증한다. 여기서는 그
 * 계산이 화면에 제대로 흘러가는지, 명세의 표시·안내 요구(182~199줄)를 지키는지를 본다.
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { UserEvent } from '@testing-library/user-event'
import { ProfilePage } from './ProfilePage'
import { loadProfile } from '../../data/profileRepo'

/** 명세 계산 예시 ㉮ 입력 — 남 30세 175cm 75kg 사무직, 목표 70kg · 12주 */
async function fillExampleProfile(user: UserEvent, options: { goal?: string } = {}) {
  await user.click(screen.getByRole('button', { name: '남성' }))
  await user.type(screen.getByLabelText(/나이/), '30')
  await user.type(screen.getByLabelText('키 (cm)'), '175')
  await user.type(screen.getByLabelText('몸무게 (kg)'), '75')
  await user.click(screen.getByRole('radio', { name: /사무직/ }))

  if (options.goal) await user.click(screen.getByRole('button', { name: options.goal }))
  if (options.goal === '유지') return

  await user.type(screen.getByLabelText('목표 체중 (kg)'), '70')
  await user.type(screen.getByLabelText('목표 기간 (주)'), '12')
}

function breakdown(): HTMLElement | null {
  return document.querySelector('.breakdown')
}

describe('ProfilePage', () => {
  let user: UserEvent

  beforeEach(() => {
    user = userEvent.setup()
  })

  it('입력 전에는 계산 결과가 없고 저장 버튼이 잠겨 있다 (명세 192줄)', () => {
    render(<ProfilePage />)

    expect(breakdown()).toBeNull()
    expect(screen.getByRole('button', { name: '목표 저장' })).toHaveProperty('disabled', true)
  })

  it('활동 수준에 운동 제외 안내를 보여준다 (명세 189줄)', () => {
    render(<ProfilePage />)
    expect(screen.getByText(/운동은 따로 기록하니 여기서는 빼고 골라주세요/)).toBeDefined()
  })

  describe('명세 계산 예시 ㉮ — 감량', () => {
    it('BMR · TDEE · 기본 목표를 단계별로 보여준다 (명세 183줄)', async () => {
      render(<ProfilePage />)
      await fillExampleProfile(user)

      const panel = breakdown()
      expect(panel).not.toBeNull()
      expect(panel?.textContent).toContain('1,698.75') // BMR — 반올림하지 않는다
      expect(panel?.textContent).toContain('2,039') // TDEE
      expect(panel?.textContent).toContain('1,581') // 기본 목표
    })

    it('일일 조정량을 얼마나 덜 먹는지로 알려준다 (명세 184줄)', async () => {
      render(<ProfilePage />)
      await fillExampleProfile(user)

      expect(screen.getByText(/하루 458 kcal 덜 먹게 됩니다/)).toBeDefined()
    })

    it('주당 변화 속도와 목표 달성 예정일을 보여준다 (명세 185~186줄)', async () => {
      render(<ProfilePage />)
      await fillExampleProfile(user)

      expect(screen.getByText('0.42 kg/주')).toBeDefined()
      expect(screen.getByText('목표 달성 예정일')).toBeDefined()
    })

    it('목표 탄단지 그램을 보여준다 (명세 187줄)', async () => {
      render(<ProfilePage />)
      await fillExampleProfile(user)

      const panel = breakdown()
      expect(panel?.textContent).toContain('158g') // 탄수
      expect(panel?.textContent).toContain('119g') // 단백
      expect(panel?.textContent).toContain('53g') // 지방
    })

    it('목표가 BMR보다 낮다고 알리되 값은 바꾸지 않는다 (명세 188줄)', async () => {
      render(<ProfilePage />)
      await fillExampleProfile(user)

      expect(screen.getByText(/기초대사량보다 낮습니다/)).toBeDefined()
      // 1,699로 보정되지 않았다
      expect(breakdown()?.textContent).toContain('1,581')
    })

    it('특수 상황 안내를 노출한다 (명세 199줄)', async () => {
      render(<ProfilePage />)
      await fillExampleProfile(user)

      expect(screen.getByText(/임신·수유·질환/)).toBeDefined()
    })
  })

  describe('유지 목표', () => {
    it('목표 체중·기간을 입력받지 않는다 (명세 99줄)', async () => {
      render(<ProfilePage />)
      await user.click(screen.getByRole('button', { name: '유지' }))

      expect(screen.queryByLabelText('목표 체중 (kg)')).toBeNull()
      expect(screen.queryByLabelText('목표 기간 (주)')).toBeNull()
      expect(screen.getByText(/유지 목표는 목표 체중과 기간을 받지 않습니다/)).toBeDefined()
    })

    it('기본 목표가 TDEE와 같다 (명세 128줄)', async () => {
      render(<ProfilePage />)
      await fillExampleProfile(user, { goal: '유지' })

      const panel = breakdown()
      // TDEE 2,039 = 기본 목표
      expect(panel?.textContent).toContain('2,039')
      expect(panel?.textContent).not.toContain('일일 조정량')
    })
  })

  describe('목표 기간 환산 (명세 100줄)', () => {
    it('주 수를 넣으면 일수를 함께 보여준다', async () => {
      render(<ProfilePage />)
      await fillExampleProfile(user)

      // 계산 결과의 '남은 기간'도 84일이라, 기간 입력 영역 안에서만 찾는다
      const period = document.querySelector('.goal-period')
      expect(period?.textContent).toContain('12주 =')
      expect(period?.textContent).toContain('84일')
    })
  })

  describe('저장', () => {
    it('저장하면 프로필이 남는다', async () => {
      render(<ProfilePage />)
      await fillExampleProfile(user)
      await user.click(screen.getByRole('button', { name: '목표 저장' }))

      const saved = loadProfile()
      expect(saved?.weightKg).toBe(75)
      expect(saved?.targetWeightKg).toBe(70)
      expect(saved?.goalDurationDays).toBe(84)
    })

    it('저장 후 onSaved를 호출해 F2가 목표를 다시 읽게 한다', async () => {
      let notified = 0
      render(<ProfilePage onSaved={() => { notified += 1 }} />)
      await fillExampleProfile(user)
      await user.click(screen.getByRole('button', { name: '목표 저장' }))

      expect(notified).toBe(1)
    })

    it('저장하면 안내 문구를 보여준다', async () => {
      render(<ProfilePage />)
      await fillExampleProfile(user)
      await user.click(screen.getByRole('button', { name: '목표 저장' }))

      expect(screen.getByText(/목표를 저장했습니다/)).toBeDefined()
    })

    it('저장된 프로필이 있으면 폼을 채우고 결과를 바로 보여준다', async () => {
      const first = render(<ProfilePage />)
      await fillExampleProfile(user)
      await user.click(screen.getByRole('button', { name: '목표 저장' }))
      first.unmount()

      render(<ProfilePage />)

      expect(screen.getByLabelText('몸무게 (kg)')).toHaveProperty('value', '75')
      expect(breakdown()?.textContent).toContain('1,581')
      expect(screen.getByRole('button', { name: '목표 다시 저장' })).toBeDefined()
    })
  })

  describe('예외 안내', () => {
    it('목표 체중 = 현재 체중이면 유지로 처리했다고 알린다 (명세 194줄)', async () => {
      render(<ProfilePage />)
      await user.click(screen.getByRole('button', { name: '남성' }))
      await user.type(screen.getByLabelText(/나이/), '30')
      await user.type(screen.getByLabelText('키 (cm)'), '175')
      await user.type(screen.getByLabelText('몸무게 (kg)'), '75')
      await user.click(screen.getByRole('radio', { name: /사무직/ }))
      await user.type(screen.getByLabelText('목표 체중 (kg)'), '75')
      await user.type(screen.getByLabelText('목표 기간 (주)'), '12')

      expect(screen.getByText(/유지 목표로 처리했습니다/)).toBeDefined()
    })

    it('범위를 벗어난 나이를 저장하려 하면 오류를 보여준다 (명세 193줄)', async () => {
      render(<ProfilePage />)
      await fillExampleProfile(user)

      const age = screen.getByLabelText(/나이/)
      await user.clear(age)
      await user.type(age, '150')

      expect(screen.getByRole('button', { name: /목표 저장/ })).toHaveProperty('disabled', true)
    })
  })
})
