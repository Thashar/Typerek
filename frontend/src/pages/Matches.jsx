import { useState, useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import { pl } from 'date-fns/locale'
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
  const [selectedDate, setSelectedDate] = useState(null)
  const [selectedLeague, setSelectedLeague] = useState(null)
  const navRef = useRef(null)

  const { data: dates = [], isLoading: datesLoading } = useQuery({
    queryKey: ['match-dates'],
    queryFn: () => getMatchDates({ from_date: format(new Date(), 'yyyy-MM-dd') }),
    staleTime: 5 * 60 * 1000,
  })

  useEffect(() => {
    if (dates.length > 0 && !selectedDate) {
      const today = format(new Date(), 'yyyy-MM-dd')
      setSelectedDate(dates.includes(today) ? today : dates[0])
    }
  }, [dates, selectedDate])

  useEffect(() => {
    if (selectedDate && navRef.current) {
      const btn = navRef.current.querySelector('[data-active="true"]')
      btn?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
    }
  }, [selectedDate])

  const { data, isLoading } = useQuery({
    queryKey: ['matches', selectedDate],
    queryFn: () => getMatches({ from_date: selectedDate, to_date: selectedDate }),
    enabled: !!selectedDate,
    refetchInterval: 10000,
  })

  const { data: predsData } = useQuery({
    queryKey: ['predictions'],
    queryFn: myPredictions,
    enabled: !!user,
    refetchInterval: 10000,
  })

  const predMap = {}
  predsData?.forEach(p => { predMap[p.match_id] = p })

  const allMatches = data?.matches ?? []

  const leagues = []
  const seenLeagues = new Set()
  allMatches.forEach(m => {
    if (!seenLeagues.has(m.league.id)) {
      seenLeagues.add(m.league.id)
      leagues.push(m.league)
    }
  })

  const filteredMatches = selectedLeague
    ? allMatches.filter(m => m.league.id === selectedLeague)
    : allMatches

  const STAGE_LABELS = {
    GROUP_STAGE: 'Faza grupowa', ROUND_OF_16: '1/8 finału',
    LAST_16: '1/8 finału', QUARTER_FINALS: 'Ćwierćfinały',
    SEMI_FINALS: 'Półfinały', THIRD_PLACE: 'Mecz o 3. miejsce',
    FINAL: 'Finał',
  }

  const grouped = {}
  filteredMatches.forEach(m => {
    const key = m.match_group || m.stage || 'other'
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(m)
  })
  const groupKeys = Object.keys(grouped)
  const useGroups = groupKeys.length > 1 && filteredMatches.some(m => m.stage || m.match_group)

  const prevDate = () => {
    const idx = dates.indexOf(selectedDate)
    if (idx > 0) { setSelectedDate(dates[idx - 1]); setSelectedLeague(null) }
  }
  const nextDate = () => {
    const idx = dates.indexOf(selectedDate)
    if (idx < dates.length - 1) { setSelectedDate(dates[idx + 1]); setSelectedLeague(null) }
  }

  if (datesLoading) return <div className="text-center text-gray-500 py-20">Ładowanie...</div>

  if (dates.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center text-gray-500">
        Brak meczów w bazie. Admin musi uruchomić synchronizację.
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={prevDate} disabled={dates.indexOf(selectedDate) === 0}
          className="p-2 hover:bg-gray-800 rounded-lg transition disabled:opacity-30">‹</button>
        <h2 className="text-lg font-semibold capitalize">
          {selectedDate ? format(parseISO(selectedDate), 'EEEE, d MMMM yyyy', { locale: pl }) : ''}
        </h2>
        <button onClick={nextDate} disabled={dates.indexOf(selectedDate) === dates.length - 1}
          className="p-2 hover:bg-gray-800 rounded-lg transition disabled:opacity-30">›</button>
      </div>

      <div ref={navRef} className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
        {dates.map(d => (
          <button key={d} data-active={d === selectedDate ? 'true' : 'false'}
            onClick={() => { setSelectedDate(d); setSelectedLeague(null) }}
            className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              d === selectedDate ? 'bg-brand-600 text-white' : 'bg-gray-800 hover:bg-gray-700 text-gray-300'
            }`}>
            {formatDateBtn(d)}
          </button>
        ))}
      </div>

      {leagues.length > 1 && (
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
          <button
            onClick={() => setSelectedLeague(null)}
            className={`shrink-0 px-3 py-1 rounded-lg text-xs font-semibold transition ${
              !selectedLeague ? 'bg-gray-600 text-white' : 'bg-gray-800 hover:bg-gray-700 text-gray-400'
            }`}
          >
            Wszystkie
          </button>
          {leagues.map(l => (
            <button key={l.id}
              onClick={() => setSelectedLeague(l.id === selectedLeague ? null : l.id)}
              className={`shrink-0 px-3 py-1 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
                selectedLeague === l.id ? 'bg-brand-700 text-white' : 'bg-gray-800 hover:bg-gray-700 text-gray-300'
              }`}
            >
              {l.logo_url && <img src={l.logo_url} className="w-3.5 h-3.5 object-contain" alt="" />}
              {l.name}
            </button>
          ))}
        </div>
      )}

      {isLoading && <div className="text-center text-gray-500 py-12">Ładowanie meczów...</div>}

      {useGroups ? (
        <div className="space-y-6">
          {groupKeys.map(key => (
            <div key={key}>
              <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">
                {STAGE_LABELS[key] || key.replace(/_/g, ' ')}
              </h3>
              <div className="space-y-3">
                {grouped[key].map(match => (
                  <MatchCard key={match.id} match={match} prediction={predMap[match.id]} />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredMatches.map(match => (
            <MatchCard key={match.id} match={match} prediction={predMap[match.id]} />
          ))}
        </div>
      )}
    </div>
  )
}
