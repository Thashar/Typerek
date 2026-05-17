import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { formatInTimeZone } from 'date-fns-tz'
import { pl } from 'date-fns/locale'
import api from '../api/client'
import { myPredictions } from '../api/predictions'
import { useAuth } from '../context/AuthContext'

const STATUS_LABEL = {
  SCHEDULED: '',
  LIVE: '🔴 LIVE',
  FINISHED: '',
  POSTPONED: 'Odłożony',
}

function MatchRow({ m, prediction }) {
  const kickoff = new Date(m.kickoff + 'Z')
  const isFinished = m.status === 'FINISHED'
  const isLive = m.status === 'LIVE'

  return (
    <div className={`py-3 px-3 ${isLive ? 'bg-red-900/20' : ''}`}>
      <div className="text-center text-xs mb-1.5">
        {isLive
          ? <span className="text-red-400 font-bold">LIVE</span>
          : <span className="text-gray-500">
              {formatInTimeZone(kickoff, 'Europe/Warsaw', 'HH:mm')}
              <span className="mx-1 text-gray-700">·</span>
              {formatInTimeZone(kickoff, 'Europe/Warsaw', 'd MMM', { locale: pl })}
            </span>
        }
      </div>
      <div className="flex items-center gap-2">
        <div className="flex-1 flex items-center justify-end gap-1.5 min-w-0">
          <span className="text-sm font-medium text-right truncate">{m.home_team}</span>
          {m.home_team_logo && <img src={m.home_team_logo} className="w-5 h-5 object-contain shrink-0" alt="" />}
        </div>
        <div className="shrink-0 w-14 text-center">
          {isFinished || isLive
            ? <span className="font-bold text-sm text-white">{m.home_score ?? 0}–{m.away_score ?? 0}</span>
            : <span className="text-gray-500 text-xs">vs</span>
          }
        </div>
        <div className="flex-1 flex items-center gap-1.5 min-w-0">
          {m.away_team_logo && <img src={m.away_team_logo} className="w-5 h-5 object-contain shrink-0" alt="" />}
          <span className="text-sm font-medium truncate">{m.away_team}</span>
        </div>
      </div>
      {prediction && (
        <div className="mt-1.5 flex items-center justify-center gap-2">
          <span className="text-xs text-gray-500">Twój typ:</span>
          <span className="text-xs font-bold text-brand-400">{prediction.predicted_home}–{prediction.predicted_away}</span>
          {prediction.points != null && (
            <span className={`text-xs font-bold ${prediction.points > 0 ? 'text-green-400' : 'text-gray-500'}`}>
              +{prediction.points} pkt
            </span>
          )}
        </div>
      )}
    </div>
  )
}

const STAGE_LABELS = {
  ROUND_OF_16: '1/8 finału',
  QUARTER_FINALS: 'Ćwierćfinały',
  SEMI_FINALS: 'Półfinały',
  THIRD_PLACE: 'Mecz o 3. miejsce',
  FINAL: 'Finał',
}

function GroupCard({ name, matches, predMap }) {
  return (
    <div className="bg-gray-800 rounded-xl overflow-hidden">
      <div className="px-3 py-2 bg-gray-750 border-b border-gray-700">
        <h3 className="text-xs font-bold text-brand-400 uppercase tracking-wider">Grupa {name}</h3>
      </div>
      <div className="divide-y divide-gray-700/50">
        {matches.map(m => <MatchRow key={m.id} m={m} prediction={predMap[m.id]} />)}
      </div>
    </div>
  )
}

function KnockoutSection({ stage, matches, predMap }) {
  return (
    <div className="bg-gray-800 rounded-xl overflow-hidden">
      <div className="px-3 py-2 border-b border-gray-700">
        <h3 className="text-xs font-bold text-brand-400 uppercase tracking-wider">
          {STAGE_LABELS[stage] || stage}
        </h3>
      </div>
      <div className="divide-y divide-gray-700/50">
        {matches.map(m => <MatchRow key={m.id} m={m} prediction={predMap[m.id]} />)}
      </div>
    </div>
  )
}

const KNOCKOUT_ORDER = ['ROUND_OF_16', 'QUARTER_FINALS', 'SEMI_FINALS', 'THIRD_PLACE', 'FINAL']

export default function WorldCup() {
  const [tab, setTab] = useState('groups')
  const { user } = useAuth()

  const { data, isLoading } = useQuery({
    queryKey: ['worldcup'],
    queryFn: () => api.get('/matches/worldcup').then(r => r.data),
    refetchInterval: 60000,
    staleTime: 60000,
  })

  const { data: predsData } = useQuery({
    queryKey: ['predictions'],
    queryFn: myPredictions,
    enabled: !!user,
    refetchInterval: 60000,
  })

  const predMap = {}
  predsData?.forEach(p => { predMap[p.match_id] = p })

  const groups = data?.groups ?? {}
  const knockout = data?.knockout ?? {}

  const hasGroups = Object.keys(groups).length > 0
  const hasKnockout = Object.keys(knockout).length > 0

  if (isLoading) {
    return <div className="text-center text-gray-500 py-20">Ładowanie...</div>
  }

  if (!hasGroups && !hasKnockout) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center text-gray-500">
        <div className="text-4xl mb-3">🌍</div>
        <p>Brak danych mistrzostw świata.</p>
        <p className="text-sm mt-1">Admin musi zsynchronizować dane dla ligi WC.</p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-xl">🌍</span>
        <h1 className="text-lg font-bold text-white">FIFA World Cup 2026</h1>
      </div>

      <div className="flex gap-1 bg-gray-800 p-1 rounded-xl">
        <button
          onClick={() => setTab('groups')}
          className={`flex-1 py-2 text-sm font-semibold rounded-lg transition ${tab === 'groups' ? 'bg-brand-600 text-white' : 'text-gray-400 hover:text-gray-200'}`}
        >
          Grupy
        </button>
        <button
          onClick={() => setTab('knockout')}
          className={`flex-1 py-2 text-sm font-semibold rounded-lg transition ${tab === 'knockout' ? 'bg-brand-600 text-white' : 'text-gray-400 hover:text-gray-200'}`}
        >
          Faza pucharowa
        </button>
      </div>

      {tab === 'groups' && (
        <div className="space-y-3">
          {hasGroups
            ? Object.entries(groups).map(([name, matches]) => (
                <GroupCard key={name} name={name} matches={matches} predMap={predMap} />
              ))
            : <p className="text-center text-gray-500 py-8 text-sm">Brak meczów grupowych</p>
          }
        </div>
      )}

      {tab === 'knockout' && (
        <div className="space-y-3">
          {hasKnockout
            ? KNOCKOUT_ORDER.filter(s => knockout[s]).map(stage => (
                <KnockoutSection key={stage} stage={stage} matches={knockout[stage]} predMap={predMap} />
              ))
            : <p className="text-center text-gray-500 py-8 text-sm">Brak meczów fazy pucharowej</p>
          }
        </div>
      )}
    </div>
  )
}
