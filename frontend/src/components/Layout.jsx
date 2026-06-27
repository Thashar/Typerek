import { useEffect, useRef, useState } from 'react'
import { NavLink, Link, Outlet, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../context/AuthContext'
import { getLive } from '../api/matches'
import { getSettings } from '../api/settings'
import api from '../api/client'
import SplashScreen from './SplashScreen'

// Klucze zapytan ktore opisuja stan zwiazany z meczami live. Gdy backend
// dosynchronizuje zakonczony mecz (i live total spadnie), zrzucamy je razem,
// zeby header / ranking / historia typow odswiezyly sie w jednym takcie.
const LIVE_DEPENDENT_KEYS = [
  ['my-live-points'],
  ['predictions'],
  ['matches'],
  ['matches-live'],
  ['league-ranking'],
  ['league-ranking-live'],
  ['user-predictions'],
  ['ranking'],
]

const baseNav = [
  { to: '/', label: '⚽ Mecze' },
  { to: '/worldcup', label: '🌍 Mundial' },
  { to: '/ranking', label: '🏆 Ranking' },
  { to: '/chat', label: '💬 Chat', chatBadge: true },
  { to: '/profile', label: '👤 Profil' },
]

function useLivePoints(userId, refreshUser) {
  const { data: liveData } = useQuery({
    queryKey: ['matches-live'],
    queryFn: getLive,
    refetchInterval: 30000,
    staleTime: 0,
  })

  const hasLive = (liveData?.total ?? 0) > 0

  // Zawsze enabled (gdy mamy usera) — dzieki temu po koncu meczu endpoint
  // zwroci extra_points=0 i kolory/punkty w headerze cofna sie na czarno.
  const { data: livePoints } = useQuery({
    queryKey: ['my-live-points'],
    queryFn: async () => {
      const [data] = await Promise.all([
        api.get('/users/me/live-points').then(r => r.data),
        refreshUser(),
      ])
      return data
    },
    enabled: !!userId,
    refetchInterval: hasLive ? 30000 : false,
    staleTime: 0,
  })

  return { hasLive, liveData, extraPoints: livePoints?.extra_points ?? 0 }
}

// Gdy zmienia sie liczba meczow live (np. backend domknal mecz po cronie),
// jednorazowo uniewazniamy zaleznosci, zeby wszystkie widoki przeszly w
// nowy stan rownoczesnie. Dodatkowo nasluchujemy WS dla natychmiastowego push.
function useMatchUpdatesSync(liveTotal) {
  const qc = useQueryClient()
  const prevTotalRef = useRef(undefined)

  useEffect(() => {
    if (liveTotal === undefined) return
    if (prevTotalRef.current !== undefined && prevTotalRef.current !== liveTotal) {
      LIVE_DEPENDENT_KEYS.forEach(key => qc.invalidateQueries({ queryKey: key }))
    }
    prevTotalRef.current = liveTotal
  }, [liveTotal, qc])

  useEffect(() => {
    const base = import.meta.env.VITE_WS_URL || 'ws://localhost:8000'
    let ws, closed = false
    const connect = () => {
      try {
        ws = new WebSocket(`${base}/api/matches/ws`)
        ws.onmessage = () => {
          LIVE_DEPENDENT_KEYS.forEach(key => qc.invalidateQueries({ queryKey: key }))
        }
        ws.onclose = () => { if (!closed) setTimeout(connect, 10000) }
        ws.onerror = () => { try { ws.close() } catch {} }
      } catch {
        if (!closed) setTimeout(connect, 10000)
      }
    }
    connect()
    return () => { closed = true; try { ws?.close() } catch {} }
  }, [qc])
}

function LiveIndicator() {
  const navigate = useNavigate()
  const { hasLive, liveData } = useLivePoints()

  return (
    <button
      onClick={() => navigate('/?live=1')}
      className={`flex items-center gap-1.5 text-xs font-semibold transition ${hasLive ? 'text-gray-300 hover:text-white' : 'text-gray-600 hover:text-gray-500'}`}
      title={hasLive ? `${liveData.total} mecz${liveData.total === 1 ? '' : liveData.total < 5 ? 'e' : 'ów'} na żywo` : 'Brak meczów na żywo'}
      aria-label={hasLive ? `${liveData?.total} meczów na żywo — pokaż` : 'Brak meczów na żywo'}
    >
      <span className={`inline-block w-2 h-2 rounded-full ${hasLive ? 'bg-red-500 shadow-[0_0_6px_2px_rgba(239,68,68,0.8)] animate-pulse' : 'bg-gray-600'}`} />
      Na żywo
    </button>
  )
}

function useChatUnread(user) {
  const { pathname } = useLocation()
  const isOnChat = pathname === '/chat'
  const userId = user?.id
  const isAdmin = user?.is_admin

  const { data: messages = [] } = useQuery({
    queryKey: ['chat-messages'],
    queryFn: () => api.get('/chat/messages').then(r => r.data),
    refetchInterval: (isOnChat || isAdmin) ? false : 30000,
    refetchIntervalInBackground: false,
    staleTime: 30000,
    enabled: !!userId && !isAdmin,
  })

  const { data: allLeagues = [] } = useQuery({
    queryKey: ['admin-leagues'],
    queryFn: () => api.get('/admin/leagues').then(r => r.data),
    enabled: !!isAdmin,
    staleTime: 60000,
  })

  const [adminUnread, setAdminUnread] = useState(0)

  useEffect(() => {
    if (!isAdmin || allLeagues.length === 0) return
    if (isOnChat) { setAdminUnread(0); return }
    const check = async () => {
      let total = 0
      await Promise.all(allLeagues.map(async (league) => {
        const lastRead = parseInt(localStorage.getItem(`chat_last_read_${league.id}`) || '0')
        try {
          const res = await api.get('/chat/messages', { params: { league_id: league.id, after_id: lastRead, limit: 50 } })
          total += res.data.filter(m => m.user_id !== userId).length
        } catch {}
      }))
      setAdminUnread(total)
    }
    let id = null
    const start = () => { id = setInterval(check, 30000) }
    const stop = () => { clearInterval(id); id = null }
    const onVisibility = () => { if (document.hidden) stop(); else { check(); start() } }

    check()
    start()
    document.addEventListener('visibilitychange', onVisibility)
    return () => { stop(); document.removeEventListener('visibilitychange', onVisibility) }
  }, [allLeagues, isOnChat, isAdmin, userId])

  if (isOnChat) return 0
  if (isAdmin) return adminUnread

  const lastReadId = parseInt(localStorage.getItem('chat_last_read') || '0')
  return messages.filter(m => m.id > lastReadId && m.user_id !== userId).length
}

export default function Layout() {
  const { user, loading, refreshUser } = useAuth()
  const unreadChat = useChatUnread(user)

  const { data: settings } = useQuery({
    queryKey: ['game-settings'],
    queryFn: getSettings,
  })

  const chatVisible = settings?.chat_enabled !== false
  const allNav = user?.is_admin ? [...baseNav, { to: '/admin', label: '⚙️ Admin' }] : baseNav
  const nav = chatVisible ? allNav : allNav.filter(n => n.to !== '/chat')

  const { hasLive, liveData, extraPoints } = useLivePoints(user?.id, refreshUser)
  useMatchUpdatesSync(liveData?.total)

  if (loading) return <SplashScreen />

  if (!user) return <Navigate to="/login" replace />

  const displayPoints = user.total_points + extraPoints

  return (
    <div className="h-dvh flex flex-col overflow-hidden">
      <header className="bg-gray-900 border-b border-gray-800 z-40 shrink-0">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <span className="font-bold text-lg">⚽ <span className="text-white">Type</span><span className="text-brand-500">Rek</span><span className="text-[10px] text-gray-600 font-normal ml-1">v1.1.2</span></span>
          <div className="flex items-center gap-4">
            <LiveIndicator />
            <span className="text-sm text-gray-400">
              {user.username} · <span className={`font-bold ${hasLive && extraPoints > 0 ? 'text-green-400' : 'text-brand-400'}`}>{displayPoints} pkt</span>
            </span>
          </div>
        </div>
      </header>

      <main className="flex-1 min-h-0 overflow-y-auto outline-none">
        <Outlet />
      </main>

      <nav className="shrink-0 bg-gray-900 border-t border-gray-800 z-40 pb-0" aria-label="Nawigacja główna">
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
      <div className="shrink-0 bg-gray-900 pb-1 text-center">
        <div className="flex justify-center gap-3 text-[10px] text-gray-700">
          <Link to="/privacy" className="hover:text-gray-500">Polityka prywatności</Link>
          <span>·</span>
          <Link to="/regulamin" className="hover:text-gray-500">Regulamin</Link>
        </div>
      </div>
    </div>
  )
}
