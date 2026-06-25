import { useState, useEffect, useRef, Fragment } from 'react'
import { useQuery } from '@tanstack/react-query'
import { formatInTimeZone } from 'date-fns-tz'
import { pl } from 'date-fns/locale'
import api from '../api/client'
import { myPredictions } from '../api/predictions'
import { useAuth } from '../context/AuthContext'
import PageLoader from '../components/PageLoader'
import { R32, R16, QF, SF, FINAL, THIRD_PLACE, THIRD_PLACE_MAP, THIRD_WINNERS } from '../data/wc2026Bracket'

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

function bracketTop(roundIdx, matchIdx) {
  const span = 1 << roundIdx  // 2^roundIdx
  return SLOT * (matchIdx * span + (span - 1) / 2)
}

// Sortowanie pomocnicze dla rankingu drużyn (pkt → różnica bramek → bramki)
function cmpTeam(a, b) {
  const pa = a.W * 3 + a.D
  const pb = b.W * 3 + b.D
  if (pb !== pa) return pb - pa
  const gda = a.GF - a.GA
  const gdb = b.GF - b.GA
  if (gdb !== gda) return gdb - gda
  return b.GF - a.GF
}

// Pewność pozycji w grupie — zwraca nazwy drużyn pewnych 1. i 2. miejsca (lub null).
// Gdy nie ma już żadnych aktywnych meczów (scheduled/live), tabela jest ostateczna
// i korzystamy bezpośrednio z computeStandings (uwzględnia też różnicę bramek).
// Dla grup w toku używamy logiki dominacji punktowej.
function computeCertainty(matches) {
  const activeStatuses = new Set(['scheduled', 'live'])
  if (matches.length > 0 && !matches.some(m => activeStatuses.has(m.status))) {
    const s = computeStandings(matches)
    return { winner: s[0]?.name ?? null, runner: s[1]?.name ?? null }
  }

  const teams = {}
  const ensure = n => { if (!teams[n]) teams[n] = { name: n, pts: 0, rem: 0 } }
  for (const m of matches) {
    ensure(m.home_team); ensure(m.away_team)
    if (m.status === 'finished' && m.home_score != null && m.away_score != null) {
      const hs = +m.home_score, as_ = +m.away_score
      if (hs > as_) teams[m.home_team].pts += 3
      else if (hs < as_) teams[m.away_team].pts += 3
      else { teams[m.home_team].pts += 1; teams[m.away_team].pts += 1 }
    } else if (m.status === 'scheduled' || m.status === 'live') {
      // tylko aktywne mecze generują jeszcze potencjalne punkty
      teams[m.home_team].rem += 1
      teams[m.away_team].rem += 1
    }
  }
  const arr = Object.values(teams)
  // A na pewno kończy nad B (po samych punktach, najgorszy wariant A vs najlepszy B)
  const dominates = (A, B) => A.pts > B.pts + 3 * B.rem
  let winner = null, runner = null
  for (const T of arr) {
    const others = arr.filter(x => x !== T)
    if (others.length && others.every(U => dominates(T, U))) winner = T.name
    const above = others.filter(U => dominates(U, T)).length
    const below = others.filter(U => dominates(T, U)).length
    if (others.length === 3 && above === 1 && below === 2) runner = T.name
  }
  return { winner, runner }
}

// Projekcja: na podstawie aktualnych tabel grup wylicza, kto powinien trafić
// do którego slotu fazy pucharowej (1. i 2. miejsca + 8 najlepszych z 3. miejsc).
function buildProjection(groups) {
  const standings = {}
  const certainty = {}
  for (const [name, matches] of Object.entries(groups)) {
    standings[name] = computeStandings(matches)
    certainty[name] = computeCertainty(matches)
  }
  const letters = Object.keys(standings)

  // Ranking 3. miejsc — 8 najlepszych awansuje
  const thirds = letters
    .map(l => ({ l, team: standings[l]?.[2] }))
    .filter(x => x.team)
    .sort((a, b) => cmpTeam(a.team, b.team))
  const top8 = thirds.slice(0, 8).map(x => x.l).sort()
  const key = top8.join('')
  const assign = THIRD_PLACE_MAP[key]  // 8 znaków w kolejności THIRD_WINNERS
  const thirdForWinner = {}
  if (assign) {
    THIRD_WINNERS.forEach((w, i) => { thirdForWinner[w] = assign[i] })
  }

  return {
    winner: l => standings[l]?.[0],
    runner: l => standings[l]?.[1],
    thirdOf: l => standings[l]?.[2],
    thirdForWinner,
    certainty,
  }
}

// Slot: 'WX' = zwycięzca grupy X, 'RX' = wicelider grupy X,
// 'TX' = 3. miejsce przypisane do zwycięzcy grupy X.
// Zwraca { team, locked } — locked=true gdy pozycja jest już matematycznie pewna.
function resolveSlot(code, proj) {
  if (!code) return null
  const kind = code[0]
  const g = code[1]
  if (kind === 'W') {
    const team = proj.winner(g)
    return { team, locked: !!team && proj.certainty[g]?.winner === team.name }
  }
  if (kind === 'R') {
    const team = proj.runner(g)
    return { team, locked: !!team && proj.certainty[g]?.runner === team.name }
  }
  if (kind === 'T') {
    const tg = proj.thirdForWinner[g]
    return { team: tg ? proj.thirdOf(tg) : null, locked: false }
  }
  return null
}

// Dopasowanie meczów z API do pozycji w drabince po czasie rozpoczęcia (najbliższy).
function alignApi(apiList, positions) {
  const used = new Set()
  return positions.map(pos => {
    const target = new Date(pos.dt).getTime()
    let best = null, bestD = Infinity, bestI = -1
    apiList.forEach((m, i) => {
      if (used.has(i)) return
      const t = new Date(m.kickoff + 'Z').getTime()
      const d = Math.abs(t - target)
      if (d < bestD) { bestD = d; best = m; bestI = i }
    })
    if (best && bestD < 12 * 3600 * 1000) { used.add(bestI); return best }
    return null
  })
}

// Wybiera drużynę dla slotu: potwierdzona z API ma priorytet i jest "lepka"
// (raz potwierdzony slot nie wraca do prognozy, nawet jeśli API chwilowo zwróci TBD —
// football-data.org potrafi przejściowo cofnąć przypisaną drużynę przy synchronizacji).
function teamCell(key, apiName, apiLogo, slotCode, proj, store) {
  if (apiName && apiName !== 'TBD') {
    const t = { name: apiName, logo: apiLogo, status: 'confirmed' }
    store[key] = t
    return t
  }
  if (store[key]) return store[key]
  const r = resolveSlot(slotCode, proj)
  if (!r || !r.team) return { name: null, logo: null, status: 'tbd' }
  // locked = pozycja w grupie już matematycznie pewna → traktujemy jak potwierdzoną (zielona)
  return { name: r.team.name, logo: r.team.logo, status: r.locked ? 'confirmed' : 'projected' }
}

// Buduje znormalizowaną kartę: dane drużyn (z API gdy potwierdzone, inaczej z projekcji)
// + wynik/status z meczu API jeśli istnieje.
function buildCard(api, pos, proj, store) {
  const home = teamCell(pos.no + 'H', api?.home_team, api?.home_team_logo, pos.home, proj, store)
  const away = teamCell(pos.no + 'A', api?.away_team, api?.away_team_logo, pos.away, proj, store)
  const isLive = api?.status === 'live'
  const isFinished = api?.status === 'finished'
  const kickoff = api ? new Date(api.kickoff + 'Z') : (pos.dt ? new Date(pos.dt) : null)
  return {
    home, away, isLive, isFinished, kickoff,
    homeScore: api?.home_score ?? null,
    awayScore: api?.away_score ?? null,
  }
}

const GLOW = {
  confirmed: 'inset 0 0 0 1px rgba(34,197,94,.55), inset 0 0 9px rgba(34,197,94,.28)',
  projected: 'inset 0 0 0 1px rgba(234,179,8,.55), inset 0 0 9px rgba(234,179,8,.24)',
  tbd: 'none',
}

function TeamLine({ team, score, isPlayed, wins }) {
  const tbd = team.status === 'tbd' || !team.name
  return (
    <div
      className={`flex items-center gap-1 px-2 ${wins ? 'bg-white/5' : ''}`}
      style={{ height: 26, boxShadow: GLOW[team.status] }}
    >
      {!tbd && team.logo
        ? <img src={team.logo} className="w-3.5 h-3.5 object-contain shrink-0" alt="" />
        : <div className="w-3.5 shrink-0" />
      }
      <span className={`text-xs flex-1 truncate min-w-0 ${tbd ? 'text-gray-600 italic' : wins ? 'text-white font-bold' : 'text-gray-300'}`}>
        {team.name || 'TBD'}
      </span>
      {isPlayed && score != null && (
        <span className={`text-xs font-bold ml-1 shrink-0 ${wins ? 'text-white' : 'text-gray-500'}`}>{score}</span>
      )}
    </div>
  )
}

function BracketCard({ card }) {
  if (!card) {
    return (
      <div className="rounded-lg border border-gray-700/30 bg-gray-800/20 flex flex-col justify-around items-center" style={{ height: BASE_H }}>
        <div className="h-px w-10 bg-gray-700/50 rounded" />
        <div className="h-px w-10 bg-gray-700/50 rounded" />
      </div>
    )
  }

  const isPlayed = card.isFinished || card.isLive
  const hs = card.homeScore
  const as_ = card.awayScore
  const homeWins = isPlayed && hs != null && as_ != null && hs > as_
  const awayWins = isPlayed && hs != null && as_ != null && as_ > hs
  const dateStr = card.kickoff
    ? formatInTimeZone(card.kickoff, 'Europe/Warsaw', 'd MMM · HH:mm', { locale: pl })
    : ''

  return (
    <div
      className={`rounded-lg border overflow-hidden bg-gray-800 ${card.isLive ? 'border-red-500/60' : 'border-gray-700'}`}
      style={{ height: BASE_H }}
    >
      <TeamLine team={card.home} score={hs} isPlayed={isPlayed} wins={homeWins} />
      <div className={`h-px ${card.isLive ? 'bg-red-500/30' : 'bg-gray-700/40'}`} />
      <TeamLine team={card.away} score={as_} isPlayed={isPlayed} wins={awayWins} />
      <div className={`h-px ${card.isLive ? 'bg-red-500/30' : 'bg-gray-700/40'}`} />
      <div className="flex items-center justify-center" style={{ height: 22 }}>
        {card.isLive
          ? <span className="text-xs text-red-400 font-bold animate-pulse">● LIVE</span>
          : <span className="text-xs text-gray-600">{dateStr}</span>
        }
      </div>
    </div>
  )
}

const BRACKET_ROUNDS = [
  { key: 'LAST_32', label: '1/16 finału', positions: R32 },
  { key: 'LAST_16', label: '1/8 finału', positions: R16 },
  { key: 'QUARTER_FINALS', label: 'Ćwierćfinały', positions: QF },
  { key: 'SEMI_FINALS', label: 'Półfinały', positions: SF },
  { key: 'FINAL', label: 'Finał', positions: FINAL },
]

function KnockoutBracket({ knockout, groups }) {
  // Pamięć potwierdzonych slotów — utrzymuje "zielony" status między odświeżeniami
  const confirmedRef = useRef({})

  if (!groups || Object.keys(groups).length === 0) {
    return (
      <p className="text-center text-gray-500 py-12 text-sm">
        Brak danych grup — drabinka pojawi się po dodaniu meczów fazy grupowej.
      </p>
    )
  }

  const store = confirmedRef.current
  const proj = buildProjection(groups)
  const apiByStage = {
    LAST_32: knockout['LAST_32'] || [],
    LAST_16: knockout['LAST_16'] || knockout['ROUND_OF_16'] || [],
    QUARTER_FINALS: knockout['QUARTER_FINALS'] || [],
    SEMI_FINALS: knockout['SEMI_FINALS'] || [],
    FINAL: knockout['FINAL'] || [],
  }

  // Karty dla każdej rundy w kolejności drabinki
  const rounds = BRACKET_ROUNDS.map(r => {
    const aligned = alignApi(apiByStage[r.key], r.positions)
    const cards = r.positions.map((pos, i) =>
      buildCard(aligned[i], pos, proj, store)
    )
    return { ...r, cards }
  })

  const thirdApi = [...(knockout['THIRD_PLACE'] || []), ...(knockout['THIRD_PLACE_FINAL'] || [])]
  const thirdCard = buildCard(thirdApi[0], THIRD_PLACE, proj, store)

  const firstCount = rounds[0].cards.length
  const totalH = firstCount * SLOT - 4
  const HEADER = 28
  const totalW = rounds.length * (CARD_W + ROUND_GAP) - ROUND_GAP
  const CONN = '#374151'

  // Mecz o 3. miejsce — pod finałem, w ostatniej kolumnie, bez kresek łączących
  const finalRi = rounds.length - 1
  const finalLeft = finalRi * (CARD_W + ROUND_GAP)
  const finalBottom = HEADER + bracketTop(finalRi, 0) + BASE_H
  const thirdLabelTop = finalBottom + 28
  const thirdCardTop = thirdLabelTop + 20
  const containerH = Math.max(totalH + HEADER, thirdCardTop + BASE_H)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-center gap-4 text-xs text-gray-500">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full" style={{ boxShadow: '0 0 5px rgba(34,197,94,.7)', background: 'rgba(34,197,94,.7)' }} />
          <span>Potwierdzone</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full" style={{ boxShadow: '0 0 5px rgba(234,179,8,.7)', background: 'rgba(234,179,8,.7)' }} />
          <span>Prognoza wg tabel</span>
        </div>
      </div>

      <div className="overflow-x-auto scrollbar-thin">
        <div style={{ position: 'relative', height: containerH, width: totalW, minWidth: totalW }}>
          {rounds.map((round, ri) => {
            const colLeft = ri * (CARD_W + ROUND_GAP)
            return (
              <Fragment key={round.key}>
                <div
                  className="text-xs font-bold text-brand-400 text-center truncate"
                  style={{ position: 'absolute', left: colLeft, top: 0, width: CARD_W, lineHeight: `${HEADER - 6}px` }}
                >
                  {round.label}
                </div>

                {round.cards.map((card, mi) => (
                  <div
                    key={mi}
                    style={{ position: 'absolute', left: colLeft, top: HEADER + bracketTop(ri, mi), width: CARD_W }}
                  >
                    <BracketCard card={card} />
                  </div>
                ))}

                {ri < rounds.length - 1 && round.cards.map((_, mi) => {
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
          <Fragment>
            <div
              className="text-xs font-bold text-brand-400 text-center truncate"
              style={{ position: 'absolute', left: finalLeft, top: thirdLabelTop, width: CARD_W, lineHeight: '14px' }}
            >
              Mecz o 3. miejsce
            </div>
            <div style={{ position: 'absolute', left: finalLeft, top: thirdCardTop, width: CARD_W }}>
              <BracketCard card={thirdCard} />
            </div>
          </Fragment>
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
          <KnockoutBracket knockout={knockout} groups={groups} />
        )}

      </div>
    </div>
  )
}
