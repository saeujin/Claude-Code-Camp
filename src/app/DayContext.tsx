// 오늘 하루치 데이터를 한 곳에서 들고 있는다.
// 기록을 추가·삭제하면 여기서 다시 불러오고, 화면은 파생값만 읽는다.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  customFoodRepo,
  exerciseRepo,
  fridgeRepo,
  mealRepo,
  profileRepo,
} from '../db/repositories'
import { summarizeDay, type DayResult } from '../domain/summary'
import type { ExerciseEntry, Food, FridgeItem, MealEntry, Profile } from '../domain/types'
import { todayKey } from '../lib/date'
import { useAuth } from './AuthContext'

interface DayValue extends DayResult {
  date: string
  profile: Profile | null
  meals: MealEntry[]
  exercises: ExerciseEntry[]
  fridge: FridgeItem[]
  customFoods: Food[]
  loading: boolean
  error: string | null
  reload: () => Promise<void>
  setProfile: (p: Profile) => void
}

const DayContext = createContext<DayValue | null>(null)

export function DayProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [date] = useState(todayKey)
  const [profile, setProfileState] = useState<Profile | null>(null)
  const [meals, setMeals] = useState<MealEntry[]>([])
  const [exercises, setExercises] = useState<ExerciseEntry[]>([])
  const [fridge, setFridge] = useState<FridgeItem[]>([])
  const [customFoods, setCustomFoods] = useState<Food[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!user) {
      setProfileState(null)
      setMeals([])
      setExercises([])
      setFridge([])
      setCustomFoods([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const [p, m, e, f, cf] = await Promise.all([
        profileRepo.get(user.id),
        mealRepo.listByDate(user.id, date),
        exerciseRepo.listByDate(user.id, date),
        fridgeRepo.list(user.id),
        customFoodRepo.list(user.id),
      ])
      setProfileState(p)
      setMeals(m)
      setExercises(e)
      setFridge(f)
      setCustomFoods(cf)
    } catch (err) {
      setError(err instanceof Error ? err.message : '데이터를 불러오지 못했습니다')
    } finally {
      setLoading(false)
    }
  }, [user, date])

  useEffect(() => {
    void reload()
  }, [reload])

  const derived = useMemo(
    () => summarizeDay({ date, profile, meals, exercises }),
    [date, profile, meals, exercises],
  )

  const value: DayValue = {
    ...derived,
    date,
    profile,
    meals,
    exercises,
    fridge,
    customFoods,
    loading,
    error,
    reload,
    setProfile: setProfileState,
  }

  return <DayContext.Provider value={value}>{children}</DayContext.Provider>
}

export function useDay(): DayValue {
  const ctx = useContext(DayContext)
  if (!ctx) throw new Error('useDay는 DayProvider 안에서만 쓸 수 있습니다')
  return ctx
}
