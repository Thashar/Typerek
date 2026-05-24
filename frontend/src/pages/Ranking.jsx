import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import PageLoader from '../components/PageLoader'
import UserAvatar from '../components/UserAvatar'
import api from '../api/client'
import { usePageTitle } from '../hooks/usePageTitle'

const MEDAL = ['🥇', '🥈', '🥉']

export default function Ranking() {
  usePageTitle('Ranking')
  const { user } = useAuth()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [selectedLeagueId, setSelectedLeagueId] = useState(null)

  const { data: myLeagues } = useQuery({
    queryKey: ['my-leagues'],
    queryFn: () => api.get('/leagues/me').then(r => r.data),
  })

  const { data: allLeagues } = useQuery({
    queryKey: ['admin-leagues'],
    queryFn: () => api.get('/admin/leagues').then(r => r.data),
    enabled: !!user?.is_admin,
  })

  const myLeague = myLeagues?.[0]

  useEffect(() => {
    if (!selectedLeagueId && myLeague) setSelectedLeagueId(myLeague.id)
  }, [myLeague, selectedLeagueId])

  const leagueId = selectedLeagueId ?? myLeague?.id

  const { data, isLoading } = useQuery({
    queryKey: ['league-ranking', leagueId],
    queryFn: () => {
      if (user?.is_admin) return api.get(`/admin/leagues/${leagueId}/ranking`).then(r => r.data)
      return api.get(`/leagues/${leagueId}/ranking`).then(r => r.data)
    },
    enabled: !!leagueId,
    refetchInterval: 60000,
    refetchIntervalInBackground: false,
  })

  const { data: liveData } = useQuery({
    queryKey: ['league-ranking-live', leagueId],
    queryFn: () => {
      if (user?.is_admin) return api.get(`/admin/leagues/${leagueId}/ranking/live-changes`).then(r => r.data)
      return api.get(`/leagues/${leagueId}/ranking/live-changes`).then(r => r.data)
    },
    enabled: !!leagueId,
    refetchInterval: 60000,
    refetchIntervalInBackground: false,
    staleTime: 0,
  })

  // WebSocket — odśwież ranking gdy mecze się aktualizują
  useEffect(() => {
    if (!leagueId) return
    const base = import.meta.env.VITE_WS_URL || 'ws://localhost:8000'
    let ws, closed = false
    const connect = () => {
      ws = new WebSocket(`${base}/api/matches/ws`)
      ws.onmessage = () => {
        qc.invalidateQueries({ queryKey: ['league-ranking', leagueId] })
        qc.invalidateQueries({ queryKey: ['league-ranking-live', leagueId] })
      }
      ws.onclose = () => { if (!closed) setTimeout(connect, 5000) }
      ws.onerror = () => ws.close()
    }
    connect()
    return () => { closed = true; ws?.close() }
  }, [leagueId])

  const entries = data?.entries ?? []
  const tabs = user?.is_admin ? (allLeagues ?? []) : []
  const hasLive = liveData?.has_live ?? false
  const changeMap = {}
  if (hasLive) {
    liveData.changes.forEach(c => { changeMap[c.user_id] = c })
  }

  if (!leagueId && myLeagues !== undefined) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-6">
        <h2 className="text-xl font-bold mb-4">Ranking</h2>
        <div className="text-gray-500 text-center py-12">Nie jesteś przypisany do żadnej ligi</div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
      <div className="flex items-center gap-3">
        <h2 className="text-xl font-bold">Ranking</h2>
        {hasLive && (
          <span className="flex items-center gap-1 text-xs font-bold text-red-500 animate-pulse">
            ● NA ŻYWO
          </span>
        )}
      </div>

      {tabs.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {tabs.map(l => (
            <button
              key={l.id}
              onClick={() => setSelectedLeagueId(l.id)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition ${selectedLeagueId === l.id ? 'bg-brand-500 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
            >
              {l.name || l.invite_code}
            </button>
          ))}
        </div>
      )}

      {isLoading && <PageLoader />}

      {!isLoading && entries.length === 0 && (
        <div className="text-gray-500 text-center py-12">Brak danych rankingowych</div>
      )}

      <div className="space-y-2">
        {entries.map((entry) => {
          const isMe = user?.id === entry.user_id
          const change = changeMap[entry.user_id]
          const extraPts = change?.projected_extra_points ?? 0
          const rankChange = change?.rank_change ?? 0

          return (
            <div
              key={entry.user_id}
              className={`bg-gray-900 rounded-xl overflow-hidden ${
                isMe ? 'ring-2 ring-brand-500' :
                hasLive && rankChange > 0 ? 'ring-2 ring-green-500' :
                hasLive && rankChange < 0 ? 'ring-2 ring-red-500' : ''
              }`}
            >
              <button
                onClick={() => navigate(`/user/${entry.user_id}`)}
                aria-label={`Profil gracza ${entry.username}`}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-800/50 transition text-left"
              >
                <span className="w-8 text-center font-bold text-lg shrink-0">
                  {MEDAL[entry.rank - 1] ?? `#${entry.rank}`}
                </span>

                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <UserAvatar username={entry.username} avatar={entry.avatar} />
                  <span className={`font-semibold ${isMe ? 'text-brand-400' : ''}`}>
                    {entry.username} {isMe && <span className="text-xs text-gray-400">(Ty)</span>}
                  </span>
                </div>

                <div className="hidden sm:block text-right text-sm text-gray-400 shrink-0">
                  <span>{entry.exact_hits}⭐ {entry.outcome_hits}✅</span>
                </div>

                <div className="text-right shrink-0 flex flex-col items-end leading-tight">
                  <div className={`font-bold text-lg ${hasLive && extraPts > 0 ? 'text-green-400' : 'text-brand-400'}`}>
                    {hasLive && extraPts > 0 ? entry.total_points + extraPts : entry.total_points}
                    <span className="text-xs font-normal text-gray-500 ml-0.5">pkt</span>
                  </div>
                  {hasLive && rankChange !== 0 && (
                    <span className={`text-xs font-bold ${rankChange > 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {rankChange > 0 ? `↑${rankChange}` : `↓${Math.abs(rankChange)}`}
                    </span>
                  )}
                </div>
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
