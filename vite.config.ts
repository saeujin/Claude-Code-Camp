// `test` 옵션을 쓰므로 defineConfig를 vitest/config에서 가져온다.
// 'vite'의 defineConfig는 test 키를 모른다.
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    // 도메인 테스트는 DOM이 필요 없지만 컴포넌트 테스트가 있으므로 전역으로 켠다.
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    restoreMocks: true,
  },
})
