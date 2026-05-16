import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { myLeagues, createLeague, joinLeague, leaveLeague, getLeagueRanking } from '../api/leagues'

const MEDAL = ['🥇', '🥈', '🥉']

function LeagueRankingModal({ league, onClose }) {
  const { data } = useQuery({
    queryKey: ['league-ranking', league.id],
    queryFn: () => getLeagueRanking(league.id),
  })
  const entries = data?.entries ?? []

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4" onClick={onClose}>
      <div className="bg-gray-900 rounded-2xl p-6 w-full max-w-md space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold">{league.name}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white">✕</button>
        </div>
        <p className="text-xs text-gray-500">Kod zaproszenia: <span className="font-mono text-brand-400">{league.invite_code}</span></p>
        <div className="space-y-2">
          {entries.map(entry => (
            <div key={entry.user_id} className="flex items-center gap-3 bg-gray-800 rounded-xl px-3 py-2">
              <span className="w-6 text-center">{MEDAL[entry.rank - 1] ?? `#${entry.rank}`}</span>
              <span className="flex-1 font-medium">{entry.username}</span>
              <span className="font-bold text-brand-400">{entry.total_points} pkt</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function Leagues() {
  const qc = useQueryClient()
  const [newName, setNewName] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [selected, setSelected] = useState(null)
  const [error, setError] = useState('')

  const { data } = useQuery({ queryKey: ['my-leagues'], queryFn: myLeagues })
  const leagues = data ?? []

  const createMut = useMutation({
    mutationFn: () => createLeague({ name: newName }),
    onSuccess: () => { setNewName(''); qc.invalidateQueries(['my-leagues']) },
    onError: (e) => setError(e.response?.data?.detail || 'Błąd tworzenia ligi'),
  })

  const joinMut = useMutation({
    mutationFn: () => joinLeague({ invite_code: joinCode }),
    onSuccess: () => { setJoinCode(''); qc.invalidateQueries(['my-leagues']) },
    onError: (e) => setError(e.response?.data?.detail || 'Nieprawidłowy kod'),
  })

  const leaveMut = useMutation({
    mutationFn: (id) => leaveLeague(id),
    onSuccess: () => qc.invalidateQueries(['my-leagues']),
  })

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <h2 className="text-xl font-bold">Moje ligi</h2>

      {error && <p className="text-red-400 text-sm bg-red-950 rounded-lg px-4 py-2">{error}</p>}

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="bg-gray-900 rounded-2xl p-4 space-y-3">
          <h3 className="font-semibold">Utwórz ligę</h3>
          <input
            placeholder="Nazwa ligi..."
            className="w-full bg-gray-800 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-brand-500 text-sm"
            value={newName}
            onChange={e => setNewName(e.target.value)}
          />
          <button
            onClick={() => createMut.mutate()}
            disabled={!newName.trim() || createMut.isPending}
            className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-40 rounded-lg py-2 text-sm font-semibold transition"
          >
            {createMut.isPending ? '...' : 'Utwórz'}
          </button>
        </div>

        <div className="bg-gray-900 rounded-2xl p-4 space-y-3">
          <h3 className="font-semibold">Dołącz do ligi</h3>
          <input
            placeholder="Kod zaproszenia..."
            className="w-full bg-gray-800 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-brand-500 text-sm font-mono uppercase"
            value={joinCode}
            onChange={e => setJoinCode(e.target.value.toUpperCase())}
          />
          <button
            onClick={() => joinMut.mutate()}
            disabled={!joinCode.trim() || joinMut.isPending}
            className="w-full bg-green-700 hover:bg-green-600 disabled:opacity-40 rounded-lg py-2 text-sm font-semibold transition"
          >
            {joinMut.isPending ? '...' : 'Dołącz'}
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {leagues.length === 0 && (
          <p className="text-gray-500 text-center py-8">Nie należysz do żadnej ligi</p>
        )}
        {leagues.map(league => (
          <div key={league.id} className="bg-gray-900 rounded-2xl px-4 py-3 flex items-center gap-3">
            <div className="flex-1">
              <p className="font-semibold">{league.name}</p>
              <p className="text-xs text-gray-500">{league.members_count} uczestników · kod: <span className="font-mono text-brand-400">{league.invite_code}</span></p>
            </div>
            <button
              onClick={() => setSelected(league)}
              className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm transition"
            >
              Ranking
            </button>
            <button
              onClick={() => leaveMut.mutate(league.id)}
              className="px-3 py-1.5 bg-red-900 hover:bg-red-800 rounded-lg text-sm transition"
            >
              Opuść
            </button>
          </div>
        ))}
      </div>

      {selected && <LeagueRankingModal league={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
