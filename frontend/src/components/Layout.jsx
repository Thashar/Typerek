import { NavLink, Outlet, Navigate, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../context/AuthContext'
import { getLive } from '../api/matches'

const baseNav = [
  { to: '/', label: '⚽ Mecze' },
  { to: '/worldcup', label: '🌍 Mundial' },
  { to: '/ranking', label: '🏆 Ranking' },
  { to: '/profile', label: '👤 Profil' },
]

function LiveIndicator() {
  const navigate = useNavigate()
  const { data } = useQuery({
    queryKey: ['matches-live'],
    queryFn: getLive,
    refetchInterval: 30000,
    staleTime: 0,
  })

  const hasLive = (data?.total ?? 0) > 0

  return (
    <button
      onClick={() => navigate('/?live=1')}
      className={`flex items-center gap-1.5 text-xs font-semibold transition ${hasLive ? 'text-gray-300 hover:text-white' : 'text-gray-600 hover:text-gray-500'}`}
      title={hasLive ? `${data.total} mecz${data.total === 1 ? '' : data.total < 5 ? 'e' : 'ów'} na żywo` : 'Brak meczów na żywo'}
    >
      <span className={`inline-block w-2 h-2 rounded-full ${hasLive ? 'bg-red-500 shadow-[0_0_6px_2px_rgba(239,68,68,0.8)] animate-pulse' : 'bg-gray-600'}`} />
      Na żywo
    </button>
  )
}

export default function Layout() {
  const { user, loading } = useAuth()
  const nav = user?.is_admin ? [...baseNav, { to: '/admin', label: '⚙️ Admin' }] : baseNav

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-gray-500">Ładowanie...</div>
  }

  if (!user) return <Navigate to="/login" replace />

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-gray-900 border-b border-gray-800 sticky top-0 z-40">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <span className="font-bold text-brand-400 text-lg">⚽ Typerek</span>
          <div className="flex items-center gap-4">
            <LiveIndicator />
            <span className="text-sm text-gray-400">{user.username} · <span className="text-brand-400 font-bold">{user.total_points} pkt</span></span>
          </div>
        </div>
      </header>

      <main className="flex-1 pb-20">
        <Outlet />
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 z-40">
        <div className="max-w-2xl mx-auto flex">
          {nav.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex-1 py-3 text-center text-xs font-medium transition ${isActive ? 'text-brand-400' : 'text-gray-500 hover:text-gray-300'}`
              }
            >
              {label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
