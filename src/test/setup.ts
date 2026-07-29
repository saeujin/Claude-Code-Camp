/**
 * 테스트 환경 준비.
 *
 * jsdom은 localStorage를 제공하지만 테스트 사이에 상태가 새는 것을 막아야 한다.
 * F2는 저장소가 localStorage라서 이전 테스트의 기록이 남으면 집계가 틀어진다.
 */

import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

afterEach(() => {
  cleanup()
  localStorage.clear()
})
