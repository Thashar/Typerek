import { useState, useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import { pl } from 'date-fns/locale'
import api from '../api/client'
import { getMatches, getMatchDates } from '../api/matches'
import { myPredictions } from '../api/predictions'
import { useAuth } from '../context/AuthContext'
import MatchCard from '../components/MatchCard'

function formatDateBtn(dateStr) {
  const today = format(new Date(), 'yyyy-MM-dd')
  const tomorrow = format(new Date(Date.now() + 86400000), 'yyyy-MM-dd')
  if (dateStr === today) return 'Dziś'
  if (dateStr === tomorrow) return 'Jutro'
  return format(parseISO(dateStr), 'd MMM', { locale: pl })
}

export default function Matches() {
  const { user } = useAuth()
  const [selectedLeague, setSelectedLeague] = useState(null)
  const [selectedDate, setSelectedDate] = useState(null)
  const dateNavRef = useRef(null)

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
    enabled: !!selectedLeague,
    staleTime: 5 * 60 * 1000,
  })

  useEffect(() => {
    if (dates.length > 0) {
      const today = format(new Date(), 'yyyy-MM-dd')
      setSelectedDate(dates.includes(today) ? today : dates[0])
    } else {
      setSelectedDate(null)
    }
  }, [dates])

  useEffect(() => {
    if (selectedDate && dateNavRef.current) {
      const btn = dateNavRef.current.querySelector('[data-active="true"]')
      btn?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
    }
  }, [selectedDate])

  const { data, isLoading } = useQuery({
    queryKey: ['matches', selectedLeague, selectedDate],
    queryFn: () => getMatches({ from_date: selectedDate, to_date: selectedDate, league_id: selectedLeague }),
    enabled: !!selectedDate && !!selectedLeague,
    refetchInterval: 60000,
  })

  const { data: predsData } = useQuery({
    queryKey: ['predictions'],
    queryFn: myPredictions,
    enabled: !!user,
    refetchInterval: 60000,
  })

  const predMap = {}
  predsData?.forEach(p => { predMap[p.match_id] = p })
  const matches = data?.matches ?? []

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
        {leagues.map(l => (
          <button
            key={l.id}
            onClick={() => setSelectedLeague(l.id)}
            className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition ${
              selectedLeague === l.id
                ? 'bg-brand-600 text-white'
                : 'bg-gray-800 hover:bg-gray-700 text-gray-300'
            }`}
          >
            {l.logo_url && <img src={l.logo_url} className="w-4 h-4 object-contain" alt="" />}
            {l.name}
          </button>
        ))}
      </div>

      {/* Nawigacja po dniach */}
      {dates.length > 0 && (
        <>
          <div className="flex items-center justify-between">
            <button onClick={prevDate} disabled={dates.indexOf(selectedDate) === 0}
              className="p-2 hover:bg-gray-800 rounded-lg transition disabled:opacity-30">‹</button>
            <span className="text-sm font-semibold capitalize text-gray-300">
              {selectedDate ? format(parseISO(selectedDate), 'EEEE, d MMMM yyyy', { locale: pl }) : ''}
            </span>
            <button onClick={nextDate} disabled={dates.indexOf(selectedDate) === dates.length - 1}
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

      {dates.length === 0 && selectedLeague && (
        <p className="text-center text-gray-500 py-8 text-sm">Brak nadchodzących meczów dla tej ligi</p>
      )}

      {isLoading && <div className="text-center text-gray-500 py-12">Ładowanie meczów...</div>}

      <div className="space-y-3">
        {matches.map(match => (
          <MatchCard key={match.id} match={match} prediction={predMap[match.id]} />
        ))}
      </div>
    </div>
  )
}
