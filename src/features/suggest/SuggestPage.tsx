// F5. 다음 식사 추천
// 계약: .claude/skills/f5-suggest/SKILL.md
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../app/AuthContext'
import { useDay } from '../../app/DayContext'
import { ProfileBanner } from '../../components/ProfileBanner'
import { Button, Card, Chip, EmptyState, Formula, Notice, Stat } from '../../components/ui'
import { FOODS } from '../../data'
import { mealRepo } from '../../db/repositories'
import { SLOT_LABEL } from '../../domain/constants'
import { remainingMealSlots, suggestMeals } from '../../domain/suggest'
import type { MealSlot, Nutrition } from '../../domain/types'
import { currentHour } from '../../lib/date'
import { gram, kcal, num } from '../../lib/format'

export default function SuggestPage() {
  const { user } = useAuth()
  const { date, summary, meals, customFoods, reload } = useDay()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loggedSlots = useMemo(
    () => Array.from(new Set(meals.map((m) => m.slot))) as MealSlot[],
    [meals],
  )
  const slots = useMemo(() => remainingMealSlots(loggedSlots, currentHour()), [loggedSlots])
  const foods = useMemo(() => [...customFoods, ...FOODS], [customFoods])

  const result = useMemo(
    () => (summary ? suggestMeals(summary, foods, slots) : null),
    [summary, foods, slots],
  )

  if (!summary || !result) {
    return (
      <div className="space-y-4">
        <header>
          <h1 className="text-xl font-bold">다음 식사 추천</h1>
        </header>
        <ProfileBanner blocking />
        <Card>
          <EmptyState
            icon="✨"
            title="프로필이 필요해요"
            description="목표 칼로리가 있어야 무엇을 얼마나 먹을지 계산할 수 있습니다."
            action={
              <Link to="/profile" className="rounded-[12px] bg-accent px-4 py-2 text-sm text-white">
                프로필 설정
              </Link>
            }
          />
        </Card>
      </div>
    )
  }

  const nextSlot = slots[0]

  async function add(name: string, amountG: number, nutrition: Nutrition) {
    if (!user || !nextSlot) return
    setBusyId(name)
    setError(null)
    try {
      await mealRepo.add(user.id, { date, slot: nextSlot, foodName: name, amountG, nutrition })
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : '기록하지 못했습니다')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-bold">다음 식사 추천</h1>
        <p className="mt-1 text-sm text-sub">
          지금까지 먹은 것과 오늘 한 운동을 감안했습니다.
        </p>
      </header>

      {error && <Notice tone="caution">{error}</Notice>}

      <Card>
        <div className="grid grid-cols-2 gap-3">
          <Stat
            label={summary.remaining >= 0 ? '남은 칼로리' : '초과한 칼로리'}
            value={num(Math.abs(summary.remaining))}
            unit="kcal"
            tone={summary.remaining >= 0 ? 'accent' : 'caution'}
          />
          {result.mode === 'normal' && nextSlot && (
            <Stat
              label={`${SLOT_LABEL[nextSlot]} 몫`}
              value={num(result.perMealKcal)}
              unit="kcal"
            />
          )}
        </div>

        {result.mode === 'normal' && (
          <Formula>
            {num(summary.remaining)} ÷ 남은 {result.remainingSlots.length}끼 ={' '}
            {num(result.perMealKcal)} kcal · 후보는 ±15% 범위
          </Formula>
        )}

        {summary.exerciseBurn > 0 && (
          <Notice tone="info">운동으로 {num(summary.exerciseBurn)} kcal가 추가됐어요.</Notice>
        )}

        {result.topGap && (
          <Notice tone="neutral">
            오늘 {result.topGap.label}이 {gram(result.topGap.amount)} 부족해요.
          </Notice>
        )}
      </Card>

      {result.mode === 'over' && (
        <Notice tone="caution">오늘 목표를 넘었어요. 가벼운 음식은 어떨까요?</Notice>
      )}
      {result.mode === 'snack' && (
        <Notice tone="caution">
          남은 칼로리가 적어서 정식 끼니 대신 간식 위주로 골랐어요.
        </Notice>
      )}
      {result.mode === 'done' && (
        <Card>
          <EmptyState
            icon="🌙"
            title="오늘 기록이 끝났어요"
            description="아침·점심·저녁·간식이 모두 기록되어 배분할 끼니가 없습니다."
          />
        </Card>
      )}

      {result.items.map((s) => (
        <Card key={s.food.id}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <h3 className="font-semibold">{s.food.name}</h3>
                {s.outOfRange && <Chip tone="caution">범위 밖</Chip>}
                {result.topGap && s.nutrition[result.topGap.key] > 0 && (
                  <Chip tone="accent">{result.topGap.label} 보충</Chip>
                )}
              </div>
              <div className="tnum mt-1 text-sm text-sub">
                {num(s.amountG)}g · 탄 {gram(s.nutrition.carbG)} · 단{' '}
                {gram(s.nutrition.proteinG)} · 지 {gram(s.nutrition.fatG)}
              </div>
              <p className="mt-2 text-xs text-sub">
                {result.topGap
                  ? `오늘 ${result.topGap.label}이 ${gram(result.topGap.amount)} 부족해서 골랐어요.`
                  : '남은 칼로리에 맞는 메뉴예요.'}
                {summary.exerciseBurn > 0 && ` 운동으로 ${num(summary.exerciseBurn)} kcal가 추가됐어요.`}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <div className="tnum text-lg font-bold">{kcal(s.nutrition.kcal)}</div>
              {nextSlot && (
                <Button
                  variant="ghost"
                  className="mt-1 px-3 py-1.5 text-xs"
                  disabled={busyId === s.food.name}
                  onClick={() => void add(s.food.name, s.amountG, s.nutrition)}
                >
                  {SLOT_LABEL[nextSlot]}에 기록
                </Button>
              )}
            </div>
          </div>
        </Card>
      ))}

      {result.items.length === 0 && result.mode !== 'done' && (
        <Card>
          <EmptyState
            icon="🤔"
            title="추천할 음식을 찾지 못했어요"
            description="음식 목록에 맞는 후보가 없습니다. 식단 기록에서 직접 입력해 내 음식을 늘려보세요."
          />
        </Card>
      )}

      <Link
        to="/recipes"
        className="block rounded-[12px] border border-line px-4 py-3.5 text-center text-sm font-medium"
      >
        냉장고 재료로 레시피 찾기
      </Link>
    </div>
  )
}
