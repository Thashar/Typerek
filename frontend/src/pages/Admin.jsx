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

const COMPETITIONS = [
  { code: 'WC', label: '🌍 FIFA World Cup 2026' },
  { code: 'CL', label: '🏆 Champions League' },
  { code: 'PL', label: '🏴󠁧󠁢󠁥󠁮󠁧󠁿 Premier League' },
  { code: 'SA', label: '🇮🇹 Serie A' },
  { code: 'PD', label: '🇪🇸 La Liga' },
  { code: 'FL1', label: '🇫🇷 Ligue 1' },
]

export default function Admin() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [syncMsg, setSyncMsg] = useState(null)

  const { data: stats, refetch: refetchStats } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: () => api.get('/admin/stats').then(r => r.data),
  })

  const { data: users } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => api.get('/admin/users').then(r => r.data),
  })

  const syncAll = useMutation({
    mutationFn: () => api.post('/admin/sync-all').then(r => r.data),
    onSuccess: (data) => {
      const lines = Object.entries(data.results).map(([k, v]) => `${k}: ${v}`).join(', ')
      setSyncMsg(`✓ Łącznie ${data.total} meczów (${lines})`)
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] })
      queryClient.invalidateQueries({ queryKey: ['match-dates'] })
      queryClient.invalidateQueries({ queryKey: ['matches'] })
    },
    onError: () => setSyncMsg('✗ Błąd synchronizacji'),
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
        <h2 className="font-semibold text-white">Synchronizacja danych</h2>
        <p className="text-xs text-gray-400">Zaciąga mecze wszystkich lig do końca roku: {COMPETITIONS.map(c => c.code).join(', ')}</p>
        <button
          onClick={() => { setSyncMsg(null); syncAll.mutate() }}
          disabled={syncAll.isPending}
          className="bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white font-semibold px-6 py-2.5 rounded-lg transition"
        >
          {syncAll.isPending ? '⏳ Synchronizuję...' : '🔄 Synchronizuj wszystkie dane'}
        </button>
        {syncMsg && <p className="text-sm text-green-400">{syncMsg}</p>}
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
