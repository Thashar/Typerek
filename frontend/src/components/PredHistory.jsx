import { useState, useMemo } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { formatInTimeZone } from 'date-fns-tz'
import { format, parseISO } from 'date-fns'
import { pl } from 'date-fns/locale'
import { submitPrediction, deletePrediction } from '../api/predictions'

const STATUS_LABELS = {
  scheduled: 'Oczekuje', live: 'LIVE', finished: 'Zakończony',
  postponed: 'Przełożony', cancelled: 'Odwołany',
}

export function PredRow({ p }) {
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
                Wynik meczu: {p.match.home_score}–{p.match.away_score}
              </span>
            )}
          </button>
        )}

        <div className="w-16 text-right shrink-0">
          {p.points != null ? (
            <span className={`font-bold ${p.points > 0 ? 'text-green-400' : 'text-gray-500'}`}>+{p.points} pkt</span>
          ) : (
            <span className={`text-xs ${isLive ? 'text-red-500 font-bold animate-pulse [filter:drop-shadow(0_0_6px_rgba(239,68,68,0.8))]' : 'text-gray-500'}`}>
              {STATUS_LABELS[p.match.status]}
            </span>
          )}
        </div>

        {isScheduled && !editing && (
          confirmDelete ? (
            <div className="flex items-center gap-1 shrink-0">
              <button onClick={() => delMut.mutate()} disabled={delMut.isPending}
                className="text-xs bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white px-2 py-1 rounded transition">
                {delMut.isPending ? '...' : 'Tak'}
              </button>
              <button onClick={() => setConfirmDelete(false)}
                className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 px-2 py-1 rounded transition">
                Nie
              </button>
            </div>
          ) : (
            <button onClick={() => setConfirmDelete(true)}
              className="text-gray-600 hover:text-red-400 transition text-lg leading-none shrink-0"
              title="Usuń typ">
              ×
            </button>
          )
        )}
      </div>

      {editing && (
        <div className="flex items-center gap-2 pt-1 border-t border-gray-800">
          <input type="text" inputMode="numeric" pattern="[0-9]*"
            value={home}
            onChange={e => setHome(e.target.value.replace(/[^0-9]/g, '').slice(0, 2))}
            onBlur={() => { if (home === '') setHome('0') }}
            className="w-12 text-center bg-gray-700 rounded-lg py-1.5 font-bold text-lg outline-none focus:ring-2 focus:ring-brand-500"
          />
          <span className="text-gray-500">–</span>
          <input type="text" inputMode="numeric" pattern="[0-9]*"
            value={away}
            onChange={e => setAway(e.target.value.replace(/[^0-9]/g, '').slice(0, 2))}
            onBlur={() => { if (away === '') setAway('0') }}
            className="w-12 text-center bg-gray-700 rounded-lg py-1.5 font-bold text-lg outline-none focus:ring-2 focus:ring-brand-500"
          />
          <button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}
            className="ml-auto px-4 py-1.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-40 rounded-lg text-sm font-semibold transition">
            {saveMut.isPending ? '...' : 'Zapisz'}
          </button>
          <button onClick={() => { setHome(String(p.predicted_home)); setAway(String(p.predicted_away)); setEditing(false) }}
            className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition">
            Anuluj
          </button>
        </div>
      )}
    </div>
  )
}

function groupByDayAndLeague(predictions) {
  const byDay = {}
  for (const p of predictions) {
    const day = formatInTimeZone(new Date(p.match.kickoff + 'Z'), 'Europe/Warsaw', 'yyyy-MM-dd')
    if (!byDay[day]) byDay[day] = {}
    const league = p.match.league.name
    if (!byDay[day][league]) byDay[day][league] = []
    byDay[day][league].push(p)
  }
  return Object.entries(byDay).sort(([a], [b]) => b.localeCompare(a))
}

export function GroupedPredHistory({ predictions }) {
  const [expanded, setExpanded] = useState({})
  const toggle = (day) => setExpanded(e => ({ ...e, [day]: !e[day] }))
  const groups = useMemo(() => groupByDayAndLeague(predictions), [predictions])

  if (predictions.length === 0) {
    return <p className="text-gray-500 text-center py-8">Brak typów</p>
  }

  return (
    <div className="space-y-2">
      {groups.map(([day, leagues]) => (
        <div key={day} className="rounded-xl overflow-hidden">
          <button
            onClick={() => toggle(day)}
            className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-800 text-sm font-semibold text-gray-200 hover:bg-gray-750 transition"
          >
            <span>{format(parseISO(day), 'd MMMM yyyy', { locale: pl })}</span>
            <span className="text-gray-400 text-xs">{expanded[day] ? '▾' : '▸'}</span>
          </button>
          {expanded[day] && (
            <div className="space-y-3 mt-1">
              {Object.entries(leagues).map(([leagueName, preds]) => (
                <div key={leagueName}>
                  <p className="px-4 pt-1 pb-0.5 text-xs text-gray-500 font-medium">{leagueName}</p>
                  <div className="space-y-1">
                    {preds.map(p => <PredRow key={p.id} p={p} />)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
