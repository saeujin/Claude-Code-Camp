import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// 화면 테스트는 파일 상단 `@vitest-environment jsdom` 주석으로 jsdom을 쓴다.
// 도메인 테스트는 기본 node 환경에서 돈다.
export default defineConfig({
  plugins: [react(), tailwindcss()],
})
