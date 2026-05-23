import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../context/AuthContext'
import api from '../api/client'
import { getSettings } from '../api/settings'
import PageLoader from '../components/PageLoader'

const STATUS_LABELS = { scheduled: 'Oczekuje', live: 'LIVE', finished: 'Zakończony', postponed: 'Przełożony', cancelled: 'Odwołany' }

export default function AdminUserProfile() {
  const { userId } = useParams()
  const navigate = useNavigate()
  const { user: currentUser } = useAuth()

  const { data: users } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => api.get('/admin/users').then(r => r.data),
  })

  const { data: preds, isLoading } = useQuery({
    queryKey: ['admin-user-predictions', userId],
    queryFn: () => api.get(`/admin/users/${userId}/predictions`).then(r => r.data),
  })

  const { data: settings } = useQuery({
    queryKey: ['game-settings'],
    queryFn: getSettings,
  })

  if (!currentUser?.is_admin) {
    navigate('/')
    return null
  }

  const profileUser = users?.find(u => u.id === parseInt(userId))
  const predictions = preds ?? []
  const scored = predictions.filter(p => p.points != null)
  const totalPts = scored.reduce((s, p) => s + p.points, 0)
  const exactHits = scored.filter(p => p.points === (settings?.points_exact ?? 3)).length
  const outcomeHits = scored.filter(p => p.points === (settings?.points_outcome ?? 1)).length

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <button
        onClick={() => navigate('/admin')}
        className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition"
      >
        ← Wróć do panelu admina
      </button>

      <div className="bg-gray-900 rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">{profileUser?.username ?? `Użytkownik #${userId}`}</h2>
            <p className="text-gray-400 text-sm">{profileUser?.email}</p>
          </div>
          <div>
            {profileUser?.is_ranked
              ? <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded">zweryfikowany</span>
              : <span className="text-xs bg-gray-700 text-gray-500 px-2 py-1 rounded">niezweryfikowany</span>
            }
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="bg-gray-800 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-brand-400">{totalPts}</p>
            <p className="text-xs text-gray-400 mt-1">Punkty</p>
          </div>
          <div className="bg-gray-800 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-yellow-400">{exactHits}</p>
            <p className="text-xs text-gray-400 mt-1">Dokładne ⭐</p>
          </div>
          <div className="bg-gray-800 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-green-400">{outcomeHits}</p>
            <p className="text-xs text-gray-400 mt-1">Wyniki ✓</p>
          </div>
        </div>
      </div>

      <h3 className="font-semibold text-lg">Typy ({predictions.length})</h3>

      {isLoading && <PageLoader />}

      <div className="space-y-2">
        {!isLoading && predictions.length === 0 && (
          <p className="text-gray-500 text-center py-8">Brak typów</p>
        )}
        {predictions.map(p => (
          <div key={p.id} className="bg-gray-900 rounded-xl px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{p.match.home_team} – {p.match.away_team}</p>
                <p className="text-xs text-gray-500">{p.match.league.name}</p>
              </div>
              <div className="text-center text-sm shrink-0">
                <span className="font-bold">{p.predicted_home}–{p.predicted_away}</span>
                {p.match.status === 'finished' && (
                  <span className="block text-xs text-gray-500">{p.match.home_score}–{p.match.away_score}</span>
                )}
              </div>
              <div className="w-16 text-right shrink-0">
                {p.points != null
                  ? <span className={`font-bold ${p.points > 0 ? 'text-green-400' : 'text-gray-500'}`}>+{p.points} pkt</span>
                  : <span className="text-xs text-gray-500">{STATUS_LABELS[p.match.status]}</span>
                }
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
