import { NavLink, Outlet, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../context/AuthContext'
import { getLive } from '../api/matches'
import { getSettings } from '../api/settings'
import api from '../api/client'
import SplashScreen from './SplashScreen'

const baseNav = [
  { to: '/', label: '⚽ Mecze' },
  { to: '/worldcup', label: '🌍 Mundial' },
  { to: '/ranking', label: '🏆 Ranking' },
  { to: '/chat', label: '💬 Chat', chatBadge: true },
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
      aria-label={hasLive ? `${data.total} meczów na żywo — pokaż` : 'Brak meczów na żywo'}
    >
      <span className={`inline-block w-2 h-2 rounded-full ${hasLive ? 'bg-red-500 shadow-[0_0_6px_2px_rgba(239,68,68,0.8)] animate-pulse' : 'bg-gray-600'}`} />
      Na żywo
    </button>
  )
}

function useChatUnread(userId) {
  const { pathname } = useLocation()
  const isOnChat = pathname === '/chat'

  const { data: messages = [] } = useQuery({
    queryKey: ['chat-messages'],
    queryFn: () => api.get('/chat/messages').then(r => r.data),
    refetchInterval: isOnChat ? false : 30000,
    staleTime: 30000,
    enabled: !!userId,
  })

  if (isOnChat) return 0
  const lastReadId = parseInt(localStorage.getItem('chat_last_read') || '0')
  return messages.filter(m => m.id > lastReadId && m.user_id !== userId).length
}

export default function Layout() {
  const { user, loading } = useAuth()
  const unreadChat = useChatUnread(user?.id)

  const { data: settings } = useQuery({
    queryKey: ['game-settings'],
    queryFn: getSettings,
  })

  const chatVisible = user?.is_admin || settings?.chat_enabled !== false
  const allNav = user?.is_admin ? [...baseNav, { to: '/admin', label: '⚙️ Admin' }] : baseNav
  const nav = chatVisible ? allNav : allNav.filter(n => n.to !== '/chat')

  if (loading) return <SplashScreen />

  if (!user) return <Navigate to="/login" replace />

  return (
    <div className="h-dvh flex flex-col overflow-hidden">
      <header className="bg-gray-900 border-b border-gray-800 z-40 shrink-0">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <span className="font-bold text-lg">⚽ <span className="text-white">Type</span><span className="text-brand-500">Rek</span></span>
          <div className="flex items-center gap-4">
            <LiveIndicator />
            <span className="text-sm text-gray-400">{user.username} · <span className="text-brand-400 font-bold">{user.total_points} pkt</span></span>
          </div>
        </div>
      </header>

      <main className="flex-1 min-h-0 overflow-y-auto">
        <Outlet />
      </main>

      <nav className="shrink-0 bg-gray-900 border-t border-gray-800 z-40" aria-label="Nawigacja główna">
        <div className="max-w-2xl mx-auto flex">
          {nav.map(({ to, label, chatBadge }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              aria-label={label.replace(/\p{Emoji}/gu, '').trim()}
              className={({ isActive }) =>
                `flex-1 py-3 text-center text-xs font-medium transition ${isActive ? 'text-brand-400' : 'text-gray-500 hover:text-gray-300'}`
              }
            >
              <span className="relative inline-flex items-center justify-center">
                {label}
                {chatBadge && unreadChat > 0 && (
                  <span className="absolute -top-2 -right-3 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1 leading-none">
                    {unreadChat > 99 ? '99+' : unreadChat}
                  </span>
                )}
              </span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
