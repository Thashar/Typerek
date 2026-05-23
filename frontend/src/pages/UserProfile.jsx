import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { userPredictions } from '../api/predictions'
import { globalRanking } from '../api/ranking'
import { GroupedPredHistory } from '../components/PredHistory'
import PageLoader from '../components/PageLoader'
import UserAvatar from '../components/UserAvatar'
import { usePageTitle } from '../hooks/usePageTitle'

export default function UserProfile() {
  usePageTitle('Profil gracza')
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
          <UserAvatar username={entry.username} avatar={entry.avatar} className="w-12 h-12" />
          <div>
            <div className="font-bold text-white text-lg">{entry.username}</div>
            <div className="text-sm text-brand-400 font-semibold">{entry.total_points} pkt</div>
          </div>
        </div>
      )}

      <h2 className="font-semibold text-white">Typy</h2>

      {isLoading && <PageLoader />}
      {!isLoading && (predictions?.length === 0) && (
        <div className="text-gray-500 text-center py-12 text-sm">Brak typów do pokazania</div>
      )}
      {!isLoading && predictions?.length > 0 && (
        <GroupedPredHistory predictions={predictions} />
      )}
    </div>
  )
}
