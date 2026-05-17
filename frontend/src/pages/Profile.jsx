import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { myPredictions } from '../api/predictions'
import { getSettings } from '../api/settings'
import { useAuth } from '../context/AuthContext'
import { GroupedPredHistory } from '../components/PredHistory'

export default function Profile() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const { data: preds } = useQuery({ queryKey: ['predictions'], queryFn: myPredictions })
  const { data: settings } = useQuery({ queryKey: ['game-settings'], queryFn: getSettings })

  const predictions = preds ?? []
  const scored = predictions.filter(p => p.points != null)
  const totalPts = scored.reduce((s, p) => s + p.points, 0)
  const exactHits = scored.filter(p => p.points === (settings?.points_exact ?? 3)).length
  const outcomeHits = scored.filter(p => p.points === (settings?.points_outcome ?? 1)).length

  const handleLogout = () => { logout(); navigate('/login') }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      {user?.is_ranked
        ? <div className="bg-green-950/60 border border-green-700/50 rounded-xl px-4 py-3 flex items-center gap-2">
            <span className="text-green-400 font-semibold text-sm">Zweryfikowany</span>
            <span className="text-green-200/60 text-xs">— jesteś widoczny w rankingu</span>
          </div>
        : <div className="bg-yellow-950/60 border border-yellow-700/50 rounded-xl px-4 py-3">
            <p className="text-yellow-300 font-semibold text-sm">Konto niezweryfikowane</p>
            <p className="text-yellow-200/60 text-xs mt-0.5">Skontaktuj się z adminem w celu weryfikacji konta i pojawienia się w rankingu.</p>
          </div>
      }
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
            <p className="text-2xl font-bold text-green-400">{outcomeHits}</p>
            <p className="text-xs text-gray-400 mt-1">Typ ✅</p>
          </div>
          <div className="bg-gray-800 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-yellow-400">{exactHits}</p>
            <p className="text-xs text-gray-400 mt-1">Dokładny ⭐</p>
          </div>
        </div>
        <div className="bg-gray-800/60 rounded-lg px-3 py-2 text-xs text-gray-400 space-y-0.5">
          <div>⭐ <span className="text-white">Dokładny wynik</span> (wynik regulaminowy) = <span className="text-yellow-400 font-bold">{settings?.points_exact ?? 3} pkt</span></div>
          <div>✅ <span className="text-white">Dobry typ</span> (1/X/2) = <span className="text-green-400 font-bold">{settings?.points_outcome ?? 1} pkt</span></div>
          <div className="text-gray-500 pt-0.5">W fazie pucharowej liczy się wynik po 90 min — bez dogrywki i karnych.</div>
        </div>
      </div>

      <h3 className="font-semibold text-lg">Historia typów</h3>
      <GroupedPredHistory predictions={predictions} />
    </div>
  )
}
