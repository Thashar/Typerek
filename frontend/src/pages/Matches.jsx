import { useState, useEffect, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import { pl } from 'date-fns/locale'
import api from '../api/client'
import { getMatches, getMatchDates, getLive } from '../api/matches'
import { myPredictions } from '../api/predictions'
import { useAuth } from '../context/AuthContext'
import MatchCard from '../components/MatchCard'
import PageLoader from '../components/PageLoader'
import { usePageTitle } from '../hooks/usePageTitle'

const LIVE_KEY = 'LIVE'

function formatDateBtn(dateStr) {
  const today = format(new Date(), 'yyyy-MM-dd')
  const tomorrow = format(new Date(Date.now() + 86400000), 'yyyy-MM-dd')
  if (dateStr === today) return 'Dziś'
  if (dateStr === tomorrow) return 'Jutro'
  return format(parseISO(dateStr), 'd MMM', { locale: pl })
}

export default function Matches() {
  usePageTitle('Mecze')
  const { user } = useAuth()
  const qc = useQueryClient()
  const [searchParams] = useSearchParams()
  const [selectedLeague, setSelectedLeague] = useState(searchParams.get('live') === '1' ? LIVE_KEY : null)
  const [selectedDate, setSelectedDate] = useState(null)
  const [selectedLiveLeague, setSelectedLiveLeague] = useState(null)
  const dateNavRef = useRef(null)
  const isLiveMode = selectedLeague === LIVE_KEY

  useEffect(() => {
    const base = import.meta.env.VITE_WS_URL || 'ws://localhost:8000'
    let ws, closed = false
    const connect = () => {
      ws = new WebSocket(`${base}/api/matches/ws`)
      ws.onmessage = () => {
        qc.invalidateQueries({ queryKey: ['matches-live'] })
        qc.invalidateQueries({ queryKey: ['matches'] })
      }
      ws.onclose = () => { if (!closed) setTimeout(connect, 5000) }
      ws.onerror = () => ws.close()
    }
    connect()
    return () => { closed = true; ws?.close() }
  }, [])

  useEffect(() => {
    if (searchParams.get('live') === '1') {
      setSelectedLeague(LIVE_KEY)
    } else if (isLiveMode) {
      setSelectedLeague(leagues.length > 0 ? leagues[0].id : null)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  const { data: leagues = [] } = useQuery({
    queryKey: ['match-leagues'],
    queryFn: () => api.get('/matches/leagues').then(r => r.data),
    staleTime: 5 * 60 * 1000,
  })

  useEffect(() => {
    if (leagues.length > 0 && !selectedLeague) {
      setSelectedLeague(leagues[0].id)
    }
  }, [leagues])

  const { data: dates = [] } = useQuery({
    queryKey: ['match-dates', selectedLeague],
    queryFn: () => getMatchDates({ from_date: format(new Date(), 'yyyy-MM-dd'), league_id: selectedLeague }),
    enabled: !!selectedLeague && !isLiveMode,
    staleTime: 5 * 60 * 1000,
  })

  useEffect(() => {
    if (isLiveMode) return
    if (dates.length > 0) {
      const today = format(new Date(), 'yyyy-MM-dd')
      setSelectedDate(dates.includes(today) ? today : dates[0])
    } else {
      setSelectedDate(null)
    }
  }, [dates, isLiveMode])

  useEffect(() => {
    if (selectedDate && dateNavRef.current) {
      const btn = dateNavRef.current.querySelector('[data-active="true"]')
      btn?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
    }
  }, [selectedDate])

  const { data: liveData, isLoading: liveLoading } = useQuery({
    queryKey: ['matches-live'],
    queryFn: getLive,
    refetchInterval: 60000,
    refetchIntervalInBackground: false,
    staleTime: 0,
  })

  const { data, isLoading } = useQuery({
    queryKey: ['matches', selectedLeague, selectedDate],
    queryFn: () => getMatches({ from_date: selectedDate, to_date: selectedDate, league_id: selectedLeague }),
    enabled: !!selectedDate && !!selectedLeague && !isLiveMode,
    refetchInterval: 60000,
    refetchIntervalInBackground: false,
  })

  const { data: predsData } = useQuery({
    queryKey: ['predictions'],
    queryFn: myPredictions,
    enabled: !!user,
    refetchInterval: 60000,
    refetchIntervalInBackground: false,
  })

  const predMap = {}
  predsData?.forEach(p => { predMap[p.match_id] = p })

  const allLiveMatches = liveData?.matches ?? []
  const liveLeagues = isLiveMode
    ? [...new Map(allLiveMatches.map(m => [m.league.id, m.league])).values()]
    : []
  const filteredLiveMatches = selectedLiveLeague
    ? allLiveMatches.filter(m => m.league.id === selectedLiveLeague)
    : allLiveMatches

  const loading = isLiveMode ? liveLoading : isLoading

  // Poza trybem live: live mecze z wybranej ligi na górze, reszta bez duplikatów
  const liveForLeague = isLiveMode ? [] : allLiveMatches.filter(m => m.league.id === selectedLeague)
  const liveIds = new Set(liveForLeague.map(m => m.id))
  const dayMatches = (data?.matches ?? []).filter(m => !liveIds.has(m.id))
  const matches = isLiveMode ? filteredLiveMatches : [...liveForLeague, ...dayMatches]

  const prevDate = () => {
    const idx = dates.indexOf(selectedDate)
    if (idx > 0) setSelectedDate(dates[idx - 1])
  }
  const nextDate = () => {
    const idx = dates.indexOf(selectedDate)
    if (idx < dates.length - 1) setSelectedDate(dates[idx + 1])
  }

  if (leagues.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center text-gray-500">
        Brak meczów w bazie. Admin musi uruchomić synchronizację.
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-4 space-y-3">
      {/* Liga selector */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {isLiveMode ? (
          <>
            <button
              onClick={() => setSelectedLiveLeague(null)}
              className={`shrink-0 px-3 py-2 rounded-xl text-xs font-semibold transition ${
                selectedLiveLeague === null ? 'bg-brand-600 text-white' : 'bg-gray-800 hover:bg-gray-700 text-gray-300'
              }`}
            >
              Wszystkie
            </button>
            {liveLeagues.map(l => (
              <button
                key={l.id}
                onClick={() => setSelectedLiveLeague(l.id)}
                className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition ${
                  selectedLiveLeague === l.id ? 'bg-brand-600 text-white' : 'bg-gray-800 hover:bg-gray-700 text-gray-300'
                }`}
              >
                {l.logo_url && <img src={l.logo_url} className="w-4 h-4 object-contain" alt="" />}
                {l.name}
              </button>
            ))}
          </>
        ) : (
          leagues.map(l => (
            <button
              key={l.id}
              onClick={() => setSelectedLeague(l.id)}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition ${
                selectedLeague === l.id ? 'bg-brand-600 text-white' : 'bg-gray-800 hover:bg-gray-700 text-gray-300'
              }`}
            >
              {l.logo_url && <img src={l.logo_url} className="w-4 h-4 object-contain" alt="" />}
              {l.name}
            </button>
          ))
        )}
      </div>

      {/* Nawigacja po dniach — ukryta w trybie live */}
      {!isLiveMode && dates.length > 0 && (
        <>
          <div className="flex items-center justify-between">
            <button onClick={prevDate} disabled={dates.indexOf(selectedDate) === 0}
              aria-label="Poprzedni dzień"
              className="p-2 hover:bg-gray-800 rounded-lg transition disabled:opacity-30">‹</button>
            <span className="text-sm font-semibold capitalize text-gray-300">
              {selectedDate ? format(parseISO(selectedDate), 'EEEE, d MMMM yyyy', { locale: pl }) : ''}
            </span>
            <button onClick={nextDate} disabled={dates.indexOf(selectedDate) === dates.length - 1}
              aria-label="Następny dzień"
              className="p-2 hover:bg-gray-800 rounded-lg transition disabled:opacity-30">›</button>
          </div>

          <div ref={dateNavRef} className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
            {dates.map(d => (
              <button key={d} data-active={d === selectedDate ? 'true' : 'false'}
                onClick={() => setSelectedDate(d)}
                className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  d === selectedDate ? 'bg-brand-600 text-white' : 'bg-gray-800 hover:bg-gray-700 text-gray-300'
                }`}>
                {formatDateBtn(d)}
              </button>
            ))}
          </div>
        </>
      )}

      {!isLiveMode && dates.length === 0 && selectedLeague && (
        <p className="text-center text-gray-500 py-8 text-sm">Brak nadchodzących meczów dla tej ligi</p>
      )}

      {loading && <PageLoader />}

      {!loading && isLiveMode && matches.length === 0 && (
        <p className="text-center text-gray-500 py-12 text-sm">Brak trwających meczów</p>
      )}

      <div className="space-y-3">
        {matches.map(match => (
          <MatchCard key={match.id} match={match} prediction={predMap[match.id]} />
        ))}
      </div>
    </div>
  )
}
