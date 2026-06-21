import { useState, useEffect, Fragment } from 'react'
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
  LAST_32: '1/16 finału',
  LAST_16: '1/8 finału',
  ROUND_OF_16: '1/8 finału',
  QUARTER_FINALS: 'Ćwierćfinały',
  SEMI_FINALS: 'Półfinały',
  THIRD_PLACE: 'Mecz o 3. miejsce',
  THIRD_PLACE_FINAL: 'Mecz o 3. miejsce',
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

const KNOCKOUT_ORDER = ['LAST_32', 'ROUND_OF_16', 'LAST_16', 'QUARTER_FINALS', 'SEMI_FINALS', 'THIRD_PLACE', 'THIRD_PLACE_FINAL', 'FINAL']

// --- Bracket (Drzewko) ---

const CARD_W = 148
const ROUND_GAP = 20
const BASE_H = 76  // card height: 26 home + 1 divider + 26 away + 1 divider + 22 date
const SLOT = BASE_H + 4  // vertical space per R1 match (card + gap)
const BRACKET_MAIN = ['LAST_32', 'LAST_16', 'ROUND_OF_16', 'QUARTER_FINALS', 'SEMI_FINALS', 'FINAL']

function bracketTop(roundIdx, matchIdx) {
  const span = 1 << roundIdx  // 2^roundIdx
  return SLOT * (matchIdx * span + (span - 1) / 2)
}

function BracketCard({ match }) {
  if (!match) {
    return (
      <div className="rounded-lg border border-gray-700/30 bg-gray-800/20 flex flex-col justify-around items-center" style={{ height: BASE_H }}>
        <div className="h-px w-10 bg-gray-700/50 rounded" />
        <div className="h-px w-10 bg-gray-700/50 rounded" />
      </div>
    )
  }

  const isLive = match.status === 'live'
  const isPlayed = match.status === 'finished' || isLive
  const hs = match.home_score
  const as_ = match.away_score
  const homeWins = isPlayed && hs != null && as_ != null && hs > as_
  const awayWins = isPlayed && hs != null && as_ != null && as_ > hs
  const homeTbd = !match.home_team || match.home_team === 'TBD'
  const awayTbd = !match.away_team || match.away_team === 'TBD'
  const dateStr = formatInTimeZone(new Date(match.kickoff + 'Z'), 'Europe/Warsaw', 'd MMM · HH:mm', { locale: pl })

  return (
    <div
      className={`rounded-lg border overflow-hidden bg-gray-800 ${isLive ? 'border-red-500/60' : 'border-gray-700'}`}
      style={{ height: BASE_H }}
    >
      {/* Home team */}
      <div className={`flex items-center gap-1 px-2 ${homeWins ? 'bg-white/5' : ''}`} style={{ height: 26 }}>
        {!homeTbd && match.home_team_logo
          ? <img src={match.home_team_logo} className="w-3.5 h-3.5 object-contain shrink-0" alt="" />
          : <div className="w-3.5 shrink-0" />
        }
        <span className={`text-xs flex-1 truncate min-w-0 ${homeTbd ? 'text-gray-600 italic' : homeWins ? 'text-white font-bold' : 'text-gray-300'}`}>
          {match.home_team || 'TBD'}
        </span>
        {isPlayed && hs != null && (
          <span className={`text-xs font-bold ml-1 shrink-0 ${homeWins ? 'text-white' : 'text-gray-500'}`}>{hs}</span>
        )}
      </div>
      <div className={`h-px ${isLive ? 'bg-red-500/30' : 'bg-gray-700/40'}`} />
      {/* Away team */}
      <div className={`flex items-center gap-1 px-2 ${awayWins ? 'bg-white/5' : ''}`} style={{ height: 26 }}>
        {!awayTbd && match.away_team_logo
          ? <img src={match.away_team_logo} className="w-3.5 h-3.5 object-contain shrink-0" alt="" />
          : <div className="w-3.5 shrink-0" />
        }
        <span className={`text-xs flex-1 truncate min-w-0 ${awayTbd ? 'text-gray-600 italic' : awayWins ? 'text-white font-bold' : 'text-gray-300'}`}>
          {match.away_team || 'TBD'}
        </span>
        {isPlayed && as_ != null && (
          <span className={`text-xs font-bold ml-1 shrink-0 ${awayWins ? 'text-white' : 'text-gray-500'}`}>{as_}</span>
        )}
      </div>
      <div className={`h-px ${isLive ? 'bg-red-500/30' : 'bg-gray-700/40'}`} />
      {/* Date / LIVE */}
      <div className="flex items-center justify-center" style={{ height: 22 }}>
        {isLive
          ? <span className="text-xs text-red-400 font-bold animate-pulse">● LIVE</span>
          : <span className="text-xs text-gray-600">{dateStr}</span>
        }
      </div>
    </div>
  )
}

function KnockoutBracket({ knockout }) {
  const stages = BRACKET_MAIN
    .filter(s => knockout[s]?.length > 0)
    .map(s => ({
      key: s,
      label: STAGE_LABELS[s] || s,
      matches: [...knockout[s]].sort((a, b) => new Date(a.kickoff) - new Date(b.kickoff)),
    }))

  const thirdPlace = [
    ...(knockout['THIRD_PLACE'] || []),
    ...(knockout['THIRD_PLACE_FINAL'] || []),
  ].sort((a, b) => new Date(a.kickoff) - new Date(b.kickoff))

  if (stages.length === 0) {
    return (
      <p className="text-center text-gray-500 py-12 text-sm">
        Brak danych fazy pucharowej — mecze zostaną dodane po zakończeniu fazy grupowej.
      </p>
    )
  }

  const firstCount = stages[0].matches.length
  const totalH = firstCount * SLOT - 4
  const HEADER = 28
  const totalW = stages.length * (CARD_W + ROUND_GAP) - ROUND_GAP
  const CONN = '#374151'

  // Mecz o 3. miejsce — pod finałem, w ostatniej kolumnie, bez kresek łączących
  const finalRi = stages.length - 1
  const finalLeft = finalRi * (CARD_W + ROUND_GAP)
  const finalBottom = HEADER + bracketTop(finalRi, 0) + BASE_H
  const thirdLabelTop = finalBottom + 28
  const thirdCardTop = thirdLabelTop + 20
  const containerH = thirdPlace.length > 0
    ? Math.max(totalH + HEADER, thirdCardTop + BASE_H)
    : totalH + HEADER

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto scrollbar-thin">
        <div style={{ position: 'relative', height: containerH, width: totalW, minWidth: totalW }}>
          {stages.map((stage, ri) => {
            const colLeft = ri * (CARD_W + ROUND_GAP)
            const expectedCount = Math.ceil(firstCount / (1 << ri))
            // Pad with nulls so alignment stays correct even if API is missing matches
            const matches = [...stage.matches]
            while (matches.length < expectedCount) matches.push(null)

            return (
              <Fragment key={stage.key}>
                {/* Column label */}
                <div
                  className="text-xs font-bold text-brand-400 text-center truncate"
                  style={{ position: 'absolute', left: colLeft, top: 0, width: CARD_W, lineHeight: `${HEADER - 6}px` }}
                >
                  {stage.label}
                </div>

                {/* Match cards */}
                {matches.map((m, mi) => (
                  <div
                    key={mi}
                    style={{ position: 'absolute', left: colLeft, top: HEADER + bracketTop(ri, mi), width: CARD_W }}
                  >
                    <BracketCard match={m} />
                  </div>
                ))}

                {/* Connectors to the next round */}
                {ri < stages.length - 1 && matches.map((_, mi) => {
                  if (mi % 2 !== 0) return null
                  const c1 = HEADER + bracketTop(ri, mi) + BASE_H / 2
                  const c2 = HEADER + bracketTop(ri, mi + 1) + BASE_H / 2
                  const cNext = HEADER + bracketTop(ri + 1, Math.floor(mi / 2)) + BASE_H / 2
                  const x0 = colLeft + CARD_W
                  const xMid = x0 + ROUND_GAP / 2
                  const x1 = x0 + ROUND_GAP

                  return (
                    <Fragment key={`c${mi}`}>
                      <div style={{ position: 'absolute', left: x0, top: c1 - 0.5, width: xMid - x0, height: 1, background: CONN }} />
                      <div style={{ position: 'absolute', left: x0, top: c2 - 0.5, width: xMid - x0, height: 1, background: CONN }} />
                      <div style={{ position: 'absolute', left: xMid - 0.5, top: Math.min(c1, c2), width: 1, height: Math.abs(c2 - c1), background: CONN }} />
                      <div style={{ position: 'absolute', left: xMid, top: cNext - 0.5, width: x1 - xMid, height: 1, background: CONN }} />
                    </Fragment>
                  )
                })}
              </Fragment>
            )
          })}

          {/* Mecz o 3. miejsce — pod finałem, bez kresek łączących */}
          {thirdPlace.length > 0 && (
            <Fragment>
              <div
                className="text-xs font-bold text-brand-400 text-center truncate"
                style={{ position: 'absolute', left: finalLeft, top: thirdLabelTop, width: CARD_W, lineHeight: '14px' }}
              >
                Mecz o 3. miejsce
              </div>
              <div style={{ position: 'absolute', left: finalLeft, top: thirdCardTop, width: CARD_W }}>
                <BracketCard match={thirdPlace[0]} />
              </div>
            </Fragment>
          )}
        </div>
      </div>

    </div>
  )
}

// --- Main component ---

const TABS = [
  { key: 'matches',      label: 'Faza grupowa' },
  { key: 'group_stage',  label: 'Tabele grup' },
  { key: 'knockout',     label: 'Faza pucharowa' },
  { key: 'bracket',      label: 'Drzewko' },
]

export default function WorldCup() {
  const [tab, setTab] = useState('matches')
  const { user } = useAuth()

  useEffect(() => {
    document.querySelector('main')?.scrollTo({ top: 0 })
  }, [tab])

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
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition ${tab === key ? 'bg-brand-600 text-white' : 'text-gray-400 hover:text-gray-200'}`}
            >
              {label}
            </button>
          ))}
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
              ? [
                  ...KNOCKOUT_ORDER.filter(s => knockout[s]),
                  ...Object.keys(knockout).filter(s => !KNOCKOUT_ORDER.includes(s)),
                ].map(stage => (
                  <KnockoutSection key={stage} stage={stage} matches={knockout[stage]} predMap={predMap} />
                ))
              : <p className="text-center text-gray-500 py-8 text-sm">Brak meczów fazy pucharowej</p>
            }
          </div>
        )}

        {tab === 'bracket' && (
          <KnockoutBracket knockout={knockout} />
        )}

      </div>
    </div>
  )
}
