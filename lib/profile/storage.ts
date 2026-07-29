import type { Profile } from '@/lib/nutrition/types'
import { parseProfile } from './schema'

/**
 * 프로필 저장소 어댑터.
 *
 * ★ localStorage는 이 파일 밖으로 새지 않는다.
 *   서버 DB로 바꿀 때 이 파일의 구현만 교체하면 되고, 화면 코드는 손대지 않는다.
 *
 * React에서는 `useProfile()`(./useProfile.ts)을 통해 읽는다.
 * useSyncExternalStore가 요구하는 구독·스냅샷 API를 여기서 함께 제공한다.
 */

const STORAGE_KEY = 'diet-app:profile:v1'

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

// ── 스냅샷 캐시 ──────────────────────────────────────────────────
// useSyncExternalStore는 getSnapshot이 매번 같은 참조를 돌려주길 요구한다.
// 매 호출마다 JSON.parse로 새 객체를 만들면 무한 렌더에 빠진다.
let cachedRaw: string | null = null
let cachedProfile: Profile | null = null
let cacheInitialized = false

const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

/** 저장된 프로필을 읽는다. 없거나 형식이 깨졌으면 null */
export function loadProfile(): Profile | null {
  if (!isBrowser()) return null

  let raw: string | null = null
  try {
    raw = window.localStorage.getItem(STORAGE_KEY)
  } catch {
    // 사파리 프라이빗 모드 등에서 접근이 막힌 경우
    return null
  }

  if (cacheInitialized && raw === cachedRaw) return cachedProfile

  cachedRaw = raw
  cacheInitialized = true
  try {
    cachedProfile = raw ? parseProfile(JSON.parse(raw)) : null
  } catch {
    cachedProfile = null
  }
  return cachedProfile
}

/** 프로필을 저장한다. 저장에 실패하면 false */
export function saveProfile(profile: Profile): boolean {
  if (!isBrowser()) return false
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(profile))
  } catch {
    return false
  }
  loadProfile() // 캐시 갱신
  emit()
  return true
}

export function clearProfile(): void {
  if (!isBrowser()) return
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    return
  }
  loadProfile()
  emit()
}

// ── useSyncExternalStore 연결부 ──────────────────────────────────

export function subscribeProfile(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange)
  // 다른 탭에서 바뀐 경우도 반영한다
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key === STORAGE_KEY) {
      loadProfile()
      onStoreChange()
    }
  }
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(onStoreChange)
    window.removeEventListener('storage', onStorage)
  }
}

export const getProfileSnapshot = loadProfile

/** 서버에는 localStorage가 없다. 서버 렌더와 hydration 렌더가 같아야 한다 */
export function getProfileServerSnapshot(): Profile | null {
  return null
}
