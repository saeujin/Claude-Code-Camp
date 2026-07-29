import type { Metadata } from 'next'
import Link from 'next/link'
import { ProfileScreen } from '@/components/profile/ProfileScreen'

export const metadata: Metadata = {
  title: '프로필 및 목표 설정 · 식단앱',
  description: '신체 정보로 기초대사량과 하루 목표 칼로리를 계산합니다.',
}

/**
 * F1 — 사용자 프로필 및 목표 설정
 *
 * 서버 컴포넌트는 껍데기만 담당하고, 상태·localStorage를 다루는 부분은
 * ProfileScreen(클라이언트 컴포넌트)에 맡긴다.
 */
export default function ProfilePage() {
  return (
    <main className="mx-auto w-full max-w-lg px-4 py-8">
      <header className="mb-6">
        <Link href="/" className="text-sm text-slate-500 hover:text-slate-700">
          ← 홈
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">프로필 및 목표 설정</h1>
        <p className="mt-1 text-sm text-slate-600">
          여기서 정한 기본 목표 칼로리가 식단 기록과 추천의 기준이 됩니다.
        </p>
      </header>

      <ProfileScreen />
    </main>
  )
}
