// F6. 재료 기반 레시피 추천
// 계약: .claude/skills/f6-recipes/SKILL.md
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useDay } from '../../app/DayContext'
import { Card, Chip, EmptyState, Notice } from '../../components/ui'
import { RECIPES } from '../../data'
import { matchRecipes } from '../../domain/recipes'
import { kcal, percent } from '../../lib/format'

export default function RecipesPage() {
  const { fridge, summary, date } = useDay()
  const [useCalorieFilter, setUseCalorieFilter] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)

  const matches = useMemo(
    () =>
      matchRecipes(RECIPES, fridge, date, {
        remainingKcal:
          useCalorieFilter && summary && summary.remaining > 0 ? summary.remaining : undefined,
      }),
    [fridge, date, useCalorieFilter, summary],
  )

  if (fridge.length === 0) {
    return (
      <div className="space-y-4">
        <header>
          <h1 className="text-xl font-bold">레시피 추천</h1>
        </header>
        <Card>
          <EmptyState
            icon="🧊"
            title="등록된 재료가 없어요"
            description="냉장고에 가진 재료를 먼저 등록해주세요."
            action={
              <Link to="/fridge" className="rounded-[12px] bg-accent px-4 py-2 text-sm text-white">
                냉장고로 가기
              </Link>
            }
          />
        </Card>
      </div>
    )
  }

  const hasFull = matches.some((m) => m.missing.length === 0)

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-bold">레시피 추천</h1>
        <p className="mt-1 text-sm text-sub">
          보유 재료 {fridge.length}개를 기준으로 찾았습니다. 조미료는 항상 있는 것으로 봅니다.
        </p>
      </header>

      {summary && summary.remaining > 0 && (
        <label className="flex items-center gap-2 rounded-[12px] border border-line bg-card px-3 py-2.5 text-sm">
          <input
            type="checkbox"
            checked={useCalorieFilter}
            onChange={(e) => setUseCalorieFilter(e.target.checked)}
          />
          남은 칼로리({kcal(summary.remaining)}) 안에 드는 레시피 우선
        </label>
      )}

      {!hasFull && (
        <Notice tone="neutral">
          지금 재료로 완성할 수 있는 레시피가 없어서, 부족한 재료가 1~2개인 것까지 함께 보여드려요.
        </Notice>
      )}

      {matches.map((m) => (
        <Card key={m.recipe.id}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <h3 className="font-semibold">{m.recipe.name}</h3>
                <Chip tone={m.matchRate === 100 ? 'accent' : 'neutral'}>
                  매칭률 {percent(m.matchRate)}
                </Chip>
                {m.usesExpiring && <Chip tone="caution">임박 재료 사용</Chip>}
              </div>
              <div className="mt-1.5 text-xs">
                <span className="text-sub">보유</span>{' '}
                <span>{m.owned.length > 0 ? m.owned.join(', ') : '없음'}</span>
              </div>
              {m.missing.length > 0 && (
                <div className="mt-0.5 text-xs">
                  <span className="text-caution">부족한 재료</span>{' '}
                  <span>{m.missing.join(', ')}</span>
                </div>
              )}
              {m.usesExpiring && (
                <p className="mt-1 text-xs text-sub">
                  유통기한이 임박한 {m.expiringNames.join(', ')}을(를) 써서 먼저 보여드려요.
                </p>
              )}
            </div>
            <div className="tnum shrink-0 text-sm font-semibold">{kcal(m.recipe.kcal)}</div>
          </div>

          <button
            type="button"
            onClick={() => setOpenId(openId === m.recipe.id ? null : m.recipe.id)}
            className="mt-3 text-xs text-sub underline"
          >
            {openId === m.recipe.id ? '조리법 접기' : '조리법 보기'}
          </button>

          {openId === m.recipe.id && (
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
              {m.recipe.steps.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ol>
          )}
        </Card>
      ))}

      <p className="pb-2 text-center text-xs text-sub">
        요리해도 재료가 자동으로 줄지 않습니다. 다 쓴 재료는 냉장고에서 직접 지워주세요.
      </p>
    </div>
  )
}
