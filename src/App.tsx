/**
 * 앱 셸 — F1 프로필과 F2 식단 기록 두 화면을 전환한다.
 *
 * 라우터를 두지 않았다. 화면이 둘뿐이고 URL을 공유할 이유가 아직 없다.
 * F4·F6·F7이 붙어 화면이 늘어나면 그때 라우터를 도입하는 게 맞다.
 */

import { useState } from 'react'
import { DietLogPage } from './features/diet/DietLogPage'
import { ProfilePage } from './features/profile/ProfilePage'
import { loadProfile } from './data/profileRepo'
import './app.css'

type Tab = 'diet' | 'profile'

function App() {
  // 명세 87줄 — F1은 "반드시 먼저 완료해야 하는 기능". 프로필이 없으면 거기서 시작한다.
  const [tab, setTab] = useState<Tab>(() => (loadProfile() ? 'diet' : 'profile'))

  // 프로필을 저장하면 올려서 F2가 목표를 다시 읽게 한다
  const [targetVersion, setTargetVersion] = useState(0)

  return (
    <div className="app">
      <nav className="app-nav" aria-label="화면 전환">
        <button
          type="button"
          className={tab === 'diet' ? 'app-tab active' : 'app-tab'}
          aria-current={tab === 'diet' ? 'page' : undefined}
          onClick={() => setTab('diet')}
        >
          식단 기록
        </button>
        <button
          type="button"
          className={tab === 'profile' ? 'app-tab active' : 'app-tab'}
          aria-current={tab === 'profile' ? 'page' : undefined}
          onClick={() => setTab('profile')}
        >
          프로필 · 목표
        </button>
      </nav>

      {tab === 'diet' ? (
        <DietLogPage onGoToProfile={() => setTab('profile')} targetVersion={targetVersion} />
      ) : (
        <ProfilePage onSaved={() => setTargetVersion((v) => v + 1)} />
      )}
    </div>
  )
}

export default App
