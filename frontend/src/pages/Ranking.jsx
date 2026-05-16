import { useQuery } from '@tanstack/react-query'
import { globalRanking } from '../api/ranking'
import { useAuth } from '../context/AuthContext'

const MEDAL = ['🥇', '🥈', '🥉']

export default function Ranking() {
  const { user } = useAuth()
  const { data, isLoading } = useQuery({ queryKey: ['ranking'], queryFn: globalRanking })
  const entries = data?.entries ?? []

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
      <h2 className="text-xl font-bold">Ranking globalny</h2>

      {isLoading && <div className="text-gray-500 text-center py-12">Ładowanie rankingu...</div>}

      {!isLoading && entries.length === 0 && (
        <div className="text-gray-500 text-center py-12">Brak danych rankingowych</div>
      )}

      <div className="space-y-2">
        {entries.map((entry) => {
          const isMe = user?.id === entry.user_id
          return (
            <div
              key={entry.user_id}
              className={`flex items-center gap-4 bg-gray-900 rounded-xl px-4 py-3 ${isMe ? 'ring-2 ring-brand-500' : ''}`}
            >
              <span className="w-8 text-center font-bold text-lg">
                {MEDAL[entry.rank - 1] ?? `#${entry.rank}`}
              </span>
              <span className={`flex-1 font-semibold ${isMe ? 'text-brand-400' : ''}`}>
                {entry.username} {isMe && <span className="text-xs text-gray-400">(Ty)</span>}
              </span>
              <div className="text-right text-sm text-gray-400 hidden sm:block">
                <span>{entry.exact_hits}⭐ {entry.outcome_hits}✓</span>
              </div>
              <span className="font-bold text-brand-400 text-lg w-16 text-right">
                {entry.total_points} pkt
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
