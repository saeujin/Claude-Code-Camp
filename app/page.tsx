import { HomeSummary } from '@/components/profile/HomeSummary'

/**
 * 홈.
 *
 * 명세서 §F7의 일일 대시보드가 최종적으로 여기 들어간다.
 * 지금은 F1만 구현돼 있으므로 프로필 설정으로 안내하는 역할만 한다.
 */
export default function Home() {
  return (
    <main className="mx-auto w-full max-w-lg px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">식단앱</h1>
        <p className="mt-1 text-sm text-slate-600">
          목표 칼로리를 기준으로 다음에 무엇을 먹을지 알려줍니다.
        </p>
      </header>

      <HomeSummary />

      <section className="mt-6 rounded-xl border border-dashed border-slate-300 p-4">
        <h2 className="text-sm font-medium text-slate-700">아직 만들지 않은 기능</h2>
        <ul className="mt-2 space-y-1 text-sm text-slate-500">
          <li>F2 하루 식단 기록</li>
          <li>F3 운동 기록 및 소모 칼로리 반영</li>
          <li>F4 냉장고 재료 관리</li>
          <li>F5 다음 식사 추천</li>
          <li>F6 재료 기반 레시피 추천</li>
          <li>F7 일일 대시보드</li>
        </ul>
        <p className="mt-3 text-xs text-slate-400">
          현재 브랜치에서는 F1(프로필 및 목표 설정)만 구현되어 있습니다.
        </p>
      </section>
    </main>
  )
}
