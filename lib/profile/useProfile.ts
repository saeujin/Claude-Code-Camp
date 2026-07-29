'use client'

import { useSyncExternalStore } from 'react'
import type { Profile } from '@/lib/nutrition/types'
import {
  getProfileServerSnapshot,
  getProfileSnapshot,
  subscribeProfile,
} from './storage'

/**
 * localStorage에 저장된 프로필을 읽는 훅.
 *
 * effect에서 setState를 호출하는 대신 useSyncExternalStore를 쓴다.
 * - 외부 저장소를 구독하는 정석 API이고,
 * - 서버 스냅샷을 따로 줄 수 있어 hydration 불일치가 나지 않으며,
 * - React Compiler의 `react-hooks/set-state-in-effect` 규칙에 걸리지 않는다.
 */
export function useProfile(): Profile | null {
  return useSyncExternalStore(
    subscribeProfile,
    getProfileSnapshot,
    getProfileServerSnapshot,
  )
}

const subscribeToNothing = () => () => {}

/**
 * 클라이언트에서 hydration이 끝났는지.
 *
 * 프로필이 null일 때 "불러오는 중"과 "아직 없음"을 구분하려면 필요하다.
 * 서버 스냅샷은 false, 클라이언트 스냅샷은 true라 hydration 직후 한 번 다시 렌더된다.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribeToNothing,
    () => true,
    () => false,
  )
}
