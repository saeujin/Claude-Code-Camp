import type { Session, User } from '@supabase/supabase-js'
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { supabase } from '../db/supabase'

interface AuthValue {
  user: User | null
  /** 세션을 확인하는 동안에는 리다이렉트하지 않는다 — 로그인 화면이 번쩍인다 */
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string) => Promise<{ needsConfirm: boolean }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setSession(data.session)
      setLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
      setLoading(false)
    })

    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [])

  const value = useMemo<AuthValue>(
    () => ({
      user: session?.user ?? null,
      loading,
      async signIn(email, password) {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw new Error(translate(error.message))
      },
      async signUp(email, password) {
        const { data, error } = await supabase.auth.signUp({ email, password })
        if (error) throw new Error(translate(error.message))
        // 이메일 확인이 켜져 있으면 세션 없이 사용자만 돌아온다
        return { needsConfirm: !data.session }
      },
      async signOut() {
        await supabase.auth.signOut()
      },
    }),
    [session, loading],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth는 AuthProvider 안에서만 쓸 수 있습니다')
  return ctx
}

function translate(message: string): string {
  if (message.includes('Invalid login credentials')) return '이메일 또는 비밀번호가 맞지 않습니다.'
  if (message.includes('User already registered')) return '이미 가입된 이메일입니다.'
  if (message.includes('Password should be')) return '비밀번호는 6자 이상이어야 합니다.'
  if (message.includes('Email not confirmed')) return '이메일 확인이 아직 완료되지 않았습니다.'
  return message
}
