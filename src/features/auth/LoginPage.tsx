import { useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../app/AuthContext'
import { Button, Field, Notice, Spinner, inputClass } from '../../components/ui'

export default function LoginPage() {
  const { user, loading, signIn, signUp } = useAuth()
  const location = useLocation()
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (loading) return <Spinner label="세션을 확인하는 중…" />
  if (user) {
    const from = (location.state as { from?: string } | null)?.from
    return <Navigate to={from ?? '/'} replace />
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setInfo(null)
    setBusy(true)
    try {
      if (mode === 'signin') {
        await signIn(email, password)
      } else {
        const { needsConfirm } = await signUp(email, password)
        if (needsConfirm) {
          setInfo('확인 메일을 보냈어요. 메일의 링크를 눌러 가입을 마쳐주세요.')
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '문제가 발생했습니다')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <h1 className="text-2xl font-bold">오늘 뭘 먹을까</h1>
      <p className="mt-1 mb-8 text-sm text-sub">
        하루 목표 칼로리를 세우고, 먹은 것과 운동한 것을 기준으로 다음 끼니를 알려줍니다.
      </p>

      <form onSubmit={submit} className="space-y-4">
        <Field label="이메일">
          <input
            type="email"
            required
            autoComplete="email"
            className={inputClass}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        <Field label="비밀번호" hint="6자 이상">
          <input
            type="password"
            required
            minLength={6}
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            className={inputClass}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>

        {error && <Notice tone="caution">{error}</Notice>}
        {info && <Notice tone="info">{info}</Notice>}

        <Button type="submit" disabled={busy} className="w-full">
          {busy ? '처리 중…' : mode === 'signin' ? '로그인' : '가입하기'}
        </Button>
      </form>

      <button
        type="button"
        className="mt-4 w-full text-sm text-sub underline"
        onClick={() => {
          setMode(mode === 'signin' ? 'signup' : 'signin')
          setError(null)
          setInfo(null)
        }}
      >
        {mode === 'signin' ? '계정이 없으신가요? 가입하기' : '이미 계정이 있으신가요? 로그인'}
      </button>
    </div>
  )
}
