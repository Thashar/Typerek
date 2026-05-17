import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { globalRanking, liveRankingChanges } from '../api/ranking'
import { userPredictions } from '../api/predictions'
import { useAuth } from '../context/AuthContext'
import { GroupedPredHistory } from '../components/PredHistory'

const MEDAL = ['🥇', '🥈', '🥉']

function UserPredictions({ userId }) {
  const { data, isLoading } = useQuery({
    queryKey: ['user-predictions', userId],
    queryFn: () => userPredictions(userId),
  })

  if (isLoading) return <div className="px-4 py-4 text-gray-500 text-sm text-center">Ładowanie...</div>

  return (
    <div className="px-2 pb-2 pt-1">
      <GroupedPredHistory predictions={data ?? []} />
    </div>
  )
}

export default function Ranking() {
  const { user } = useAuth()
  const { data, isLoading } = useQuery({ queryKey: ['ranking'], queryFn: globalRanking })
  const { data: liveData } = useQuery({
    queryKey: ['ranking-live-changes'],
    queryFn: liveRankingChanges,
    refetchInterval: 30000,
    staleTime: 0,
  })

  const entries = data?.entries ?? []
  const hasLive = liveData?.has_live ?? false
  const liveMap = Object.fromEntries((liveData?.changes ?? []).map(c => [c.user_id, c]))

  const [openUserId, setOpenUserId] = useState(null)
  const toggle = (id) => setOpenUserId(prev => prev === id ? null : id)

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
      <h2 className="text-xl font-bold">Ranking</h2>

      {isLoading && <div className="text-gray-500 text-center py-12">Ładowanie rankingu...</div>}

      {!isLoading && entries.length === 0 && (
        <div className="text-gray-500 text-center py-12">Brak danych rankingowych</div>
      )}

      <div className="space-y-2">
        {entries.map((entry) => {
          const isMe = user?.id === entry.user_id
          const isOpen = openUserId === entry.user_id
          const live = hasLive ? liveMap[entry.user_id] : null
          const movingUp = hasLive && live?.rank_change > 0
          const movingDown = hasLive && live?.rank_change < 0
          const extraPts = live?.projected_extra_points ?? 0

          const ringClass = movingUp
            ? 'ring-2 ring-green-500'
            : isMe
            ? 'ring-2 ring-brand-500'
            : ''

          return (
            <div key={entry.user_id} className={`bg-gray-900 rounded-xl overflow-hidden ${ringClass}`}>
              <button
                onClick={() => toggle(entry.user_id)}
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
                        {movingUp ? '▲' : '▼'}{Math.abs(live.rank_change)}
                      </span>
                    )}
                  </div>
                </div>

                <div className="hidden sm:block text-right text-sm text-gray-400 shrink-0">
                  <span>{entry.exact_hits}⭐ {entry.outcome_hits}✓</span>
                </div>

                <div className="text-right shrink-0">
                  <div className="font-bold text-brand-400 text-lg leading-tight">{entry.total_points} pkt</div>
                  {hasLive && extraPts > 0 && (
                    <div className="text-xs text-green-400 leading-tight">+{extraPts} pkt</div>
                  )}
                </div>

                <span className="text-gray-500 text-xs shrink-0">{isOpen ? '▴' : '▾'}</span>
              </button>
              {isOpen && <UserPredictions userId={entry.user_id} />}
            </div>
          )
        })}
      </div>
    </div>
  )
}
