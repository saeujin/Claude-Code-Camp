// F7. 일일 대시보드
// 계약: .claude/skills/f7-dashboard/SKILL.md
import { Link } from 'react-router-dom'
import { useAuth } from '../../app/AuthContext'
import { useDay } from '../../app/DayContext'
import { ProfileBanner } from '../../components/ProfileBanner'
import {
  Card,
  Chip,
  EmptyState,
  Formula,
  MacroBar,
  Notice,
  ProgressBar,
  Spinner,
  Stat,
} from '../../components/ui'
import { KIND_LABEL, SLOT_LABEL, SLOT_ORDER } from '../../domain/constants'
import { currentHour, diffDays, formatPeriod, todayKey } from '../../lib/date'
import { kcal, num, percent, shortDateLabel, signedKcal, weight } from '../../lib/format'

/** 하루가 끝나갈 시점부터 섭취 부족을 안내한다 */
const LATE_HOUR = 21

export default function DashboardPage() {
  const { signOut } = useAuth()
  const { date, profile, plan, summary, meals, exercises, consumedKcal, exerciseBurn, loading, error } =
    useDay()

  if (loading) return <Spinner />

  const hasAnyRecord = meals.length > 0 || exercises.length > 0

  return (
    <div className="space-y-4">
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold">오늘 뭘 먹을까</h1>
          <p className="mt-0.5 text-sm text-sub">{shortDateLabel(date)}</p>
        </div>
        <button type="button" onClick={() => void signOut()} className="text-xs text-sub underline">
          로그아웃
        </button>
      </header>

      {error && <Notice tone="caution">{error}</Notice>}
      <ProfileBanner />

      {profile && plan && <GoalProgress />}

      {summary ? (
        <Card title="오늘 목표">
          <div className="space-y-3">
            <Formula>
              기본 목표 {num(summary.baseTarget)}
              {summary.exerciseBurn > 0 && ` + 운동 ${num(summary.exerciseBurn)}`} = 오늘 목표{' '}
              {num(summary.todayTarget)} kcal
            </Formula>

            <div className="flex items-baseline gap-2">
              <span className="tnum text-3xl font-bold">{num(summary.consumed.kcal)}</span>
              <span className="tnum text-sm text-sub">/ {kcal(summary.todayTarget)}</span>
              {summary.exerciseBurn > 0 && (
                <Chip tone="info">운동으로 {signedKcal(summary.exerciseBurn)}</Chip>
              )}
            </div>

            <ProgressBar value={summary.consumed.kcal} max={summary.todayTarget} />

            <div className="grid grid-cols-2 gap-3">
              <Stat
                label={summary.remaining >= 0 ? '남은 칼로리' : '초과한 칼로리'}
                value={num(Math.abs(summary.remaining))}
                unit="kcal"
                tone={summary.remaining >= 0 ? 'accent' : 'caution'}
              />
              <Stat
                label="섭취 진행률"
                value={percent(
                  summary.todayTarget > 0
                    ? (summary.consumed.kcal / summary.todayTarget) * 100
                    : 0,
                )}
                tone="sub"
              />
            </div>

            <div className="space-y-2 pt-1">
              <MacroBar
                label="탄수화물"
                value={summary.consumed.carbG}
                target={summary.targetMacros.carbG}
              />
              <MacroBar
                label={`단백질${summary.hasStrength ? ' (근력일 상향)' : ''}`}
                value={summary.consumed.proteinG}
                target={summary.targetMacros.proteinG}
              />
              <MacroBar
                label="지방"
                value={summary.consumed.fatG}
                target={summary.targetMacros.fatG}
              />
            </div>

            <UnderEatingNotice />
          </div>
        </Card>
      ) : (
        <Card title="오늘 기록">
          <div className="grid grid-cols-2 gap-3">
            <Stat label="섭취" value={num(consumedKcal)} unit="kcal" />
            <Stat label="운동 소모" value={num(exerciseBurn)} unit="kcal" tone="info" />
          </div>
          <p className="mt-2 text-xs text-sub">
            목표와 남은 칼로리는 프로필을 설정하면 표시됩니다.
          </p>
        </Card>
      )}

      {!hasAnyRecord && (
        <Card>
          <EmptyState
            icon="✍️"
            title="아직 오늘 기록이 없어요"
            description="식사나 운동을 기록하면 여기에 하루 현황이 모입니다."
            action={
              <div className="flex gap-2">
                <Link to="/meals" className="rounded-[12px] bg-accent px-4 py-2 text-sm text-white">
                  식사 기록
                </Link>
                <Link
                  to="/exercise"
                  className="rounded-[12px] border border-line px-4 py-2 text-sm"
                >
                  운동 기록
                </Link>
              </div>
            }
          />
        </Card>
      )}

      {meals.length > 0 && (
        <Card title="끼니별 섭취" action={<Link to="/meals" className="text-xs text-sub underline">전체</Link>}>
          <ul className="space-y-1.5">
            {SLOT_ORDER.map((slot) => {
              const entries = meals.filter((m) => m.slot === slot)
              if (entries.length === 0) return null
              const total = entries.reduce((a, m) => a + m.nutrition.kcal, 0)
              return (
                <li key={slot} className="flex items-baseline justify-between text-sm">
                  <span>
                    <span className="font-medium">{SLOT_LABEL[slot]}</span>{' '}
                    <span className="text-sub">
                      {entries.map((e) => e.foodName).join(', ')}
                    </span>
                  </span>
                  <span className="tnum shrink-0 pl-2 font-semibold">{kcal(total)}</span>
                </li>
              )
            })}
          </ul>
        </Card>
      )}

      {exercises.length > 0 && (
        <Card
          title="오늘 운동"
          action={<Link to="/exercise" className="text-xs text-sub underline">전체</Link>}
        >
          <ul className="space-y-1.5">
            {exercises.map((e) => (
              <li key={e.id} className="flex items-baseline justify-between text-sm">
                <span className="flex items-center gap-1.5">
                  {e.name}
                  <Chip tone={e.kind === 'strength' ? 'accent' : 'info'}>
                    {KIND_LABEL[e.kind]}
                  </Chip>
                </span>
                <span className="tnum shrink-0 pl-2 font-semibold text-info">{kcal(e.kcal)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Link
        to="/suggest"
        className="block rounded-[12px] bg-accent px-4 py-3.5 text-center text-sm font-semibold text-white"
      >
        다음 식사 추천받기
      </Link>
    </div>
  )
}

function GoalProgress() {
  const { profile, plan } = useDay()
  if (!profile || !plan) return null

  if (profile.goal === 'maintain') {
    return (
      <Card title="목표">
        <div className="text-sm">
          현재 <strong>{weight(profile.weightKg)}</strong> 유지 중
        </div>
      </Card>
    )
  }

  if (plan.expired) {
    return (
      <Card title="목표 진행 상황">
        <Notice tone="caution">
          목표 기간이 끝났어요. 현재 {weight(profile.weightKg)} · 목표{' '}
          {weight(profile.targetWeightKg!)}.{' '}
          <Link to="/profile" className="font-semibold underline">
            새 목표를 정해주세요
          </Link>
          . 그때까지는 지금 목표 칼로리를 그대로 씁니다.
        </Notice>
      </Card>
    )
  }

  const target = profile.targetWeightKg!
  const total = Math.abs(profile.startWeightKg - target)
  const done = Math.abs(profile.startWeightKg - profile.weightKg)
  const ratio = total > 0 ? Math.min(100, (done / total) * 100) : 100

  return (
    <Card title="목표 진행 상황">
      <div className="space-y-2">
        <div className="flex items-baseline justify-between">
          <span className="tnum text-lg font-bold">
            {weight(profile.weightKg)} → {weight(target)}
          </span>
          <span className="tnum text-sm text-sub">{percent(ratio)}</span>
        </div>
        <ProgressBar value={ratio} max={100} />
        <p className="text-xs text-sub">
          남은 기간 {formatPeriod(diffDays(todayKey(), profile.targetDate!))} · 주당{' '}
          {plan.weeklyRateKg}kg 속도
        </p>
      </div>
    </Card>
  )
}

/**
 * 섭취 부족 안내 (명세 399~400행).
 * 과다 섭취만 관리 대상이 아니다. 운동을 많이 한 날은 특히 이 안내가 뜨기 쉬우므로
 * "운동한 만큼 보충하세요"라는 맥락을 함께 보여준다.
 */
function UnderEatingNotice() {
  const { summary, plan } = useDay()
  if (!summary || !plan) return null
  if (currentHour() < LATE_HOUR) return null
  if (summary.consumed.kcal === 0) return null
  if (summary.consumed.kcal >= plan.bmr) return null

  const short = summary.todayTarget - summary.consumed.kcal

  return (
    <Notice tone="caution">
      목표보다 {num(short)} kcal 적게 드셨어요.
      {summary.exerciseBurn > 0 &&
        ` 오늘 운동으로 ${num(summary.exerciseBurn)} kcal를 쓰셨는데 그만큼 보충하지 않으셨네요.`}{' '}
      섭취량 {kcal(summary.consumed.kcal)}는 기초대사량({kcal(plan.bmr)})보다도 적어서 오히려
      감량에 방해가 돼요.
    </Notice>
  )
}
