/**
 * 앱 셸 — F1 프로필 · F2 식단 기록 · F5 추천 세 화면을 전환한다.
 *
 * 라우터를 두지 않았다. 화면이 셋이고 URL을 공유할 이유가 아직 없다.
 * F4·F6·F7이 붙어 화면이 더 늘면 그때 라우터를 도입하는 게 맞다.
 */

import { useState } from 'react'
import { DietLogPage } from './features/diet/DietLogPage'
import { ProfilePage } from './features/profile/ProfilePage'
import { SuggestPage } from './features/suggest/SuggestPage'
import { loadProfile } from './data/profileRepo'
import './app.css'

type Tab = 'diet' | 'suggest' | 'profile'

const TABS: readonly { id: Tab; label: string }[] = [
  { id: 'diet', label: '식단 기록' },
  { id: 'suggest', label: '추천' },
  { id: 'profile', label: '프로필 · 목표' },
]

function App() {
  // 명세 87줄 — F1은 "반드시 먼저 완료해야 하는 기능". 프로필이 없으면 거기서 시작한다.
  const [tab, setTab] = useState<Tab>(() => (loadProfile() ? 'diet' : 'profile'))

  // 프로필을 저장하면 올려서 F2·F5가 목표를 다시 읽게 한다
  const [targetVersion, setTargetVersion] = useState(0)

  return (
    <div className="app">
      <nav className="app-nav" aria-label="화면 전환">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            className={tab === id ? 'app-tab active' : 'app-tab'}
            aria-current={tab === id ? 'page' : undefined}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </nav>

      {tab === 'diet' && (
        <DietLogPage onGoToProfile={() => setTab('profile')} targetVersion={targetVersion} />
      )}

      {/*
        F5는 저장소를 마운트 시점에 한 번만 읽는다. 목표가 바뀌면 갱신 prop을
        받는 대신 key로 새로 마운트해 다시 읽게 한다 — 읽는 경로가 하나뿐이라
        F2처럼 refresh 함수를 따로 둘 이유가 없다.
      */}
      {tab === 'suggest' && (
        <SuggestPage key={targetVersion} onGoToProfile={() => setTab('profile')} />
      )}

      {tab === 'profile' && <ProfilePage onSaved={() => setTargetVersion((v) => v + 1)} />}
    </div>
  )
}

export default App
