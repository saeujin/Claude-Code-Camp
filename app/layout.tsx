import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '식단앱',
  description: '목표 칼로리를 기준으로 다음에 무엇을 먹을지 알려주는 식단 관리 앱',
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full bg-slate-50 text-slate-900">{children}</body>
    </html>
  )
}
