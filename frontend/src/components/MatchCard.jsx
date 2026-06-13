import { useState, useEffect, memo } from 'react'
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

function outcomeColor(prediction, match) {
  const pts = prediction.points
  if (pts != null) return pts > 0 ? 'text-green-400' : 'text-red-400'
  if ((match.status === 'live') && match.home_score != null && match.away_score != null) {
    const actual = match.home_score > match.away_score ? '1' : match.home_score < match.away_score ? '2' : 'X'
    return actual === prediction.predicted_outcome ? 'text-green-400' : 'text-red-400'
  }
  return 'text-gray-400'
}


function useLiveMinute(match) {
  if (match.status !== 'live') return { label: null, isHT: false }
  const short = match.status_short
  if (short === 'HT') return { label: 'Przerwa', isHT: true }
  if (short === '2H') return { label: '2. połowa', isHT: false }
  return { label: '1. połowa', isHT: false }
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

function MatchCard({ match, prediction }) {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    if (match.status !== 'scheduled') return
    const kickoffMs = new Date(match.kickoff + 'Z').getTime()
    if (Date.now() >= kickoffMs) return
    const delay = kickoffMs - Date.now()
    const id = setTimeout(() => setNow(Date.now()), delay)
    return () => clearTimeout(id)
  }, [match.kickoff, match.status])

  const kickoffMs = new Date(match.kickoff + 'Z').getTime()
  const isLocked = match.status !== 'scheduled' || now >= kickoffMs

  const [home, setHome] = useState(prediction?.predicted_home ?? '')
  const [away, setAway] = useState(prediction?.predicted_away ?? '')
  const [saved, setSaved] = useState(!!prediction)

  const { label: liveLabel, isHT } = useLiveMinute(match)

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
  const isLive = match.status === 'live'
  const showAsFinished = match.status === 'finished'

  return (
    <div className="bg-gray-900 rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>{match.league.name} · {match.league.country}</span>
        <span className={isLive ? 'text-red-500 font-bold animate-pulse' : ''}>
          {isLive
            ? 'LIVE'
            : STATUS_LABELS[match.status] ?? `${dateStr} ${timeStr}`}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex-1 flex items-center justify-end gap-2 min-w-0">
          <span className="font-semibold text-right truncate">{match.home_team}</span>
          {match.home_team_logo && <img src={match.home_team_logo} className="w-6 h-6 object-contain shrink-0" alt="" loading="lazy" />}
        </div>

        <div className="shrink-0 w-16 text-center font-bold">
          {showAsFinished ? (
            <span className="text-xl">{match.home_score} – {match.away_score}</span>
          ) : isLive ? (
            <div className="flex flex-col items-center leading-none gap-0.5">
              {liveLabel && (
                <span className={`text-[10px] font-bold animate-pulse ${isHT ? 'text-orange-400' : 'text-red-500'}`}>
                  {liveLabel}
                </span>
              )}
              <span className="text-xl text-red-500">{match.home_score ?? 0} – {match.away_score ?? 0}</span>
            </div>
          ) : (
            <span className="text-gray-500">vs</span>
          )}
        </div>

        <div className="flex-1 flex items-center gap-2 min-w-0">
          {match.away_team_logo && <img src={match.away_team_logo} className="w-6 h-6 object-contain shrink-0" alt="" loading="lazy" />}
          <span className="font-semibold truncate">{match.away_team}</span>
        </div>
      </div>

      {user && (
        <div className="border-t border-gray-800 pt-3">
          {isLocked ? (
            prediction ? (
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">
                  Twój typ: <span className="text-white font-bold">{prediction.predicted_home} – {prediction.predicted_away}</span>
                  <span className={`ml-2 ${outcomeColor(prediction, match)}`}>({prediction.predicted_outcome})</span>
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
                className={`ml-auto px-4 py-1.5 disabled:opacity-40 rounded-lg text-sm font-semibold transition ${saved ? 'bg-brand-600 hover:bg-brand-700' : 'bg-green-600 hover:bg-green-700'}`}
              >
                {mutation.isPending ? '...' : saved ? 'Zmień' : 'Typuj'}
              </button>
              {mutation.isError && (
                <span className="text-red-500 text-xs">{mutation.error?.response?.data?.detail}</span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default memo(MatchCard, (prev, next) =>
  prev.match.id === next.match.id &&
  prev.match.status === next.match.status &&
  prev.match.home_score === next.match.home_score &&
  prev.match.away_score === next.match.away_score &&
  prev.match.status_short === next.match.status_short &&
  prev.match.minute === next.match.minute &&
  prev.prediction?.points === next.prediction?.points &&
  prev.prediction?.predicted_home === next.prediction?.predicted_home &&
  prev.prediction?.predicted_away === next.prediction?.predicted_away
)
