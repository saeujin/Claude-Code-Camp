// F4. 냉장고 재료 관리
// 계약: .claude/skills/f4-fridge/SKILL.md
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../app/AuthContext'
import { useDay } from '../../app/DayContext'
import {
  Button,
  Card,
  Chip,
  EmptyState,
  Field,
  Notice,
  inputClass,
} from '../../components/ui'
import { fridgeRepo } from '../../db/repositories'
import { isExpiringSoon } from '../../domain/recipes'
import { diffDays, todayKey } from '../../lib/date'

export default function FridgePage() {
  const { user } = useAuth()
  const { fridge, reload } = useDay()
  const today = todayKey()
  const [error, setError] = useState<string | null>(null)

  const sorted = useMemo(() => {
    const withMeta = fridge.map((i) => ({
      item: i,
      soon: isExpiringSoon(i, today),
      expired: i.expiresOn ? diffDays(today, i.expiresOn) < 0 : false,
    }))
    return withMeta.sort((a, b) => {
      if (a.expired !== b.expired) return a.expired ? -1 : 1
      if (a.soon !== b.soon) return a.soon ? -1 : 1
      return a.item.name.localeCompare(b.item.name, 'ko')
    })
  }, [fridge, today])

  async function remove(id: string) {
    setError(null)
    try {
      await fridgeRepo.remove(id)
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : '삭제하지 못했습니다')
    }
  }

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-bold">냉장고</h1>
        <p className="mt-1 text-sm text-sub">가진 재료를 등록하면 만들 수 있는 요리를 찾아줍니다.</p>
      </header>

      {error && <Notice tone="caution">{error}</Notice>}

      <Card title="사진으로 등록">
        <button
          type="button"
          disabled
          className="w-full cursor-not-allowed rounded-[12px] border border-dashed border-line py-6 text-sm text-sub"
        >
          📷 냉장고 사진 업로드 — 준비 중
        </button>
        <p className="mt-2 text-xs text-sub">
          사진 인식은 아직 준비 중입니다. 지금은 아래에서 직접 추가해주세요. 인식 기능이 붙어도
          결과를 바로 저장하지 않고 확인 단계를 거칩니다.
        </p>
      </Card>

      <AddFridgeItem userId={user?.id ?? ''} onSaved={reload} />

      {fridge.length === 0 ? (
        <Card>
          <EmptyState
            icon="🧊"
            title="등록된 재료가 없어요"
            description="가진 재료를 넣으면 매칭되는 레시피를 찾아드려요."
          />
        </Card>
      ) : (
        <Card title={`보유 재료 ${fridge.length}개`}>
          <ul className="divide-y divide-line">
            {sorted.map(({ item, soon, expired }) => (
              <li key={item.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-medium">{item.name}</span>
                    {expired && <Chip tone="caution">기한 지남</Chip>}
                    {!expired && soon && <Chip tone="caution">임박</Chip>}
                  </div>
                  <div className="tnum text-xs text-sub">
                    {item.quantity}
                    {item.unit}
                    {item.expiresOn && ` · 유통기한 ${item.expiresOn}`}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void remove(item.id)}
                  className="shrink-0 text-xs text-sub underline"
                >
                  삭제
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-sub">
            레시피를 만들어도 재료를 자동으로 줄이지 않습니다. 실제로 얼마나 썼는지 앱이 알 수 없기
            때문이에요. 다 쓴 재료는 직접 삭제해주세요.
          </p>
        </Card>
      )}

      <Link
        to="/recipes"
        className="block rounded-[12px] bg-accent px-4 py-3.5 text-center text-sm font-semibold text-white"
      >
        이 재료로 만들 수 있는 요리 보기
      </Link>
    </div>
  )
}

function AddFridgeItem({ userId, onSaved }: { userId: string; onSaved: () => Promise<void> }) {
  const today = todayKey()
  const [name, setName] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [unit, setUnit] = useState('개')
  const [purchasedOn, setPurchasedOn] = useState(today)
  const [expiresOn, setExpiresOn] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const expiryError =
    expiresOn && diffDays(purchasedOn, expiresOn) < 0
      ? '유통기한이 구매일보다 앞설 수 없어요.'
      : null

  async function add() {
    if (!name.trim() || !(Number(quantity) > 0) || expiryError) return
    setBusy(true)
    setError(null)
    try {
      await fridgeRepo.add(userId, {
        name: name.trim(),
        quantity: Number(quantity),
        unit: unit.trim() || '개',
        purchasedOn,
        expiresOn: expiresOn || null,
      })
      setName('')
      setQuantity('1')
      setExpiresOn('')
      await onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : '등록하지 못했습니다')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card title="재료 추가">
      <div className="space-y-3">
        {error && <Notice tone="caution">{error}</Notice>}

        <Field label="재료명">
          <input
            className={inputClass}
            placeholder="예: 두부"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>

        <div className="grid grid-cols-2 gap-2">
          <Field label="수량">
            <input
              type="number"
              inputMode="decimal"
              className={inputClass}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </Field>
          <Field label="단위">
            <input
              className={inputClass}
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Field label="구매일">
            <input
              type="date"
              className={inputClass}
              value={purchasedOn}
              onChange={(e) => setPurchasedOn(e.target.value)}
            />
          </Field>
          <Field label="유통기한 (선택)" error={expiryError}>
            <input
              type="date"
              className={inputClass}
              value={expiresOn}
              onChange={(e) => setExpiresOn(e.target.value)}
            />
          </Field>
        </div>

        <Button
          onClick={() => void add()}
          disabled={busy || !name.trim() || !(Number(quantity) > 0) || Boolean(expiryError)}
          className="w-full"
        >
          추가하기
        </Button>
      </div>
    </Card>
  )
}
