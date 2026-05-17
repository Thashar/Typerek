import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../api/client'

function StatCard({ label, value }) {
  return (
    <div className="bg-gray-800 rounded-xl p-4 text-center">
      <div className="text-2xl font-bold text-brand-400">{value ?? '—'}</div>
      <div className="text-xs text-gray-400 mt-1">{label}</div>
    </div>
  )
}

export default function Admin() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [syncResults, setSyncResults] = useState({})

  const { data: stats } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: () => api.get('/admin/stats').then(r => r.data),
  })

  const { data: users } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => api.get('/admin/users').then(r => r.data),
  })

  const makeOnSuccess = (leagueId) => (data) => {
    setSyncResults(prev => ({ ...prev, [leagueId]: `✓ ${data.synced} meczów` }))
    queryClient.invalidateQueries({ queryKey: ['admin-stats'] })
  }
  const makeOnError = (leagueId) => () =>
    setSyncResults(prev => ({ ...prev, [leagueId]: '✗ błąd' }))

  const syncWC = useMutation({
    mutationFn: () => api.post('/admin/sync/1').then(r => r.data),
    onSuccess: makeOnSuccess(1), onError: makeOnError(1),
  })
  const syncFriendlies = useMutation({
    mutationFn: () => api.post('/admin/sync/10').then(r => r.data),
    onSuccess: makeOnSuccess(10), onError: makeOnError(10),
  })
  const syncEkstra = useMutation({
    mutationFn: () => api.post('/admin/sync/106').then(r => r.data),
    onSuccess: makeOnSuccess(106), onError: makeOnError(106),
  })

  if (!user?.is_admin) {
    navigate('/')
    return null
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <h1 className="text-xl font-bold text-white">Panel admina</h1>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Użytkownicy" value={stats?.users} />
        <StatCard label="Mecze" value={stats?.matches} />
        <StatCard label="Nadchodzące" value={stats?.upcoming_matches} />
        <StatCard label="Typy" value={stats?.predictions} />
      </div>

      <div className="bg-gray-800 rounded-xl p-4 space-y-3">
        <h2 className="font-semibold text-white">Synchronizacja meczów</h2>
        <p className="text-xs text-gray-400">Kliknij każdy przycisk osobno — zaciąga mecze do końca roku.</p>
        <div className="flex flex-col gap-2">
          {[
            { m: syncWC, id: 1, label: '🌍 World Cup 2026' },
            { m: syncFriendlies, id: 10, label: '🤝 International Friendlies' },
            { m: syncEkstra, id: 106, label: '🦅 Ekstraklasa' },
          ].map(({ m, id, label }) => (
            <div key={id} className="flex items-center gap-3">
              <button
                onClick={() => m.mutate()}
                disabled={m.isPending}
                className="bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition min-w-[220px] text-left"
              >
                {m.isPending ? 'Synchronizuję...' : label}
              </button>
              {syncResults[id] && (
                <span className="text-sm text-green-400">{syncResults[id]}</span>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="bg-gray-800 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-700">
          <h2 className="font-semibold text-white">Użytkownicy ({users?.length ?? 0})</h2>
        </div>
        <div className="divide-y divide-gray-700">
          {users?.map(u => (
            <div key={u.id} className="px-4 py-3 flex items-center justify-between">
              <div>
                <span className="font-medium text-white text-sm">{u.username}</span>
                {u.is_admin && <span className="ml-2 text-xs bg-brand-500/20 text-brand-400 px-1.5 py-0.5 rounded">admin</span>}
                <div className="text-xs text-gray-500 mt-0.5">{u.email}</div>
              </div>
              <div className="text-right">
                <div className="text-brand-400 font-bold text-sm">{u.total_points} pkt</div>
                <div className="text-xs text-gray-500">{u.created_at?.slice(0, 10)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
