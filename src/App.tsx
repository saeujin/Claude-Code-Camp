import { Navigate, NavLink, Route, Routes, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './app/AuthContext'
import { DayProvider } from './app/DayContext'
import { Spinner } from './components/ui'
import { CONFIG_ERROR, isConfigured } from './db/supabase'
import DashboardPage from './features/dashboard/DashboardPage'
import ExercisePage from './features/exercise/ExercisePage'
import FridgePage from './features/fridge/FridgePage'
import LoginPage from './features/auth/LoginPage'
import MealsPage from './features/meals/MealsPage'
import ProfilePage from './features/profile/ProfilePage'
import RecipesPage from './features/recipes/RecipesPage'
import SuggestPage from './features/suggest/SuggestPage'

const TABS = [
  { to: '/', label: '홈', icon: '🏠' },
  { to: '/meals', label: '식단', icon: '🍚' },
  { to: '/exercise', label: '운동', icon: '🏃' },
  { to: '/fridge', label: '냉장고', icon: '🧊' },
  { to: '/suggest', label: '추천', icon: '✨' },
]

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-full max-w-lg flex-col">
      <main className="flex-1 px-4 pb-28 pt-5">{children}</main>
      <nav className="fixed bottom-0 left-1/2 w-full max-w-lg -translate-x-1/2 border-t border-line bg-card/95 backdrop-blur">
        <ul className="flex">
          {TABS.map((t) => (
            <li key={t.to} className="flex-1">
              <NavLink
                to={t.to}
                end={t.to === '/'}
                className={({ isActive }) =>
                  `flex flex-col items-center gap-0.5 py-2.5 text-[11px] ${
                    isActive ? 'text-accent font-semibold' : 'text-sub'
                  }`
                }
              >
                <span className="text-lg leading-none">{t.icon}</span>
                {t.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  // 세션 확인 중에는 리다이렉트하지 않는다 — 새로고침마다 로그인 화면이 번쩍인다
  if (loading) return <Spinner label="세션을 확인하는 중…" />
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return <>{children}</>
}

function ConfigError() {
  return (
    <div className="mx-auto max-w-lg px-4 py-16">
      <h1 className="mb-2 text-lg font-bold">설정이 필요합니다</h1>
      <p className="text-sm leading-relaxed text-sub">{CONFIG_ERROR}</p>
    </div>
  )
}

export default function App() {
  if (!isConfigured) return <ConfigError />

  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="*"
          element={
            <RequireAuth>
              <DayProvider>
                <Shell>
                  <Routes>
                    <Route path="/" element={<DashboardPage />} />
                    <Route path="/profile" element={<ProfilePage />} />
                    <Route path="/meals" element={<MealsPage />} />
                    <Route path="/exercise" element={<ExercisePage />} />
                    <Route path="/fridge" element={<FridgePage />} />
                    <Route path="/suggest" element={<SuggestPage />} />
                    <Route path="/recipes" element={<RecipesPage />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </Shell>
              </DayProvider>
            </RequireAuth>
          }
        />
      </Routes>
    </AuthProvider>
  )
}
