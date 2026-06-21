import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { formatInTimeZone } from 'date-fns-tz'
import { pl } from 'date-fns/locale'
import api from '../api/client'
import { myPredictions } from '../api/predictions'
import { useAuth } from '../context/AuthContext'
import PageLoader from '../components/PageLoader'

function MatchRow({ m, prediction }) {
  const kickoff = new Date(m.kickoff + 'Z')
  const isFinished = m.status === 'finished'
  const isLive = m.status === 'live'

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

function computeStandings(matches) {
  const teams = {}

  const ensure = (name, logo) => {
    if (!teams[name]) {
      teams[name] = { name, logo, P: 0, W: 0, D: 0, L: 0, GF: 0, GA: 0 }
    }
  }

  for (const m of matches) {
    ensure(m.home_team, m.home_team_logo)
    ensure(m.away_team, m.away_team_logo)

    if ((m.status === 'finished' || m.status === 'live') && m.home_score != null && m.away_score != null) {
      const h = teams[m.home_team]
      const a = teams[m.away_team]
      const hs = Number(m.home_score)
      const as_ = Number(m.away_score)

      h.P++; a.P++
      h.GF += hs; h.GA += as_
      a.GF += as_; a.GA += hs

      if (hs > as_) { h.W++; a.L++ }
      else if (hs < as_) { a.W++; h.L++ }
      else { h.D++; a.D++ }
    }
  }

  return Object.values(teams).sort((a, b) => {
    const ptsA = a.W * 3 + a.D
    const ptsB = b.W * 3 + b.D
    if (ptsB !== ptsA) return ptsB - ptsA
    const gdA = a.GF - a.GA
    const gdB = b.GF - b.GA
    if (gdB !== gdA) return gdB - gdA
    return b.GF - a.GF
  })
}

function GroupTable({ name, matches }) {
  const standings = computeStandings(matches)

  return (
    <div className="bg-gray-800 rounded-xl overflow-hidden">
      <div className="px-3 py-2 border-b border-gray-700">
        <h3 className="text-xs font-bold text-brand-400 uppercase tracking-wider">Grupa {name}</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-gray-500 border-b border-gray-700/50">
              <th className="py-2 pl-3 pr-1 text-left w-6">#</th>
              <th className="py-2 px-2 text-left">Drużyna</th>
              <th className="py-2 px-1.5 text-center">M</th>
              <th className="py-2 px-1.5 text-center">W</th>
              <th className="py-2 px-1.5 text-center">R</th>
              <th className="py-2 px-1.5 text-center">P</th>
              <th className="py-2 px-1.5 text-center">G</th>
              <th className="py-2 px-1.5 text-center">+/-</th>
              <th className="py-2 pl-1.5 pr-3 text-center font-semibold text-gray-400">Pkt</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700/30">
            {standings.map((team, i) => {
              const pts = team.W * 3 + team.D
              const gd = team.GF - team.GA
              const advancing = i < 2
              const maybe = i === 2

              return (
                <tr
                  key={team.name}
                  className={advancing ? 'bg-green-900/10' : maybe ? 'bg-yellow-900/10' : ''}
                >
                  <td className="py-2.5 pl-3 pr-1">
                    <div className="flex items-center gap-1">
                      <span className={`font-bold ${advancing ? 'text-green-400' : maybe ? 'text-yellow-400' : 'text-gray-500'}`}>
                        {i + 1}
                      </span>
                      {(advancing || maybe) && (
                        <span className={`w-0.5 h-3.5 rounded-full ${advancing ? 'bg-green-500' : 'bg-yellow-500'}`} />
                      )}
                    </div>
                  </td>
                  <td className="py-2.5 px-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {team.logo && <img src={team.logo} className="w-4 h-4 object-contain shrink-0" alt="" />}
                      <span className="text-white font-medium truncate">{team.name}</span>
                    </div>
                  </td>
                  <td className="py-2.5 px-1.5 text-center text-gray-400">{team.P}</td>
                  <td className="py-2.5 px-1.5 text-center text-gray-400">{team.W}</td>
                  <td className="py-2.5 px-1.5 text-center text-gray-400">{team.D}</td>
                  <td className="py-2.5 px-1.5 text-center text-gray-400">{team.L}</td>
                  <td className="py-2.5 px-1.5 text-center text-gray-400 whitespace-nowrap">{team.GF}:{team.GA}</td>
                  <td className="py-2.5 px-1.5 text-center text-gray-400">
                    {gd > 0 ? `+${gd}` : gd}
                  </td>
                  <td className="py-2.5 pl-1.5 pr-3 text-center font-bold text-white">{pts}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="px-3 py-2 border-t border-gray-700/50 flex gap-4 text-xs text-gray-500">
        <div className="flex items-center gap-1.5">
          <span className="w-0.5 h-3 rounded-full bg-green-500" />
          <span>Awansuje</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-0.5 h-3 rounded-full bg-yellow-500" />
          <span>Potencjalny awans (8 najlepszych 3. miejsc)</span>
        </div>
      </div>
    </div>
  )
}

const KNOCKOUT_ORDER = ['ROUND_OF_16', 'QUARTER_FINALS', 'SEMI_FINALS', 'THIRD_PLACE', 'FINAL']

export default function WorldCup() {
  const [tab, setTab] = useState('matches')
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

  if (isLoading) return <PageLoader />

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
    <div className="max-w-2xl mx-auto px-4">
      <div className="sticky top-0 z-10 bg-gray-900 pt-4 pb-3 space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">🌍</span>
          <h1 className="text-lg font-bold text-white">FIFA World Cup 2026</h1>
        </div>

        <div className="flex gap-1 bg-gray-800 p-1 rounded-xl">
          <button
            onClick={() => setTab('matches')}
            className={`flex-1 py-2 text-sm font-semibold rounded-lg transition ${tab === 'matches' ? 'bg-brand-600 text-white' : 'text-gray-400 hover:text-gray-200'}`}
          >
            Mecze
          </button>
          <button
            onClick={() => setTab('group_stage')}
            className={`flex-1 py-2 text-sm font-semibold rounded-lg transition ${tab === 'group_stage' ? 'bg-brand-600 text-white' : 'text-gray-400 hover:text-gray-200'}`}
          >
            Faza grupowa
          </button>
          <button
            onClick={() => setTab('knockout')}
            className={`flex-1 py-2 text-sm font-semibold rounded-lg transition ${tab === 'knockout' ? 'bg-brand-600 text-white' : 'text-gray-400 hover:text-gray-200'}`}
          >
            Faza pucharowa
          </button>
        </div>
      </div>

      <div className="space-y-3 pb-4">

      {tab === 'matches' && (
        <div className="space-y-3">
          {hasGroups
            ? Object.entries(groups).sort(([a], [b]) => a.localeCompare(b)).map(([name, matches]) => (
                <GroupCard key={name} name={name} matches={matches} predMap={predMap} />
              ))
            : <p className="text-center text-gray-500 py-8 text-sm">Brak meczów grupowych</p>
          }
        </div>
      )}

      {tab === 'group_stage' && (
        <div className="space-y-3">
          {hasGroups
            ? Object.entries(groups).sort(([a], [b]) => a.localeCompare(b)).map(([name, matches]) => (
                <GroupTable key={name} name={name} matches={matches} />
              ))
            : <p className="text-center text-gray-500 py-8 text-sm">Brak danych grupowych</p>
          }
          <p className="text-center text-xs text-gray-600 pb-2">
            Format: 12 grup × 4 drużyny — awansują 2 pierwsze z każdej grupy + 8 najlepszych 3. miejsc
          </p>
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
    </div>
  )
}
