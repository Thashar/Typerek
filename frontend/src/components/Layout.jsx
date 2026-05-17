import { NavLink, Outlet, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const baseNav = [
  { to: '/', label: '⚽ Mecze' },
  { to: '/ranking', label: '🏆 Ranking' },
  { to: '/leagues', label: '🛡️ Ligi' },
  { to: '/profile', label: '👤 Profil' },
]

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
          <span className="text-sm text-gray-400">{user.username} · <span className="text-brand-400 font-bold">{user.total_points} pkt</span></span>
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
