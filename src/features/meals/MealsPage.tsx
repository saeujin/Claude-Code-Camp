// F2. 하루 식단 기록
// 계약: .claude/skills/f2-meals/SKILL.md
import { useMemo, useState } from 'react'
import { useAuth } from '../../app/AuthContext'
import { useDay } from '../../app/DayContext'
import { ProfileBanner } from '../../components/ProfileBanner'
import {
  Button,
  Card,
  Chip,
  EmptyState,
  Field,
  Notice,
  Stat,
  inputClass,
} from '../../components/ui'
import { searchFoods } from '../../data'
import { customFoodRepo, mealRepo } from '../../db/repositories'
import { scaleNutrition } from '../../domain/calc'
import { SLOT_LABEL, SLOT_ORDER } from '../../domain/constants'
import type { Food, MealSlot } from '../../domain/types'
import { gram, kcal, num } from '../../lib/format'

export default function MealsPage() {
  const { user } = useAuth()
  const { date, meals, summary, consumedKcal, customFoods, reload } = useDay()
  const [slot, setSlot] = useState<MealSlot>('breakfast')
  const [error, setError] = useState<string | null>(null)

  const bySlot = useMemo(
    () =>
      SLOT_ORDER.map((s) => ({
        slot: s,
        entries: meals.filter((m) => m.slot === s),
      })),
    [meals],
  )

  async function remove(id: string) {
    setError(null)
    try {
      await mealRepo.remove(id)
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : '삭제하지 못했습니다')
    }
  }

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-bold">식단 기록</h1>
        <p className="mt-1 text-sm text-sub">먹은 것을 끼니별로 남깁니다.</p>
      </header>

      <ProfileBanner />
      {error && <Notice tone="caution">{error}</Notice>}

      <Card>
        <div className="grid grid-cols-2 gap-3">
          <Stat label="오늘 섭취" value={num(consumedKcal)} unit="kcal" />
          {summary ? (
            <Stat
              label={summary.remaining >= 0 ? '남은 칼로리' : '초과'}
              value={num(Math.abs(summary.remaining))}
              unit="kcal"
              tone={summary.remaining >= 0 ? 'accent' : 'caution'}
            />
          ) : (
            <Stat label="남은 칼로리" value="—" tone="sub" hint="프로필 설정 후 표시" />
          )}
        </div>
        {summary && (
          <div className="tnum mt-3 text-xs text-sub">
            탄수 {gram(summary.consumed.carbG)} / {gram(summary.targetMacros.carbG)} · 단백질{' '}
            {gram(summary.consumed.proteinG)} / {gram(summary.targetMacros.proteinG)} · 지방{' '}
            {gram(summary.consumed.fatG)} / {gram(summary.targetMacros.fatG)}
          </div>
        )}
      </Card>

      <AddMealForm
        slot={slot}
        onSlotChange={setSlot}
        date={date}
        userId={user?.id ?? ''}
        customFoods={customFoods}
        onSaved={reload}
      />

      {meals.length === 0 ? (
        <Card>
          <EmptyState
            icon="🍚"
            title="오늘 기록한 식사가 없어요"
            description="먹은 음식을 추가하면 남은 칼로리를 계산해 드려요."
          />
        </Card>
      ) : (
        bySlot
          .filter((g) => g.entries.length > 0)
          .map((g) => (
            <Card key={g.slot} title={SLOT_LABEL[g.slot]}>
              <ul className="divide-y divide-line">
                {g.entries.map((m) => (
                  <li key={m.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{m.foodName}</div>
                      <div className="tnum text-xs text-sub">
                        {num(m.amountG)}g · 탄 {gram(m.nutrition.carbG)} 단{' '}
                        {gram(m.nutrition.proteinG)} 지 {gram(m.nutrition.fatG)}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="tnum text-sm font-semibold">{kcal(m.nutrition.kcal)}</span>
                      <button
                        type="button"
                        onClick={() => void remove(m.id)}
                        className="text-xs text-sub underline"
                      >
                        삭제
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          ))
      )}
    </div>
  )
}

function AddMealForm({
  slot,
  onSlotChange,
  date,
  userId,
  customFoods,
  onSaved,
}: {
  slot: MealSlot
  onSlotChange: (s: MealSlot) => void
  date: string
  userId: string
  customFoods: Food[]
  onSaved: () => Promise<void>
}) {
  const [mode, setMode] = useState<'search' | 'manual'>('search')
  const [query, setQuery] = useState('')
  const [picked, setPicked] = useState<Food | null>(null)
  const [amountG, setAmountG] = useState('')
  const [manual, setManual] = useState({ name: '', kcal: '', carb: '', protein: '', fat: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const results = useMemo(() => searchFoods(query, customFoods), [query, customFoods])
  const preview =
    picked && Number(amountG) > 0 ? scaleNutrition(picked.per100g, Number(amountG)) : null

  async function addFromSearch() {
    if (!picked || !(Number(amountG) > 0)) return
    setBusy(true)
    setError(null)
    try {
      await mealRepo.add(userId, {
        date,
        slot,
        foodName: picked.name,
        amountG: Number(amountG),
        nutrition: scaleNutrition(picked.per100g, Number(amountG)),
      })
      setPicked(null)
      setQuery('')
      setAmountG('')
      await onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : '기록하지 못했습니다')
    } finally {
      setBusy(false)
    }
  }

  async function addManual() {
    const k = Number(manual.kcal)
    if (!manual.name.trim() || !(k >= 0)) return
    setBusy(true)
    setError(null)
    try {
      const per100g = {
        kcal: k,
        carbG: Number(manual.carb) || 0,
        proteinG: Number(manual.protein) || 0,
        fatG: Number(manual.fat) || 0,
      }
      // 100g 기준으로 저장해 다음부터 검색된다 (명세 215행)
      await customFoodRepo.add(userId, {
        name: manual.name.trim(),
        per100g,
        servingG: 100,
      })
      await mealRepo.add(userId, {
        date,
        slot,
        foodName: manual.name.trim(),
        amountG: 100,
        nutrition: per100g,
      })
      setManual({ name: '', kcal: '', carb: '', protein: '', fat: '' })
      await onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : '기록하지 못했습니다')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card title="음식 추가">
      <div className="space-y-3">
        <div className="flex gap-1.5">
          {SLOT_ORDER.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onSlotChange(s)}
              className={`flex-1 rounded-[12px] border px-2 py-2 text-sm ${
                slot === s ? 'border-accent bg-accent-soft font-semibold' : 'border-line'
              }`}
            >
              {SLOT_LABEL[s]}
            </button>
          ))}
        </div>

        <div className="flex gap-2 text-xs">
          {(['search', 'manual'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`rounded-full px-3 py-1 ${
                mode === m ? 'bg-accent-soft text-accent font-semibold' : 'bg-line/60 text-sub'
              }`}
            >
              {m === 'search' ? '검색해서 추가' : '직접 입력'}
            </button>
          ))}
        </div>

        {error && <Notice tone="caution">{error}</Notice>}

        {mode === 'search' ? (
          <>
            <input
              className={inputClass}
              placeholder="음식 이름 검색 (예: 현미밥)"
              value={picked ? picked.name : query}
              onChange={(e) => {
                setPicked(null)
                setQuery(e.target.value)
              }}
            />

            {!picked && query.trim() && (
              <ul className="max-h-48 divide-y divide-line overflow-y-auto rounded-[12px] border border-line">
                {results.length === 0 && (
                  <li className="px-3 py-3 text-sm text-sub">
                    목록에 없어요. ‘직접 입력’으로 추가해주세요.
                  </li>
                )}
                {results.map((f) => (
                  <li key={f.id}>
                    <button
                      type="button"
                      className="flex w-full items-center justify-between px-3 py-2.5 text-left text-sm hover:bg-line/30"
                      onClick={() => {
                        setPicked(f)
                        setAmountG(String(f.servingG))
                      }}
                    >
                      <span>{f.name}</span>
                      <span className="tnum text-xs text-sub">
                        100g당 {num(f.per100g.kcal)} kcal
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {picked && (
              <>
                <Field label="섭취량 (g)" hint={`1인분 기준 ${picked.servingG}g`}>
                  <input
                    type="number"
                    inputMode="decimal"
                    className={inputClass}
                    value={amountG}
                    onChange={(e) => setAmountG(e.target.value)}
                  />
                </Field>
                <div className="flex gap-1.5">
                  {[0.5, 1, 1.5, 2].map((mult) => (
                    <button
                      key={mult}
                      type="button"
                      onClick={() => setAmountG(String(Math.round(picked.servingG * mult)))}
                      className="flex-1 rounded-[12px] border border-line px-2 py-1.5 text-xs"
                    >
                      {mult}인분
                    </button>
                  ))}
                </div>
                {preview && (
                  <div className="tnum rounded-[12px] bg-line/40 px-3 py-2 text-sm">
                    {kcal(preview.kcal)} · 탄 {gram(preview.carbG)} 단 {gram(preview.proteinG)} 지{' '}
                    {gram(preview.fatG)}
                  </div>
                )}
                <Button
                  onClick={() => void addFromSearch()}
                  disabled={busy || !(Number(amountG) > 0)}
                  className="w-full"
                >
                  {SLOT_LABEL[slot]}에 추가
                </Button>
              </>
            )}
          </>
        ) : (
          <>
            <Field label="음식 이름">
              <input
                className={inputClass}
                value={manual.name}
                onChange={(e) => setManual({ ...manual, name: e.target.value })}
              />
            </Field>
            <Field label="칼로리 (kcal)" hint="1회 섭취분 기준으로 입력하세요">
              <input
                type="number"
                inputMode="numeric"
                className={inputClass}
                value={manual.kcal}
                onChange={(e) => setManual({ ...manual, kcal: e.target.value })}
              />
            </Field>
            <div className="grid grid-cols-3 gap-2">
              <Field label="탄수 (g)">
                <input
                  type="number"
                  className={inputClass}
                  value={manual.carb}
                  onChange={(e) => setManual({ ...manual, carb: e.target.value })}
                />
              </Field>
              <Field label="단백질 (g)">
                <input
                  type="number"
                  className={inputClass}
                  value={manual.protein}
                  onChange={(e) => setManual({ ...manual, protein: e.target.value })}
                />
              </Field>
              <Field label="지방 (g)">
                <input
                  type="number"
                  className={inputClass}
                  value={manual.fat}
                  onChange={(e) => setManual({ ...manual, fat: e.target.value })}
                />
              </Field>
            </div>
            <div className="flex items-center gap-2">
              <Chip>내 음식에도 저장됩니다</Chip>
            </div>
            <Button
              onClick={() => void addManual()}
              disabled={busy || !manual.name.trim() || !(Number(manual.kcal) >= 0)}
              className="w-full"
            >
              {SLOT_LABEL[slot]}에 추가
            </Button>
          </>
        )}
      </div>
    </Card>
  )
}
