/**
 * @vitest-environment jsdom
 *
 * 화면이 명세의 숫자와 문구를 실제로 그리는지 확인한다.
 * DayContext·AuthContext를 대역으로 바꿔 Supabase 없이 검증한다.
 */
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { summarizeDay } from '../../domain/summary'
import type { ExerciseEntry, MealEntry, Profile } from '../../domain/types'
import { addWeeks } from '../../lib/date'

const TODAY = '2026-07-29'

const profile: Profile = {
  userId: 'u1',
  sex: 'male',
  age: 30,
  heightCm: 175,
  weightKg: 75,
  activityLevel: 1.2,
  goal: 'lose',
  targetWeightKg: 70,
  targetDate: addWeeks(TODAY, 12),
  startedOn: TODAY,
  startWeightKg: 75,
}

const breakfast: MealEntry = {
  id: 'm1',
  userId: 'u1',
  date: TODAY,
  slot: 'breakfast',
  foodName: '삶은 달걀',
  amountG: 100,
  nutrition: { kcal: 420, carbG: 37.1, proteinG: 18.2, fatG: 21.4 },
  createdAt: '',
}

const jog: ExerciseEntry = {
  id: 'e1',
  userId: 'u1',
  date: TODAY,
  time: '07:10',
  name: '조깅 (8km/h)',
  source: 'met',
  met: 8.3,
  minutes: 30,
  kcal: 311,
  kind: 'cardio',
  weightSnapshotKg: 75,
  createdAt: '',
}

interface DayOverrides {
  profile?: Profile | null
  meals?: MealEntry[]
  exercises?: ExerciseEntry[]
}

const dayState = { current: buildDay({}) }

function buildDay({ profile: p = profile, meals = [], exercises = [] }: DayOverrides) {
  const derived = summarizeDay({ date: TODAY, profile: p, meals, exercises })
  return {
    ...derived,
    date: TODAY,
    profile: p,
    meals,
    exercises,
    fridge: [],
    customFoods: [],
    loading: false,
    error: null,
    reload: async () => {},
    setProfile: () => {},
  }
}

vi.mock('../../app/DayContext', () => ({
  useDay: () => dayState.current,
  DayProvider: ({ children }: { children: React.ReactNode }) => children,
}))

vi.mock('../../app/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'u1' },
    loading: false,
    signIn: async () => {},
    signUp: async () => ({ needsConfirm: false }),
    signOut: async () => {},
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}))

// 하루가 끝나갈 시점 안내를 검증하려면 시각을 고정해야 한다
let mockHour = 12
vi.mock('../../lib/date', async () => {
  const actual = await vi.importActual<typeof import('../../lib/date')>('../../lib/date')
  return {
    ...actual,
    todayKey: () => TODAY,
    currentHour: () => mockHour,
    nowTime: () => '12:00',
  }
})

const { default: DashboardPage } = await import('../dashboard/DashboardPage')
const { default: ExercisePage } = await import('../exercise/ExercisePage')
const { default: SuggestPage } = await import('../suggest/SuggestPage')

function renderPage(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>)
}

beforeEach(() => {
  mockHour = 12
})
afterEach(cleanup)

describe('F7 대시보드', () => {
  it('S2 — 아침 420 기록 시 420 / 1,581 과 잔여 1,161', () => {
    dayState.current = buildDay({ meals: [breakfast] })
    renderPage(<DashboardPage />)

    expect(screen.getByText('420')).toBeTruthy()
    expect(screen.getByText('/ 1,581 kcal')).toBeTruthy()
    expect(screen.getByText('남은 칼로리')).toBeTruthy()
    expect(screen.getByText('1,161')).toBeTruthy()
  })

  it('S3 — 목표 구성을 기본 1,581 + 운동 311 = 1,892 로 분해해 보여준다', () => {
    dayState.current = buildDay({ meals: [breakfast], exercises: [jog] })
    renderPage(<DashboardPage />)

    expect(screen.getByText(/기본 목표 1,581 \+ 운동 311 = 오늘 목표 1,892 kcal/)).toBeTruthy()
    expect(screen.getByText('운동으로 +311 kcal')).toBeTruthy()
    expect(screen.getByText('1,472')).toBeTruthy()
  })

  it('S6 — 밤에 섭취가 BMR 미만이면 부족 안내와 운동 보충 맥락을 함께 띄운다', () => {
    mockHour = 22
    const lunch: MealEntry = {
      ...breakfast,
      id: 'm2',
      slot: 'lunch',
      foodName: '닭가슴살 샐러드',
      nutrition: { kcal: 520, carbG: 16, proteinG: 45, fatG: 26 },
    }
    const dinner: MealEntry = {
      ...breakfast,
      id: 'm3',
      slot: 'dinner',
      foodName: '두부 계란찜',
      nutrition: { kcal: 510, carbG: 69, proteinG: 25, fatG: 15 },
    }
    dayState.current = buildDay({ meals: [breakfast, lunch, dinner], exercises: [jog] })
    renderPage(<DashboardPage />)

    expect(screen.getByText(/목표보다 442 kcal 적게 드셨어요/)).toBeTruthy()
    expect(screen.getByText(/운동으로 311 kcal를 쓰셨는데 그만큼 보충하지 않으셨네요/)).toBeTruthy()
    expect(screen.getByText(/기초대사량\(1,699 kcal\)보다도 적어서/)).toBeTruthy()
  })

  it('초과해도 경고가 아닌 중립 표현을 쓴다', () => {
    dayState.current = buildDay({
      meals: [{ ...breakfast, nutrition: { ...breakfast.nutrition, kcal: 2000 } }],
    })
    renderPage(<DashboardPage />)
    expect(screen.getByText('초과한 칼로리')).toBeTruthy()
    expect(screen.queryByText(/경고/)).toBeNull()
  })

  it('프로필이 없으면 목표를 0으로 표시하지 않는다', () => {
    dayState.current = buildDay({ profile: null, meals: [breakfast] })
    renderPage(<DashboardPage />)
    expect(screen.getByText(/프로필을 설정하면 목표와 잔여 칼로리를 볼 수 있어요/)).toBeTruthy()
    expect(screen.queryByText('남은 칼로리')).toBeNull()
  })

  it('기록이 없으면 빈 상태를 보여준다', () => {
    dayState.current = buildDay({})
    renderPage(<DashboardPage />)
    expect(screen.getByText('아직 오늘 기록이 없어요')).toBeTruthy()
  })
})

describe('F3 운동 화면', () => {
  it('S3 — 계산식과 늘어난 양을 노출한다', () => {
    dayState.current = buildDay({ exercises: [jog] })
    renderPage(<ExercisePage />)

    expect(screen.getByText(/기본 목표 1,581 \+ 운동 311 = 오늘 목표 1,892 kcal/)).toBeTruthy()
    expect(screen.getByText(/MET 8.3 × 75kg × 0.50시간/)).toBeTruthy()
    expect(screen.getByText('운동으로 +311 kcal')).toBeTruthy()
  })

  it('다이어트 목표면 추정치 안내를 띄운다', () => {
    dayState.current = buildDay({ exercises: [jog] })
    renderPage(<ExercisePage />)
    expect(
      screen.getByText(/소모 칼로리는 추정치예요.*절반 정도만 채우는 걸 권해요/),
    ).toBeTruthy()
  })

  it('근력운동을 기록하면 단백질 목표 상향을 알린다', () => {
    const weights: ExerciseEntry = {
      ...jog,
      id: 'e2',
      name: '웨이트 (보통 강도)',
      met: 3.5,
      minutes: 40,
      kcal: 175,
      kind: 'strength',
    }
    dayState.current = buildDay({ exercises: [weights] })
    renderPage(<ExercisePage />)
    expect(screen.getByText(/단백질 목표가 120g으로 올라갔어요/)).toBeTruthy()
  })

  it('소모 합계가 기본 목표를 넘으면 입력 확인을 요청한다', () => {
    const huge: ExerciseEntry = { ...jog, id: 'e3', name: '줄넘기', kcal: 2000, met: 11.8, minutes: 180 }
    dayState.current = buildDay({ exercises: [huge] })
    renderPage(<ExercisePage />)
    expect(screen.getByText(/입력이 맞는지 확인해주세요/)).toBeTruthy()
  })

  it('프로필이 없으면 MET 경로를 막고 직접 입력을 안내한다', () => {
    dayState.current = buildDay({ profile: null })
    renderPage(<ExercisePage />)
    expect(screen.getByText(/체중을 모르면 소모 칼로리를 계산할 수 없어요/)).toBeTruthy()
    expect(screen.getByRole('button', { name: '운동 선택' }).hasAttribute('disabled')).toBe(true)
  })
})

describe('F5 추천 화면', () => {
  it('S4 — 점심 몫 491, 단백질 101g 부족, 닭가슴살 샐러드가 최상단', () => {
    dayState.current = buildDay({ meals: [breakfast], exercises: [jog] })
    renderPage(<SuggestPage />)

    expect(screen.getByText('점심 몫')).toBeTruthy()
    expect(screen.getByText('491')).toBeTruthy()
    expect(screen.getAllByText(/오늘 단백질이 101g 부족해요/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/운동으로 311 kcal가 추가됐어요\./).length).toBeGreaterThan(0)

    const headings = screen.getAllByRole('heading', { level: 3 })
    expect(headings[0].textContent).toBe('닭가슴살 샐러드')
  })

  it('잔여가 음수면 가벼운 음식을 권한다', () => {
    dayState.current = buildDay({
      meals: [{ ...breakfast, nutrition: { ...breakfast.nutrition, kcal: 3000 } }],
    })
    renderPage(<SuggestPage />)
    expect(screen.getByText('오늘 목표를 넘었어요. 가벼운 음식은 어떨까요?')).toBeTruthy()
  })

  it('프로필이 없으면 사용할 수 없고 설정으로 유도한다', () => {
    dayState.current = buildDay({ profile: null })
    renderPage(<SuggestPage />)
    const card = screen.getByText('프로필이 필요해요').closest('section')!
    expect(within(card).getByText('프로필 설정')).toBeTruthy()
  })
})
