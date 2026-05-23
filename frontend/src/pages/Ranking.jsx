import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import PageLoader from '../components/PageLoader'
import api from '../api/client'

const MEDAL = ['🥇', '🥈', '🥉']

export default function Ranking() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [selectedLeagueId, setSelectedLeagueId] = useState(null)

  const { data: myLeagues } = useQuery({
    queryKey: ['my-leagues'],
    queryFn: () => api.get('/leagues/me').then(r => r.data),
  })

  const { data: allLeagues } = useQuery({
    queryKey: ['admin-leagues'],
    queryFn: () => api.get('/admin/leagues').then(r => r.data),
    enabled: !!user?.is_admin,
  })

  const myLeague = myLeagues?.[0]

  useEffect(() => {
    if (!selectedLeagueId && myLeague) setSelectedLeagueId(myLeague.id)
  }, [myLeague])

  const leagueId = selectedLeagueId ?? myLeague?.id

  const { data, isLoading } = useQuery({
    queryKey: ['league-ranking', leagueId],
    queryFn: () => {
      if (user?.is_admin) return api.get(`/admin/leagues/${leagueId}/ranking`).then(r => r.data)
      return api.get(`/leagues/${leagueId}/ranking`).then(r => r.data)
    },
    enabled: !!leagueId,
  })

  const entries = data?.entries ?? []
  const tabs = user?.is_admin ? (allLeagues ?? []) : []

  if (!leagueId && myLeagues !== undefined) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-6">
        <h2 className="text-xl font-bold mb-4">Ranking</h2>
        <div className="text-gray-500 text-center py-12">Nie jesteś przypisany do żadnej ligi</div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
      <h2 className="text-xl font-bold">Ranking</h2>

      {tabs.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {tabs.map(l => (
            <button
              key={l.id}
              onClick={() => setSelectedLeagueId(l.id)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-mono font-medium transition ${selectedLeagueId === l.id ? 'bg-brand-500 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
            >
              {l.invite_code}
            </button>
          ))}
        </div>
      )}

      {isLoading && <PageLoader />}

      {!isLoading && entries.length === 0 && (
        <div className="text-gray-500 text-center py-12">Brak danych rankingowych</div>
      )}

      <div className="space-y-2">
        {entries.map((entry) => {
          const isMe = user?.id === entry.user_id
          return (
            <div key={entry.user_id} className={`bg-gray-900 rounded-xl overflow-hidden ${isMe ? 'ring-2 ring-brand-500' : ''}`}>
              <button
                onClick={() => navigate(`/user/${entry.user_id}`)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-800/50 transition text-left"
              >
                <span className="w-8 text-center font-bold text-lg shrink-0">
                  {MEDAL[entry.rank - 1] ?? `#${entry.rank}`}
                </span>

                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-700 shrink-0 flex items-center justify-center">
                    {entry.avatar
                      ? <img src={entry.avatar} className="w-full h-full object-cover" alt="" />
                      : <span className="text-xs font-bold text-gray-400">{entry.username.slice(0, 2).toUpperCase()}</span>
                    }
                  </div>
                  <span className={`font-semibold ${isMe ? 'text-brand-400' : ''}`}>
                    {entry.username} {isMe && <span className="text-xs text-gray-400">(Ty)</span>}
                  </span>
                </div>

                <div className="hidden sm:block text-right text-sm text-gray-400 shrink-0">
                  <span>{entry.exact_hits}⭐ {entry.outcome_hits}✅</span>
                </div>

                <div className="text-right shrink-0">
                  <div className="font-bold text-lg leading-tight text-brand-400">{entry.total_points} pkt</div>
                </div>
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
