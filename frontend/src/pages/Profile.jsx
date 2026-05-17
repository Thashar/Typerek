import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { myPredictions, submitPrediction, deletePrediction } from '../api/predictions'
import { useAuth } from '../context/AuthContext'

const STATUS_LABELS = { scheduled: 'Oczekuje', live: 'LIVE', finished: 'Zakończony', postponed: 'Przełożony', cancelled: 'Odwołany' }

function PredRow({ p, onSaved }) {
  const qc = useQueryClient()
  const isScheduled = p.match.status === 'scheduled'
  const [editing, setEditing] = useState(false)
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
        </div>

        {!editing && (
          <button
            onClick={() => isScheduled && setEditing(true)}
            className={`text-center text-sm shrink-0 ${isScheduled ? 'cursor-pointer hover:text-brand-400 transition' : 'cursor-default'}`}
            title={isScheduled ? 'Kliknij, aby zmienić typ' : undefined}
          >
            <span className="font-bold">{p.predicted_home}–{p.predicted_away}</span>
            {p.match.status === 'finished' && (
              <span className="block text-xs text-gray-500">{p.match.home_score}–{p.match.away_score}</span>
            )}
          </button>
        )}

        <div className="w-16 text-right shrink-0">
          {p.points != null ? (
            <span className={`font-bold ${p.points > 0 ? 'text-green-400' : 'text-gray-500'}`}>+{p.points} pkt</span>
          ) : (
            <span className="text-xs text-gray-500">{STATUS_LABELS[p.match.status]}</span>
          )}
        </div>

        {isScheduled && !editing && (
          <button
            onClick={() => delMut.mutate()}
            disabled={delMut.isPending}
            className="text-gray-600 hover:text-red-400 transition text-lg leading-none disabled:opacity-40"
            title="Usuń typ"
          >
            ×
          </button>
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
          <PredRow key={p.id} p={p} />
        ))}
      </div>
    </div>
  )
}
