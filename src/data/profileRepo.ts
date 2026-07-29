/**
 * 프로필 저장소.
 *
 * localStorage는 이 파일 밖으로 새지 않는다 — 미결정 #6(회원 인증)이 정해지면
 * 이 구현만 교체하고 화면은 손대지 않는다. `repo.ts`(F2 기록)와 같은 방침이다.
 *
 * JMS 브랜치는 `useSyncExternalStore`로 다른 탭의 변경까지 반영했다. 여기서는
 * 구독 대신 단순 읽기/쓰기만 둔다 — F2 저장소도 같은 수준이고, 두 저장소가
 * 서로 다른 방식으로 동작하면 나중에 서버로 옮길 때 손댈 곳이 두 배가 된다.
 */

import type { Profile } from '../domain/types'
import { parseStoredProfile } from '../domain/profileValidation'

const PROFILE_KEY = 'diet-app/profile/v1'

/** 저장된 프로필. 없거나 형식이 깨졌으면 null */
export function loadProfile(): Profile | null {
  try {
    const raw = localStorage.getItem(PROFILE_KEY)
    if (raw === null) return null

    return parseStoredProfile(JSON.parse(raw))
  } catch {
    // 사파리 프라이빗 모드처럼 접근이 막힌 경우, 또는 값이 깨진 경우
    return null
  }
}

export function saveProfile(profile: Profile): void {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile))
}

export function clearProfile(): void {
  localStorage.removeItem(PROFILE_KEY)
}
