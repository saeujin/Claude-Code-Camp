import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// 계산 코어는 순수 TypeScript라 DOM이 필요 없다.
// 화면 테스트를 추가할 때 jsdom + @testing-library/react를 붙이면 된다.
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('.', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['lib/**/*.test.ts'],
  },
})
