import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { userPredictions } from '../api/predictions'
import { globalRanking } from '../api/ranking'
import { GroupedPredHistory } from '../components/PredHistory'

export default function UserProfile() {
  const { userId } = useParams()
  const navigate = useNavigate()
  const id = parseInt(userId)

  const { data: ranking } = useQuery({ queryKey: ['ranking'], queryFn: globalRanking })
  const { data: predictions, isLoading } = useQuery({
    queryKey: ['user-predictions', id],
    queryFn: () => userPredictions(id),
  })

  const entry = ranking?.entries?.find(e => e.user_id === id)

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
      <button onClick={() => navigate(-1)} className="text-sm text-gray-400 hover:text-white transition">
        ← Wróć
      </button>

      {entry && (
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-700 shrink-0 flex items-center justify-center">
            {entry.avatar
              ? <img src={entry.avatar} className="w-full h-full object-cover" alt="" />
              : <span className="text-sm font-bold text-gray-400">{entry.username.slice(0, 2).toUpperCase()}</span>
            }
          </div>
          <div>
            <div className="font-bold text-white text-lg">{entry.username}</div>
            <div className="text-sm text-brand-400 font-semibold">{entry.total_points} pkt</div>
          </div>
        </div>
      )}

      <h2 className="font-semibold text-white">Typy</h2>

      {isLoading && <div className="text-gray-500 text-center py-12">Ładowanie...</div>}
      {!isLoading && (predictions?.length === 0) && (
        <div className="text-gray-500 text-center py-12 text-sm">Brak typów do pokazania</div>
      )}
      {!isLoading && predictions?.length > 0 && (
        <GroupedPredHistory predictions={predictions} />
      )}
    </div>
  )
}
