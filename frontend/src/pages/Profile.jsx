import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { formatInTimeZone } from 'date-fns-tz'
import { pl } from 'date-fns/locale'
import { myPredictions, submitPrediction, deletePrediction } from '../api/predictions'
import { getSettings } from '../api/settings'
import { useAuth } from '../context/AuthContext'

const STATUS_LABELS = { scheduled: 'Oczekuje', live: 'LIVE', finished: 'Zakończony', postponed: 'Przełożony', cancelled: 'Odwołany' }

function PredRow({ p, onSaved }) {
  const qc = useQueryClient()
  const isScheduled = p.match.status === 'scheduled'
  const isLive = p.match.status === 'live'
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [home, setHome] = useState(String(p.predicted_home))
  const [away, setAway] = useState(String(p.predicted_away))

  const saveMut = useMutation({
    mutationFn: () => submitPrediction({ match_id: p.match_id, predicted_home: parseInt(home) || 0, predicted_away: parseInt(away) || 0 }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['predictions'] }); setEditing(false) },
  })

  const delMut = useMutation({
    mutationFn: () => deletePrediction(p.match_id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['predictions'] }),
  })

  return (
    <div className="bg-gray-900 rounded-xl px-4 py-3 space-y-2">
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">{p.match.home_team} – {p.match.away_team}</p>
          <p className="text-xs text-gray-500">{p.match.league.name}</p>
          <p className="text-xs text-gray-600">{formatInTimeZone(new Date(p.match.kickoff + 'Z'), 'Europe/Warsaw', 'd MMM · HH:mm', { locale: pl })}</p>
        </div>

        {!editing && (
          <button
            onClick={() => isScheduled && setEditing(true)}
            className={`text-center text-sm shrink-0 ${isScheduled ? 'cursor-pointer hover:text-brand-400 transition' : 'cursor-default'}`}
            title={isScheduled ? 'Kliknij, aby zmienić typ' : undefined}
          >
            <span className="font-bold">{p.predicted_home}–{p.predicted_away}</span>
            {(p.match.status === 'finished' || isLive) && (
              <span className={`block text-xs ${isLive ? 'text-red-500 font-semibold animate-pulse [filter:drop-shadow(0_0_6px_rgba(239,68,68,0.8))]' : 'text-gray-500'}`}>
                {p.match.home_score}–{p.match.away_score}
              </span>
            )}
          </button>
        )}

        <div className="w-16 text-right shrink-0">
          {p.points != null ? (
            <span className={`font-bold ${p.points > 0 ? 'text-green-400' : 'text-gray-500'}`}>+{p.points} pkt</span>
          ) : (
            <span className={`text-xs ${isLive ? 'text-red-500 font-bold animate-pulse [filter:drop-shadow(0_0_6px_rgba(239,68,68,0.8))]' : 'text-gray-500'}`}>{STATUS_LABELS[p.match.status]}</span>
          )}
        </div>

        {isScheduled && !editing && (
          confirmDelete ? (
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => delMut.mutate()}
                disabled={delMut.isPending}
                className="text-xs bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white px-2 py-1 rounded transition"
              >
                {delMut.isPending ? '...' : 'Tak'}
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 px-2 py-1 rounded transition"
              >
                Nie
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="text-gray-600 hover:text-red-400 transition text-lg leading-none shrink-0"
              title="Usuń typ"
            >
              ×
            </button>
          )
        )}
      </div>

      {editing && (
        <div className="flex items-center gap-2 pt-1 border-t border-gray-800">
          <input
            type="text" inputMode="numeric" pattern="[0-9]*"
            value={home}
            onChange={e => setHome(e.target.value.replace(/[^0-9]/g, '').slice(0, 2))}
            onBlur={() => { if (home === '') setHome('0') }}
            className="w-12 text-center bg-gray-700 rounded-lg py-1.5 font-bold text-lg outline-none focus:ring-2 focus:ring-brand-500"
          />
          <span className="text-gray-500">–</span>
          <input
            type="text" inputMode="numeric" pattern="[0-9]*"
            value={away}
            onChange={e => setAway(e.target.value.replace(/[^0-9]/g, '').slice(0, 2))}
            onBlur={() => { if (away === '') setAway('0') }}
            className="w-12 text-center bg-gray-700 rounded-lg py-1.5 font-bold text-lg outline-none focus:ring-2 focus:ring-brand-500"
          />
          <button
            onClick={() => saveMut.mutate()}
            disabled={saveMut.isPending}
            className="ml-auto px-4 py-1.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-40 rounded-lg text-sm font-semibold transition"
          >
            {saveMut.isPending ? '...' : 'Zapisz'}
          </button>
          <button
            onClick={() => { setHome(p.predicted_home); setAway(p.predicted_away); setEditing(false) }}
            className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition"
          >
            Anuluj
          </button>
        </div>
      )}
    </div>
  )
}


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
            <p className="text-2xl font-bold text-yellow-400">{exactHits}</p>
            <p className="text-xs text-gray-400 mt-1">Dokładny wynik ⭐</p>
          </div>
          <div className="bg-gray-800 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-green-400">{outcomeHits}</p>
            <p className="text-xs text-gray-400 mt-1">Dobry typ ✅</p>
          </div>
        </div>
        <div className="bg-gray-800/60 rounded-lg px-3 py-2 text-xs text-gray-400 space-y-0.5">
          <div>⭐ <span className="text-white">Dokładny wynik</span> (wynik regulaminowy) = <span className="text-yellow-400 font-bold">{settings?.points_exact ?? 3} pkt</span></div>
          <div>✅ <span className="text-white">Dobry typ</span> (1/X/2) = <span className="text-green-400 font-bold">{settings?.points_outcome ?? 1} pkt</span></div>
          <div className="text-gray-500 pt-0.5">W fazie pucharowej liczy się wynik po 90 min — bez dogrywki i karnych.</div>
        </div>
      </div>

      <h3 className="font-semibold text-lg">Historia typów</h3>
      <div className="space-y-2">
        {predictions.length === 0 && <p className="text-gray-500 text-center py-8">Brak typów</p>}
        {predictions.map(p => (
          <PredRow key={p.id} p={p} />
        ))}
      </div>
    </div>
  )
}
