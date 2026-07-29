import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/**
 * 환경변수가 없으면 앱을 조용히 진행시키지 않는다.
 * undefined 로 클라이언트를 만들면 원인 모를 네트워크 오류로 나타난다.
 */
export const isConfigured = Boolean(url && anonKey)

export const supabase = createClient(url ?? 'http://localhost', anonKey ?? 'anon')

export const CONFIG_ERROR =
  'VITE_SUPABASE_URL 과 VITE_SUPABASE_ANON_KEY 가 설정되지 않았습니다. .env.example 을 .env 로 복사해 값을 채워주세요.'
