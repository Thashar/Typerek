import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { myPredictions } from '../api/predictions'
import { useAuth } from '../context/AuthContext'
import { format } from 'date-fns'
import { pl } from 'date-fns/locale'

const STATUS_LABELS = { scheduled: 'Oczekuje', live: 'LIVE', finished: 'Zakończony', postponed: 'Przełożony', cancelled: 'Odwołany' }

export default function Profile() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const { data: preds } = useQuery({ queryKey: ['predictions'], queryFn: myPredictions })

  const predictions = preds ?? []
  const scored = predictions.filter(p => p.points != null)
  const totalPts = scored.reduce((s, p) => s + p.points, 0)
  const exactHits = scored.filter(p => p.points === 5).length
  const outcomeHits = scored.filter(p => p.points === 2).length

  const handleLogout = () => { logout(); navigate('/login') }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <div className="bg-gray-900 rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">{user?.username}</h2>
            <p className="text-gray-400 text-sm">{user?.email}</p>
          </div>
          <button onClick={handleLogout} className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm transition">
            Wyloguj
          </button>
        </div>
        <div className="grid grid-cols-3 gap-3 pt-2">
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

      <h3 className="font-semibold text-lg">Historia typów</h3>
      <div className="space-y-2">
        {predictions.length === 0 && <p className="text-gray-500 text-center py-8">Brak typów</p>}
        {predictions.map(p => (
          <div key={p.id} className="bg-gray-900 rounded-xl px-4 py-3 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{p.match.home_team} – {p.match.away_team}</p>
              <p className="text-xs text-gray-500">{p.match.league.name}</p>
            </div>
            <div className="text-center text-sm shrink-0">
              <p className="font-bold">{p.predicted_home}–{p.predicted_away}</p>
              {p.match.status === 'finished' && (
                <p className="text-xs text-gray-500">{p.match.home_score}–{p.match.away_score}</p>
              )}
            </div>
            <div className="w-16 text-right shrink-0">
              {p.points != null ? (
                <span className={`font-bold ${p.points > 0 ? 'text-green-400' : 'text-gray-500'}`}>+{p.points} pkt</span>
              ) : (
                <span className="text-xs text-gray-500">{STATUS_LABELS[p.match.status]}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
