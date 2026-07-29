// 공용 UI. 규약은 .claude/skills/app-shell/SKILL.md 「공용 컴포넌트 규약」
import type { ReactNode } from 'react'
import { num } from '../lib/format'

export function Card({
  title,
  action,
  children,
  className = '',
}: {
  title?: ReactNode
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section
      className={`rounded-[12px] border border-line bg-card p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ${className}`}
    >
      {(title || action) && (
        <header className="mb-3 flex items-center justify-between gap-2">
          {title && <h2 className="text-sm font-semibold text-sub">{title}</h2>}
          {action}
        </header>
      )}
      {children}
    </section>
  )
}

export function Stat({
  label,
  value,
  unit,
  tone = 'ink',
  hint,
}: {
  label: string
  value: ReactNode
  unit?: string
  tone?: 'ink' | 'accent' | 'info' | 'caution' | 'sub'
  hint?: ReactNode
}) {
  const color = {
    ink: 'text-ink',
    accent: 'text-accent',
    info: 'text-info',
    caution: 'text-caution',
    sub: 'text-sub',
  }[tone]
  return (
    <div>
      <div className="text-xs text-sub">{label}</div>
      <div className={`tnum text-2xl font-bold ${color}`}>
        {value}
        {unit && <span className="ml-1 text-sm font-medium">{unit}</span>}
      </div>
      {hint && <div className="mt-0.5 text-xs text-sub">{hint}</div>}
    </div>
  )
}

/**
 * 100%를 넘으면 넘친 부분을 다른 색으로 표시하되 경고색은 쓰지 않는다.
 */
export function ProgressBar({ value, max }: { value: number; max: number }) {
  const safeMax = max > 0 ? max : 1
  const ratio = value / safeMax
  const filled = Math.min(100, Math.max(0, ratio * 100))
  const over = ratio > 1
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-line">
      <div
        className={`h-full rounded-full transition-[width] ${over ? 'bg-caution' : 'bg-accent'}`}
        style={{ width: `${filled}%` }}
      />
    </div>
  )
}

export function MacroBar({
  label,
  value,
  target,
}: {
  label: string
  value: number
  target: number
}) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-xs">
        <span className="text-sub">{label}</span>
        <span className="tnum">
          {num(value)} / {num(target)}g
        </span>
      </div>
      <ProgressBar value={value} max={target} />
    </div>
  )
}

export function EmptyState({
  icon = '📝',
  title,
  description,
  action,
}: {
  icon?: string
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-2 py-8 text-center">
      <div className="text-3xl">{icon}</div>
      <div className="font-medium">{title}</div>
      {description && <p className="max-w-xs text-sm text-sub">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

/** 계산 근거 노출용. 값만 던지지 않고 식을 보여준다 */
export function Formula({ children }: { children: ReactNode }) {
  return <p className="tnum text-xs text-sub">{children}</p>
}

export function Notice({
  tone = 'info',
  children,
}: {
  tone?: 'info' | 'caution' | 'neutral'
  children: ReactNode
}) {
  const cls = {
    info: 'bg-info-soft text-ink',
    caution: 'bg-caution-soft text-ink',
    neutral: 'bg-line/60 text-ink',
  }[tone]
  return <div className={`rounded-[12px] px-3 py-2.5 text-sm leading-relaxed ${cls}`}>{children}</div>
}

export function Button({
  children,
  onClick,
  type = 'button',
  variant = 'primary',
  disabled,
  className = '',
}: {
  children: ReactNode
  onClick?: () => void
  type?: 'button' | 'submit'
  variant?: 'primary' | 'ghost' | 'danger'
  disabled?: boolean
  className?: string
}) {
  const styles = {
    primary: 'bg-accent text-white hover:brightness-95',
    ghost: 'border border-line bg-card text-ink hover:bg-line/40',
    danger: 'border border-line bg-card text-sub hover:bg-line/40',
  }[variant]
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`rounded-[12px] px-4 py-2.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${styles} ${className}`}
    >
      {children}
    </button>
  )
}

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string
  hint?: ReactNode
  error?: string | null
  children: ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-sub">{hint}</span>}
      {error && <span className="mt-1 block text-xs text-caution">{error}</span>}
    </label>
  )
}

export const inputClass =
  'w-full rounded-[12px] border border-line bg-card px-3 py-2.5 outline-none focus:border-accent'

export function Chip({
  children,
  tone = 'neutral',
}: {
  children: ReactNode
  tone?: 'neutral' | 'accent' | 'info' | 'caution'
}) {
  const cls = {
    neutral: 'bg-line/60 text-sub',
    accent: 'bg-accent-soft text-accent',
    info: 'bg-info-soft text-info',
    caution: 'bg-caution-soft text-caution',
  }[tone]
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{children}</span>
}

export function Spinner({ label = '불러오는 중…' }: { label?: string }) {
  return <div className="py-10 text-center text-sm text-sub">{label}</div>
}
