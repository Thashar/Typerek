import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format, addDays, subDays } from 'date-fns'
import { pl } from 'date-fns/locale'
import { getMatches } from '../api/matches'
import { myPredictions } from '../api/predictions'
import { useAuth } from '../context/AuthContext'
import MatchCard from '../components/MatchCard'

export default function Matches() {
  const { user } = useAuth()
  const [date, setDate] = useState(new Date())
  const dateStr = format(date, 'yyyy-MM-dd')

  const { data, isLoading } = useQuery({
    queryKey: ['matches', dateStr],
    queryFn: () => getMatches({ from_date: dateStr, to_date: dateStr }),
  })

  const { data: predsData } = useQuery({
    queryKey: ['predictions'],
    queryFn: myPredictions,
    enabled: !!user,
  })

  const predMap = {}
  predsData?.forEach(p => { predMap[p.match_id] = p })

  const matches = data?.matches ?? []

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={() => setDate(d => subDays(d, 1))} className="p-2 hover:bg-gray-800 rounded-lg transition">‹</button>
        <h2 className="text-lg font-semibold capitalize">
          {format(date, 'EEEE, d MMMM yyyy', { locale: pl })}
        </h2>
        <button onClick={() => setDate(d => addDays(d, 1))} className="p-2 hover:bg-gray-800 rounded-lg transition">›</button>
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {[-1, 0, 1, 2, 3, 4, 5, 6, 7].map(offset => {
          const d = addDays(new Date(), offset)
          const active = format(d, 'yyyy-MM-dd') === dateStr
          return (
            <button
              key={offset}
              onClick={() => setDate(d)}
              className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${active ? 'bg-brand-600 text-white' : 'bg-gray-800 hover:bg-gray-700 text-gray-300'}`}
            >
              {offset === 0 ? 'Dziś' : offset === 1 ? 'Jutro' : format(d, 'd.MM')}
            </button>
          )
        })}
      </div>

      {isLoading && (
        <div className="text-center text-gray-500 py-12">Ładowanie meczów...</div>
      )}

      {!isLoading && matches.length === 0 && (
        <div className="text-center text-gray-500 py-12">Brak meczów na ten dzień</div>
      )}

      <div className="space-y-3">
        {matches.map(match => (
          <MatchCard key={match.id} match={match} prediction={predMap[match.id]} />
        ))}
      </div>
    </div>
  )
}
