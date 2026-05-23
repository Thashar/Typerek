import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { globalRanking, liveRankingChanges } from '../api/ranking'
import { useAuth } from '../context/AuthContext'
import PageLoader from '../components/PageLoader'
import api from '../api/client'

const MEDAL = ['🥇', '🥈', '🥉']

export default function Ranking() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [selectedLeague, setSelectedLeague] = useState(null)

  const { data: leagues } = useQuery({
    queryKey: ['admin-leagues'],
    queryFn: () => api.get('/admin/leagues').then(r => r.data),
    enabled: !!user?.is_admin,
  })

  const { data, isLoading } = useQuery({ queryKey: ['ranking'], queryFn: globalRanking, enabled: !selectedLeague })
  const { data: leagueData, isLoading: leagueLoading } = useQuery({
    queryKey: ['admin-league-ranking', selectedLeague],
    queryFn: () => api.get(`/admin/leagues/${selectedLeague}/ranking`).then(r => r.data),
    enabled: !!selectedLeague,
  })
  const { data: liveData } = useQuery({
    queryKey: ['ranking-live-changes'],
    queryFn: liveRankingChanges,
    refetchInterval: 30000,
    refetchIntervalInBackground: false,
    staleTime: 0,
    enabled: !selectedLeague,
  })

  const rawEntries = selectedLeague ? (leagueData?.entries ?? []) : (data?.entries ?? [])
  const hasLive = !selectedLeague && (liveData?.has_live ?? false)
  const isLoading2 = selectedLeague ? leagueLoading : isLoading

  const entries = useMemo(() => {
    if (!hasLive) return rawEntries
    const liveMap = Object.fromEntries((liveData?.changes ?? []).map(c => [c.user_id, c]))
    const rawRankMap = Object.fromEntries(rawEntries.map(e => [e.user_id, e.rank]))
    return [...rawEntries]
      .map(e => ({
        ...e,
        projected_extra_points: liveMap[e.user_id]?.projected_extra_points ?? 0,
        total_points: e.total_points + (liveMap[e.user_id]?.projected_extra_points ?? 0),
      }))
      .sort((a, b) => b.total_points - a.total_points)
      .map((e, idx) => ({
        ...e,
        rank: idx + 1,
        rank_change: (rawRankMap[e.user_id] ?? idx + 1) - (idx + 1),
      }))
  }, [rawEntries, hasLive, liveData])

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
      <h2 className="text-xl font-bold">Ranking</h2>

      {user?.is_admin && leagues?.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          <button
            onClick={() => setSelectedLeague(null)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition ${!selectedLeague ? 'bg-brand-500 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
          >
            Globalny
          </button>
          {leagues.map(l => (
            <button
              key={l.id}
              onClick={() => setSelectedLeague(l.id)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition ${selectedLeague === l.id ? 'bg-brand-500 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
            >
              {l.name}
            </button>
          ))}
        </div>
      )}

      {isLoading2 && <PageLoader />}

      {!isLoading2 && entries.length === 0 && (
        <div className="text-gray-500 text-center py-12">Brak danych rankingowych</div>
      )}

      <div className="space-y-2">
        {entries.map((entry) => {
          const isMe = user?.id === entry.user_id
          const rankChange = hasLive ? (entry.rank_change ?? 0) : 0
          const movingUp = rankChange > 0
          const movingDown = rankChange < 0
          const hasLivePoints = hasLive && (entry.projected_extra_points ?? 0) > 0

          const ringClass = movingUp
            ? 'ring-2 ring-green-500'
            : movingDown
            ? 'ring-2 ring-red-500'
            : isMe
            ? 'ring-2 ring-brand-500'
            : ''

          return (
            <div key={entry.user_id} className={`bg-gray-900 rounded-xl overflow-hidden ${ringClass}`}>
              <button
                onClick={() => navigate(`/user/${entry.user_id}`)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-800/50 transition text-left"
              >
                <span className="w-8 text-center font-bold text-lg shrink-0">
                  {MEDAL[entry.rank - 1] ?? `#${entry.rank}`}
                </span>

                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-700 shrink-0 flex items-center justify-center">
                    {entry.avatar
                      ? <img src={entry.avatar} className="w-full h-full object-cover" alt="" />
                      : <span className="text-xs font-bold text-gray-400">{entry.username.slice(0, 2).toUpperCase()}</span>
                    }
                  </div>
                  <div className="min-w-0">
                    <span className={`font-semibold ${isMe ? 'text-brand-400' : ''}`}>
                      {entry.username} {isMe && <span className="text-xs text-gray-400">(Ty)</span>}
                    </span>
                    {hasLive && (movingUp || movingDown) && (
                      <span className={`ml-2 text-xs font-bold ${movingUp ? 'text-green-400' : 'text-red-400'}`}>
                        {movingUp ? '▲' : '▼'}{Math.abs(rankChange)}
                      </span>
                    )}
                  </div>
                </div>

                <div className="hidden sm:block text-right text-sm text-gray-400 shrink-0">
                  <span>{entry.exact_hits}⭐ {entry.outcome_hits}✅</span>
                </div>

                <div className="text-right shrink-0">
                  <div className={`font-bold text-lg leading-tight ${hasLivePoints ? 'text-green-400' : 'text-brand-400'}`}>{entry.total_points} pkt</div>
                </div>
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
