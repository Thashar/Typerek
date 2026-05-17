import { useState } from 'react'
import { formatInTimeZone } from 'date-fns-tz'
import { pl } from 'date-fns/locale'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { submitPrediction } from '../api/predictions'
import { useAuth } from '../context/AuthContext'

const STATUS_LABELS = {
  scheduled: null,
  live: 'LIVE',
  finished: 'Zakończony',
  postponed: 'Przełożony',
  cancelled: 'Odwołany',
}

const OUTCOME_COLORS = {
  '1': 'text-green-400',
  'X': 'text-yellow-400',
  '2': 'text-blue-400',
}

function ScoreInput({ value, onChange, disabled }) {
  const [raw, setRaw] = useState(value === '' ? '' : String(value))

  const handleChange = (e) => {
    const v = e.target.value.replace(/[^0-9]/g, '').slice(0, 2)
    setRaw(v)
    onChange(v === '' ? '' : Math.min(20, parseInt(v)))
  }

  const handleBlur = () => {
    if (raw === '') { setRaw('0'); onChange(0) }
  }

  return (
    <input
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      value={raw}
      onChange={handleChange}
      onBlur={handleBlur}
      disabled={disabled}
      className="w-12 text-center bg-gray-700 rounded-lg py-1.5 font-bold text-lg outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-50"
    />
  )
}

export default function MatchCard({ match, prediction }) {
  const { user } = useAuth()
  const qc = useQueryClient()
  const isLocked = match.status !== 'scheduled'

  const [home, setHome] = useState(prediction?.predicted_home ?? '')
  const [away, setAway] = useState(prediction?.predicted_away ?? '')
  const [saved, setSaved] = useState(!!prediction)

  const mutation = useMutation({
    mutationFn: () => submitPrediction({ match_id: match.id, predicted_home: home, predicted_away: away }),
    onSuccess: () => {
      setSaved(true)
      qc.invalidateQueries(['predictions'])
    },
  })

  const kickoff = new Date(match.kickoff + 'Z')
  const timeStr = formatInTimeZone(kickoff, 'Europe/Warsaw', 'HH:mm', { locale: pl })
  const dateStr = formatInTimeZone(kickoff, 'Europe/Warsaw', 'd MMM', { locale: pl })

  const pts = prediction?.points

  return (
    <div className="bg-gray-900 rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>{match.league.name} · {match.league.country}</span>
        <span className={match.status === 'live' ? 'text-red-400 font-bold animate-pulse' : ''}>
          {STATUS_LABELS[match.status] ?? `${dateStr} ${timeStr}`}
          {match.status === 'scheduled' && ` · ${timeStr}`}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex-1 flex items-center gap-2 justify-end">
          {match.home_team_logo && <img src={match.home_team_logo} className="w-6 h-6 object-contain" alt="" />}
          <span className="font-semibold text-right">{match.home_team}</span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {match.status === 'finished' ? (
            <span className="text-xl font-bold w-16 text-center">
              {match.home_score} – {match.away_score}
            </span>
          ) : match.status === 'live' ? (
            <span className="text-xl font-bold w-16 text-center text-red-400">
              {match.home_score ?? 0} – {match.away_score ?? 0}
            </span>
          ) : (
            <span className="text-gray-500 font-bold w-16 text-center">vs</span>
          )}
        </div>

        <div className="flex-1 flex items-center gap-2">
          {match.away_team_logo && <img src={match.away_team_logo} className="w-6 h-6 object-contain" alt="" />}
          <span className="font-semibold">{match.away_team}</span>
        </div>
      </div>

      {user && (
        <div className="border-t border-gray-800 pt-3">
          {isLocked ? (
            prediction ? (
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">
                  Twój typ: <span className="text-white font-bold">{prediction.predicted_home} – {prediction.predicted_away}</span>
                  <span className={`ml-2 ${OUTCOME_COLORS[prediction.predicted_outcome]}`}>({prediction.predicted_outcome})</span>
                </span>
                {pts != null && (
                  <span className={`font-bold ${pts > 0 ? 'text-green-400' : 'text-gray-500'}`}>
                    +{pts} pkt
                  </span>
                )}
              </div>
            ) : (
              <p className="text-gray-600 text-sm text-center">Nie typowałeś tego meczu</p>
            )
          ) : (
            <div className="flex items-center gap-3">
              <ScoreInput value={home} onChange={setHome} />
              <span className="text-gray-500">–</span>
              <ScoreInput value={away} onChange={setAway} />
              <button
                onClick={() => mutation.mutate()}
                disabled={home === '' || away === '' || mutation.isPending}
                className="ml-auto px-4 py-1.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-40 rounded-lg text-sm font-semibold transition"
              >
                {mutation.isPending ? '...' : saved ? 'Zmień' : 'Typuj'}
              </button>
              {mutation.isError && (
                <span className="text-red-400 text-xs">{mutation.error?.response?.data?.detail}</span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
