import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../api/client'
import { getSettings, updateSettings } from '../api/settings'

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

function UserRow({ u, currentUserId, onDeleted }) {
  const [confirm, setConfirm] = useState(false)
  const [err, setErr] = useState('')
  const deleteMut = useMutation({
    mutationFn: () => api.delete(`/admin/users/${u.id}`),
    onSuccess: () => { setConfirm(false); onDeleted() },
    onError: (e) => setErr(e.response?.data?.detail || 'Błąd usuwania'),
  })
  const canDelete = !u.is_admin && u.id !== currentUserId

  return (
    <div className="px-4 py-3 flex items-center justify-between gap-3">
      <div className="flex-1 min-w-0">
        <span className="font-medium text-white text-sm">{u.username}</span>
        {u.is_admin && <span className="ml-2 text-xs bg-brand-500/20 text-brand-400 px-1.5 py-0.5 rounded">admin</span>}
        {u.is_ranked
          ? <span className="ml-1 text-xs bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded">zweryfikowany</span>
          : <span className="ml-1 text-xs bg-gray-700 text-gray-500 px-1.5 py-0.5 rounded">niezweryfikowany</span>
        }
        <div className="text-xs text-gray-500 mt-0.5 truncate">{u.email}</div>
      </div>
      <div className="text-right shrink-0">
        <div className="text-brand-400 font-bold text-sm">{u.total_points} pkt</div>
        <div className="text-xs text-gray-500">{u.created_at?.slice(0, 10)}</div>
      </div>
      {canDelete && (
        <>
          {confirm ? (
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => deleteMut.mutate()}
                disabled={deleteMut.isPending}
                className="text-xs bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white px-2 py-1 rounded transition"
              >
                {deleteMut.isPending ? '...' : 'Tak'}
              </button>
              <button onClick={() => setConfirm(false)} className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 px-2 py-1 rounded transition">
                Nie
              </button>
            </div>
          ) : (
            <button
              onClick={() => { setErr(''); setConfirm(true) }}
              className="text-gray-600 hover:text-red-400 transition text-lg leading-none shrink-0"
              title="Usuń użytkownika"
            >
              ×
            </button>
          )}
          {err && <span className="text-xs text-red-400">{err}</span>}
        </>
      )}
    </div>
  )
}

export default function Admin() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [syncMsg, setSyncMsg] = useState(null)
  const [settingsMsg, setSettingsMsg] = useState(null)

  const { data: inviteCodes, refetch: refetchCodes } = useQuery({
    queryKey: ['invite-codes'],
    queryFn: () => api.get('/admin/invite-codes').then(r => r.data),
  })

  const generateCode = useMutation({
    mutationFn: () => api.post('/admin/invite-codes').then(r => r.data),
    onSuccess: () => refetchCodes(),
  })

  const deleteCode = useMutation({
    mutationFn: (code) => api.delete(`/admin/invite-codes/${code}`).then(r => r.data),
    onSuccess: () => refetchCodes(),
  })

  const { data: stats, refetch: refetchStats } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: () => api.get('/admin/stats').then(r => r.data),
  })

  const { data: gameSettings } = useQuery({
    queryKey: ['game-settings'],
    queryFn: getSettings,
  })
  const [pointsExact, setPointsExact] = useState('')
  const [pointsOutcome, setPointsOutcome] = useState('')

  const saveSettings = useMutation({
    mutationFn: () => updateSettings({
      points_exact: parseInt(pointsExact),
      points_outcome: parseInt(pointsOutcome),
    }),
    onSuccess: (data) => {
      setSettingsMsg(`✓ Zapisano: dokładny=${data.points_exact} pkt, wynik=${data.points_outcome} pkt`)
      queryClient.invalidateQueries({ queryKey: ['game-settings'] })
    },
    onError: () => setSettingsMsg('✗ Błąd zapisu'),
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

      <div className="bg-gray-800 rounded-xl p-4 space-y-3">
        <h2 className="font-semibold text-white">Punktacja</h2>
        <p className="text-xs text-gray-400">Aktualne: dokładny wynik = <span className="text-brand-400 font-bold">{gameSettings?.points_exact ?? 5} pkt</span>, dobry wynik = <span className="text-brand-400 font-bold">{gameSettings?.points_outcome ?? 2} pkt</span></p>
        <div className="flex items-center gap-3 flex-wrap">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Za dokładny typ</label>
            <input
              type="number" min="1" max="100"
              value={pointsExact || gameSettings?.points_exact || 5}
              onChange={e => setPointsExact(e.target.value)}
              className="w-20 text-center bg-gray-700 rounded-lg px-2 py-1.5 font-bold outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Za dobry wynik</label>
            <input
              type="number" min="0" max="100"
              value={pointsOutcome || gameSettings?.points_outcome || 2}
              onChange={e => setPointsOutcome(e.target.value)}
              className="w-20 text-center bg-gray-700 rounded-lg px-2 py-1.5 font-bold outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <button
            onClick={() => { setSettingsMsg(null); saveSettings.mutate() }}
            disabled={saveSettings.isPending || (!pointsExact && !pointsOutcome)}
            className="mt-4 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white font-semibold px-4 py-1.5 rounded-lg transition text-sm"
          >
            {saveSettings.isPending ? 'Zapisuję...' : 'Zapisz'}
          </button>
        </div>
        {settingsMsg && <p className="text-sm text-green-400">{settingsMsg}</p>}
      </div>

      <div className="bg-gray-800 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between">
          <h2 className="font-semibold text-white">Kody zaproszenia</h2>
          <button
            onClick={() => generateCode.mutate()}
            disabled={generateCode.isPending}
            className="bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition"
          >
            {generateCode.isPending ? '...' : '+ Generuj kod'}
          </button>
        </div>
        {generateCode.data && (
          <div className="px-4 py-3 bg-green-900/30 border-b border-gray-700">
            <span className="text-xs text-gray-400">Nowy kod: </span>
            <span className="font-mono text-xl font-bold text-green-400 tracking-widest">{generateCode.data.code}</span>
            <span className="text-xs text-gray-500 ml-2">ważny 24h</span>
          </div>
        )}
        <div className="divide-y divide-gray-700">
          {inviteCodes?.length === 0 && (
            <p className="px-4 py-4 text-sm text-gray-500">Brak kodów</p>
          )}
          {inviteCodes?.map(c => (
            <div key={c.id} className="px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className={`font-mono font-bold tracking-widest text-lg ${c.is_used ? 'text-gray-600 line-through' : c.is_expired ? 'text-red-500' : 'text-brand-400'}`}>
                  {c.code}
                </span>
                <span className="text-xs text-gray-500">
                  {c.is_used ? '✓ użyty' : c.is_expired ? '✗ wygasł' : `ważny do ${c.expires_at.slice(11, 16)}`}
                </span>
              </div>
              {!c.is_used && (
                <button
                  onClick={() => deleteCode.mutate(c.code)}
                  className="text-xs text-red-500 hover:text-red-400 transition"
                >
                  Usuń
                </button>
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
            <UserRow key={u.id} u={u} currentUserId={user?.id} onDeleted={() => queryClient.invalidateQueries({ queryKey: ['admin-users'] })} />
          ))}
        </div>
      </div>
    </div>
  )
}
