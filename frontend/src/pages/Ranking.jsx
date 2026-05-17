import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { globalRanking } from '../api/ranking'
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
  const entries = data?.entries ?? []
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
          return (
            <div key={entry.user_id} className={`bg-gray-900 rounded-xl overflow-hidden ${isMe ? 'ring-2 ring-brand-500' : ''}`}>
              <button
                onClick={() => toggle(entry.user_id)}
                className="w-full flex items-center gap-4 px-4 py-3 hover:bg-gray-800/50 transition text-left"
              >
                <span className="w-8 text-center font-bold text-lg shrink-0">
                  {MEDAL[entry.rank - 1] ?? `#${entry.rank}`}
                </span>
                <span className={`flex-1 font-semibold ${isMe ? 'text-brand-400' : ''}`}>
                  {entry.username} {isMe && <span className="text-xs text-gray-400">(Ty)</span>}
                </span>
                <div className="text-right text-sm text-gray-400 hidden sm:block">
                  <span>{entry.exact_hits}⭐ {entry.outcome_hits}✓</span>
                </div>
                <span className="font-bold text-brand-400 text-lg w-16 text-right shrink-0">
                  {entry.total_points} pkt
                </span>
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
