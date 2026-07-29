// F3. 운동 기록 및 소모 칼로리 반영
// 계약: .claude/skills/f3-exercise/SKILL.md
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
  Formula,
  Notice,
  Stat,
  inputClass,
} from '../../components/ui'
import { MET_ITEMS } from '../../data'
import { exerciseRepo } from '../../db/repositories'
import { calcExerciseBurn } from '../../domain/calc'
import { INPUT_RANGE, KIND_LABEL } from '../../domain/constants'
import { isBurnSuspicious } from '../../domain/summary'
import type { ExerciseKind, MetItem } from '../../domain/types'
import { nowTime } from '../../lib/date'
import { gram, kcal, num, signedKcal } from '../../lib/format'

export default function ExercisePage() {
  const { user } = useAuth()
  const { date, profile, exercises, summary, plan, exerciseBurn, hasStrength, reload } = useDay()
  const [error, setError] = useState<string | null>(null)

  async function remove(id: string) {
    setError(null)
    try {
      await exerciseRepo.remove(id)
      // 삭제하면 오늘 목표·잔여·단백질 하한을 즉시 재계산한다
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : '삭제하지 못했습니다')
    }
  }

  const suspicious = plan ? isBurnSuspicious(exerciseBurn, plan.baseTarget) : false

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-bold">운동 기록</h1>
        <p className="mt-1 text-sm text-sub">운동한 만큼 오늘 목표 칼로리가 늘어납니다.</p>
      </header>

      <ProfileBanner />
      {error && <Notice tone="caution">{error}</Notice>}

      <Card>
        <div className="grid grid-cols-2 gap-3">
          <Stat label="오늘 운동 소모" value={num(exerciseBurn)} unit="kcal" tone="info" />
          {summary ? (
            <Stat
              label="오늘 목표"
              value={num(summary.todayTarget)}
              unit="kcal"
              tone="accent"
              hint={exerciseBurn > 0 ? `운동으로 ${signedKcal(exerciseBurn)}` : undefined}
            />
          ) : (
            <Stat label="오늘 목표" value="—" tone="sub" hint="프로필 설정 후 표시" />
          )}
        </div>

        {summary && exerciseBurn > 0 && (
          <Formula>
            기본 목표 {num(summary.baseTarget)} + 운동 {num(exerciseBurn)} = 오늘 목표{' '}
            {num(summary.todayTarget)} kcal
          </Formula>
        )}

        {hasStrength && summary && (
          <Notice tone="info">
            근력운동을 기록해 단백질 목표가 {gram(summary.targetMacros.proteinG)}으로 올라갔어요.
            감량 중에도 근손실을 막으려면 단백질을 더 확보해야 합니다.
          </Notice>
        )}

        {profile?.goal === 'lose' && exerciseBurn > 0 && (
          <Notice tone="caution">
            소모 칼로리는 추정치예요. 다이어트 중이라면 늘어난 만큼 전부 채우기보다 절반 정도만
            채우는 걸 권해요.
          </Notice>
        )}

        {suspicious && (
          <Notice tone="caution">
            오늘 소모 칼로리가 기본 목표보다 많아요. 입력이 맞는지 확인해주세요.
          </Notice>
        )}
      </Card>

      <AddExerciseForm
        date={date}
        userId={user?.id ?? ''}
        weightKg={profile?.weightKg ?? null}
        existingTimes={exercises.map((e) => e.time)}
        onSaved={reload}
      />

      {exercises.length === 0 ? (
        <Card>
          <EmptyState
            icon="🏃"
            title="오늘 기록한 운동이 없어요"
            description="운동을 기록하면 그만큼 오늘 목표 칼로리가 늘어납니다."
          />
        </Card>
      ) : (
        <Card title="오늘의 운동">
          <ul className="divide-y divide-line">
            {exercises.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-medium">{e.name}</span>
                    <Chip tone={e.kind === 'strength' ? 'accent' : 'info'}>
                      {KIND_LABEL[e.kind]}
                    </Chip>
                  </div>
                  <div className="tnum text-xs text-sub">
                    {e.time}
                    {e.source === 'met' && e.met !== null && e.minutes !== null && (
                      <>
                        {' · '}MET {e.met} × {e.weightSnapshotKg}kg × {(e.minutes / 60).toFixed(2)}
                        시간
                      </>
                    )}
                    {e.source === 'manual' && ' · 직접 입력'}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="tnum text-sm font-semibold text-info">{kcal(e.kcal)}</span>
                  <button
                    type="button"
                    onClick={() => void remove(e.id)}
                    className="text-xs text-sub underline"
                  >
                    삭제
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-sub">
            기록을 지우면 오늘 목표가 즉시 되돌아갑니다. 이미 그만큼 먹었다면 잔여가 음수가 될 수
            있는데, 정상 동작입니다.
          </p>
        </Card>
      )}

      <p className="pb-2 text-center text-xs text-sub">
        스마트워치·건강앱 연동은 아직 준비 중입니다. 기기에 표시된 값은 ‘직접 입력’으로 남겨주세요.
      </p>
    </div>
  )
}

const DAILY_ACTIVITY_WORDS = ['출근', '퇴근', '통근', '산책', '집안일', '청소', '장보기']

function AddExerciseForm({
  date,
  userId,
  weightKg,
  existingTimes,
  onSaved,
}: {
  date: string
  userId: string
  weightKg: number | null
  existingTimes: string[]
  onSaved: () => Promise<void>
}) {
  const [mode, setMode] = useState<'met' | 'manual'>('met')
  const [query, setQuery] = useState('')
  const [picked, setPicked] = useState<MetItem | null>(null)
  const [minutes, setMinutes] = useState('30')
  const [time, setTime] = useState(nowTime)
  const [manual, setManual] = useState<{ name: string; kcal: string; kind: ExerciseKind }>({
    name: '',
    kcal: '',
    kind: 'cardio',
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return MET_ITEMS
    return MET_ITEMS.filter((m) => m.name.toLowerCase().includes(q))
  }, [query])

  const mins = Number(minutes)
  const burn =
    picked && weightKg && mins > 0 ? calcExerciseBurn(picked.met, weightKg, mins) : null

  const minutesWarning =
    mins > 0 && (mins < INPUT_RANGE.exerciseMinutes.min || mins > INPUT_RANGE.exerciseMinutes.max)
      ? `${INPUT_RANGE.exerciseMinutes.min}~${INPUT_RANGE.exerciseMinutes.max}분 범위를 벗어났어요. 맞는지 확인해주세요.`
      : null

  const nameForCheck = mode === 'met' ? (picked?.name ?? query) : manual.name
  const dailyActivityWarning = DAILY_ACTIVITY_WORDS.some((w) => nameForCheck.includes(w))
    ? '출퇴근 도보 같은 일상 활동은 이미 활동 수준에 포함되어 있어요. 따로 기록하면 두 번 세게 됩니다.'
    : null

  const timeConflict = existingTimes.includes(time)
    ? '같은 시각에 기록된 운동이 있어요. 중복이 아닌지 확인해주세요.'
    : null

  async function addFromMet() {
    if (!picked || !weightKg || !(mins > 0)) return
    setBusy(true)
    setError(null)
    try {
      await exerciseRepo.add(userId, {
        date,
        time,
        name: picked.name,
        source: 'met',
        met: picked.met,
        minutes: mins,
        // 기록 시점 체중으로 계산하고 스냅샷을 남긴다 — 과거 기록을 소급 재계산하지 않는다
        kcal: calcExerciseBurn(picked.met, weightKg, mins),
        kind: picked.kind,
        weightSnapshotKg: weightKg,
      })
      setPicked(null)
      setQuery('')
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
      await exerciseRepo.add(userId, {
        date,
        time,
        name: manual.name.trim(),
        source: 'manual',
        met: null,
        minutes: null,
        kcal: k,
        kind: manual.kind,
        weightSnapshotKg: weightKg ?? 0,
      })
      setManual({ name: '', kcal: '', kind: 'cardio' })
      await onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : '기록하지 못했습니다')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card title="운동 추가">
      <div className="space-y-3">
        <div className="flex gap-2 text-xs">
          {(['met', 'manual'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              disabled={m === 'met' && !weightKg}
              className={`rounded-full px-3 py-1 disabled:opacity-40 ${
                mode === m ? 'bg-accent-soft text-accent font-semibold' : 'bg-line/60 text-sub'
              }`}
            >
              {m === 'met' ? '운동 선택' : '직접 입력'}
            </button>
          ))}
        </div>

        {!weightKg && (
          <Notice tone="caution">
            체중을 모르면 소모 칼로리를 계산할 수 없어요. 프로필을 설정하거나 ‘직접 입력’으로
            남겨주세요.
          </Notice>
        )}

        {error && <Notice tone="caution">{error}</Notice>}

        <Field label="시각">
          <input
            type="time"
            className={inputClass}
            value={time}
            onChange={(e) => setTime(e.target.value)}
          />
        </Field>

        {mode === 'met' ? (
          <>
            <input
              className={inputClass}
              placeholder="운동 검색 (예: 조깅)"
              value={picked ? picked.name : query}
              onChange={(e) => {
                setPicked(null)
                setQuery(e.target.value)
              }}
              disabled={!weightKg}
            />

            {!picked && (
              <ul className="max-h-48 divide-y divide-line overflow-y-auto rounded-[12px] border border-line">
                {results.length === 0 && (
                  <li className="px-3 py-3 text-sm text-sub">
                    목록에 없는 운동이에요. MET를 임의로 정하지 않으니 ‘직접 입력’으로 소모
                    칼로리를 남겨주세요.
                  </li>
                )}
                {results.map((m) => (
                  <li key={m.id}>
                    <button
                      type="button"
                      className="flex w-full items-center justify-between px-3 py-2.5 text-left text-sm hover:bg-line/30"
                      onClick={() => setPicked(m)}
                    >
                      <span>{m.name}</span>
                      <span className="tnum text-xs text-sub">
                        MET {m.met} · {KIND_LABEL[m.kind]}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {picked && (
              <>
                <Field label="지속 시간 (분)">
                  <input
                    type="number"
                    inputMode="numeric"
                    className={inputClass}
                    value={minutes}
                    onChange={(e) => setMinutes(e.target.value)}
                  />
                </Field>
                <div className="flex gap-1.5">
                  {[20, 30, 45, 60].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMinutes(String(m))}
                      className="flex-1 rounded-[12px] border border-line px-2 py-1.5 text-xs"
                    >
                      {m}분
                    </button>
                  ))}
                </div>

                {burn !== null && weightKg && (
                  <div className="rounded-[12px] bg-info-soft px-3 py-2.5">
                    <div className="tnum text-lg font-bold text-info">{kcal(burn)}</div>
                    <Formula>
                      MET {picked.met} × {weightKg}kg × {(mins / 60).toFixed(2)}시간 = {num(burn)}{' '}
                      kcal
                    </Formula>
                  </div>
                )}

                {minutesWarning && <Notice tone="caution">{minutesWarning}</Notice>}
                {dailyActivityWarning && <Notice tone="caution">{dailyActivityWarning}</Notice>}
                {timeConflict && <Notice tone="caution">{timeConflict}</Notice>}

                <Button
                  onClick={() => void addFromMet()}
                  disabled={busy || !(mins > 0) || !weightKg}
                  className="w-full"
                >
                  기록하기
                </Button>
              </>
            )}
          </>
        ) : (
          <>
            <Field label="운동 이름">
              <input
                className={inputClass}
                value={manual.name}
                onChange={(e) => setManual({ ...manual, name: e.target.value })}
              />
            </Field>
            <Field label="소모 칼로리 (kcal)" hint="기구에 표시된 값을 그대로 넣어도 됩니다">
              <input
                type="number"
                inputMode="numeric"
                className={inputClass}
                value={manual.kcal}
                onChange={(e) => setManual({ ...manual, kcal: e.target.value })}
              />
            </Field>
            <Field label="유형" hint="근력을 고르면 그날 단백질 목표가 올라갑니다">
              <div className="flex gap-2">
                {(['cardio', 'strength'] as ExerciseKind[]).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setManual({ ...manual, kind: k })}
                    className={`flex-1 rounded-[12px] border px-3 py-2.5 text-sm ${
                      manual.kind === k
                        ? 'border-accent bg-accent-soft font-semibold'
                        : 'border-line'
                    }`}
                  >
                    {KIND_LABEL[k]}
                  </button>
                ))}
              </div>
            </Field>

            {dailyActivityWarning && <Notice tone="caution">{dailyActivityWarning}</Notice>}
            {timeConflict && <Notice tone="caution">{timeConflict}</Notice>}

            <Button
              onClick={() => void addManual()}
              disabled={busy || !manual.name.trim() || !(Number(manual.kcal) >= 0)}
              className="w-full"
            >
              기록하기
            </Button>
          </>
        )}
      </div>
    </Card>
  )
}
