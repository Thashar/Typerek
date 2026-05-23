import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../api/client'
import { getSettings, updateSettings } from '../api/settings'
import { usePageTitle } from '../hooks/usePageTitle'

function LeaguesSection({ queryClient }) {
  const [newCode, setNewCode] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  const { data: leagues = [], refetch } = useQuery({
    queryKey: ['admin-leagues'],
    queryFn: () => api.get('/admin/leagues').then(r => r.data),
  })

  const createMut = useMutation({
    mutationFn: () => api.post('/admin/leagues', { code: newCode.trim().toUpperCase() }),
    onSuccess: () => { setNewCode(''); setErr(''); refetch(); queryClient.invalidateQueries({ queryKey: ['admin-users'] }) },
    onError: (e) => setErr(e.response?.data?.detail || 'Błąd'),
  })
  const deleteMut = useMutation({
    mutationFn: (id) => api.delete(`/admin/leagues/${id}`),
    onSuccess: () => { setDeleteConfirm(null); refetch(); queryClient.invalidateQueries({ queryKey: ['admin-users'] }) },
  })
  const addRankedMut = useMutation({
    mutationFn: (id) => api.post(`/admin/leagues/${id}/add-ranked`).then(r => r.data),
    onSuccess: (data, id) => { setMsg(`Dodano ${data.added} os.`); setTimeout(() => setMsg(''), 3000); refetch(); queryClient.invalidateQueries({ queryKey: ['admin-users'] }) },
    onError: (e) => setErr(e.response?.data?.detail || 'Błąd'),
  })

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {leagues.length === 0 && <p className="text-gray-500 text-sm">Brak lig. Utwórz pierwszą.</p>}
        {leagues.map(l => (
          <div key={l.id} className="bg-gray-700 rounded-lg px-3 py-2.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <code className="text-sm font-mono font-bold text-brand-400 tracking-widest">{l.invite_code}</code>
              <span className="text-xs text-gray-400">{l.members_count} os.</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => { navigator.clipboard.writeText(l.invite_code); setMsg('Skopiowano!'); setTimeout(() => setMsg(''), 2000) }}
                className="text-xs text-gray-500 hover:text-white transition"
                title="Kopiuj kod"
              >📋</button>
              <button
                onClick={() => addRankedMut.mutate(l.id)}
                disabled={addRankedMut.isPending}
                className="text-xs text-gray-500 hover:text-brand-400 disabled:opacity-50 transition"
                title="Dodaj wszystkich zweryfikowanych bez ligi"
              >+👥</button>
              {deleteConfirm === l.id ? (
                <>
                  <button onClick={() => deleteMut.mutate(l.id)} className="text-xs bg-red-600 hover:bg-red-700 text-white px-2 py-0.5 rounded transition">Usuń</button>
                  <button onClick={() => setDeleteConfirm(null)} className="text-xs text-gray-400 hover:text-white transition">Anuluj</button>
                </>
              ) : (
                <button onClick={() => setDeleteConfirm(l.id)} className="text-gray-600 hover:text-red-400 transition text-lg leading-none">×</button>
              )}
            </div>
          </div>
        ))}
        {msg && <p className="text-xs text-green-400">{msg}</p>}
        {err && <p className="text-xs text-red-400">{err}</p>}
      </div>
      <div className="flex gap-2">
        <input
          className="flex-1 bg-gray-700 rounded-lg px-3 py-2 text-sm font-mono uppercase outline-none focus:ring-2 focus:ring-brand-500 tracking-widest"
          placeholder="NAZWA LIGI (np. LIGA NGK 2025)"
          value={newCode}
          onChange={e => setNewCode(e.target.value.toUpperCase().replace(/\s{2,}/g, ' '))}
          onKeyDown={e => e.key === 'Enter' && newCode.trim() && createMut.mutate()}
        />
        <button
          onClick={() => createMut.mutate()}
          disabled={!newCode.trim() || createMut.isPending}
          className="bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg transition"
        >
          {createMut.isPending ? '...' : '+ Dodaj'}
        </button>
      </div>
    </div>
  )
}

function StatCard({ label, value }) {
  return (
    <div className="bg-gray-800 rounded-xl p-4 text-center">
      <div className="text-2xl font-bold text-brand-500">{value ?? '—'}</div>
      <div className="text-xs text-gray-400 mt-1">{label}</div>
    </div>
  )
}

function Section({ title, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="bg-gray-800 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-750 transition"
      >
        <span className="font-semibold text-white text-sm">{title}</span>
        <span className="text-gray-400 text-xs ml-2">{open ? '▾' : '▸'}</span>
      </button>
      {open && <div className="px-4 pb-4 pt-1 space-y-3 border-t border-gray-700">{children}</div>}
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

function UserRow({ u, currentUserId, leagues, onChanged }) {
  const [confirm, setConfirm] = useState(false)
  const [err, setErr] = useState('')

  const deleteMut = useMutation({
    mutationFn: () => api.delete(`/admin/users/${u.id}`),
    onSuccess: () => { setConfirm(false); onChanged() },
    onError: (e) => setErr(e.response?.data?.detail || 'Błąd usuwania'),
  })

  const verifyMut = useMutation({
    mutationFn: () => api.post(`/admin/users/${u.id}/verify`),
    onSuccess: () => onChanged(),
    onError: (e) => setErr(e.response?.data?.detail || 'Błąd weryfikacji'),
  })

  const leagueMut = useMutation({
    mutationFn: (league_id) => api.put(`/admin/users/${u.id}/league`, { league_id }),
    onSuccess: () => onChanged(),
    onError: (e) => setErr(e.response?.data?.detail || 'Błąd zmiany ligi'),
  })

  const canDelete = !u.is_admin && u.id !== currentUserId

  return (
    <div className="py-3 flex flex-wrap items-center gap-x-3 gap-y-1">
      <div className="flex-1 min-w-0">
        {!u.is_admin
          ? <Link to={`/admin/users/${u.id}`} className="font-medium text-white text-sm hover:text-brand-500 transition">{u.username}</Link>
          : <span className="font-medium text-white text-sm">{u.username}</span>
        }
        {u.is_admin && <span className="ml-2 text-xs bg-brand-500/20 text-brand-500 px-1.5 py-0.5 rounded">admin</span>}
        {u.is_ranked
          ? <span className="ml-1 text-xs bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded">zweryfikowany</span>
          : <span className="ml-1 text-xs bg-gray-700 text-gray-500 px-1.5 py-0.5 rounded">niezweryfikowany</span>
        }
        {!u.is_verified && <span className="ml-1 text-xs bg-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded">mail niepotwierdzony</span>}
        <div className="text-xs text-gray-500 mt-0.5 truncate">{u.email}</div>
      </div>
      <div className="shrink-0">
        <select
          value={u.league_id || ''}
          onChange={e => leagueMut.mutate(e.target.value ? parseInt(e.target.value) : null)}
          disabled={leagueMut.isPending}
          className="text-xs bg-gray-700 rounded px-2 py-1 text-gray-300 font-mono outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-50"
        >
          <option value="">Bez ligi</option>
          {leagues.map(l => (
            <option key={l.id} value={l.id}>{l.invite_code}</option>
          ))}
        </select>
      </div>
      <div className="text-right shrink-0">
        <div className="text-brand-500 font-bold text-sm">{u.total_points} pkt</div>
        <div className="text-xs text-gray-500">{u.created_at?.slice(0, 10)}</div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {!u.is_ranked && (
          <button
            onClick={() => verifyMut.mutate()}
            disabled={verifyMut.isPending}
            className="text-xs bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white px-2 py-1 rounded transition"
          >
            {verifyMut.isPending ? '...' : 'Weryfikuj'}
          </button>
        )}
        {canDelete && (
          confirm ? (
            <div className="flex items-center gap-1">
              <button onClick={() => deleteMut.mutate()} disabled={deleteMut.isPending}
                className="text-xs bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white px-2 py-1 rounded transition">
                {deleteMut.isPending ? '...' : 'Tak'}
              </button>
              <button onClick={() => setConfirm(false)} className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 px-2 py-1 rounded transition">
                Nie
              </button>
            </div>
          ) : (
            <button onClick={() => { setErr(''); setConfirm(true) }}
              className="text-gray-600 hover:text-red-400 transition text-lg leading-none" title="Usuń użytkownika">
              ×
            </button>
          )
        )}
      </div>
      {err && <span className="text-xs text-red-400 w-full">{err}</span>}
    </div>
  )
}

export default function Admin() {
  usePageTitle('Panel admina')
  const { user } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [syncMsg, setSyncMsg] = useState(null)
  const [settingsMsg, setSettingsMsg] = useState(null)
  const [clearChatConfirm, setClearChatConfirm] = useState(false)
  const [unverifyConfirm, setUnverifyConfirm] = useState(false)
  const [resetPointsConfirm, setResetPointsConfirm] = useState(false)

  const { data: stats } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: () => api.get('/admin/stats').then(r => r.data),
  })

  const { data: gameSettings } = useQuery({
    queryKey: ['game-settings'],
    queryFn: getSettings,
  })
  const [pointsExact, setPointsExact] = useState('')
  const [pointsOutcome, setPointsOutcome] = useState('')
  const [worldCupOnly, setWorldCupOnly] = useState(false)

  useEffect(() => {
    if (gameSettings) {
      setPointsExact(String(gameSettings.points_exact))
      setPointsOutcome(String(gameSettings.points_outcome))
      setWorldCupOnly(gameSettings.world_cup_only ?? false)
    }
  }, [gameSettings])

  const saveSettings = useMutation({
    mutationFn: () => updateSettings({
      points_exact: parseInt(pointsExact),
      points_outcome: parseInt(pointsOutcome),
      world_cup_only: worldCupOnly,
    }),
    onSuccess: (data) => {
      setSettingsMsg(`✓ Zapisano`)
      queryClient.invalidateQueries({ queryKey: ['game-settings'] })
      queryClient.invalidateQueries({ queryKey: ['match-leagues'] })
      queryClient.invalidateQueries({ queryKey: ['matches'] })
      queryClient.invalidateQueries({ queryKey: ['match-dates'] })
    },
    onError: () => setSettingsMsg('✗ Błąd zapisu'),
  })

  const { data: users } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => api.get('/admin/users').then(r => r.data),
  })

  const { data: allLeagues = [] } = useQuery({
    queryKey: ['admin-leagues'],
    queryFn: () => api.get('/admin/leagues').then(r => r.data),
  })

  const clearChat = useMutation({
    mutationFn: () => api.delete('/admin/chat'),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['chat-messages'] }); setClearChatConfirm(false) },
  })

  const unverifyAll = useMutation({
    mutationFn: () => api.post('/admin/unverify-all-users').then(r => r.data),
    onSuccess: () => { setUnverifyConfirm(false); refreshUsers() },
  })

  const resetPoints = useMutation({
    mutationFn: () => api.post('/admin/reset-all-points').then(r => r.data),
    onSuccess: () => {
      setResetPointsConfirm(false)
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      queryClient.invalidateQueries({ queryKey: ['ranking'] })
    },
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

  if (!user?.is_admin) { navigate('/'); return null }

  const refreshUsers = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-users'] })
    queryClient.invalidateQueries({ queryKey: ['admin-leagues'] })
    queryClient.invalidateQueries({ queryKey: ['ranking'] })
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-3">
      <h1 className="text-xl font-bold text-white">Panel admina</h1>

      {/* Statystyki — zawsze widoczne */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Użytkownicy" value={stats?.users} />
        <StatCard label="Mecze" value={stats?.matches} />
        <StatCard label="Nadchodzące" value={stats?.upcoming_matches} />
        <StatCard label="Typy" value={stats?.predictions} />
      </div>

      {/* Tryb Mundial */}
      <Section title="🌍 Tryb tylko Mundial">
        <p className="text-xs text-gray-400">
          Gdy włączony, w typerze widoczne są wyłącznie mecze Mistrzostw Świata. Pozostałe ligi są ukryte.
        </p>
        <div className="flex items-center justify-between">
          <div>
            <span className="text-sm font-medium text-white">Tryb tylko Mundial</span>
            {worldCupOnly && <span className="ml-2 text-xs bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded">aktywny</span>}
          </div>
          <button
            onClick={() => {
              const newVal = !worldCupOnly
              setWorldCupOnly(newVal)
              updateSettings({
                points_exact: parseInt(pointsExact) || gameSettings?.points_exact,
                points_outcome: parseInt(pointsOutcome) || gameSettings?.points_outcome,
                world_cup_only: newVal,
              }).then(() => {
                queryClient.invalidateQueries({ queryKey: ['game-settings'] })
                queryClient.invalidateQueries({ queryKey: ['match-leagues'] })
                queryClient.invalidateQueries({ queryKey: ['matches'] })
                queryClient.invalidateQueries({ queryKey: ['match-dates'] })
              })
            }}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${worldCupOnly ? 'bg-green-500' : 'bg-gray-600'}`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${worldCupOnly ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </div>
      </Section>

      {/* Synchronizacja */}
      <Section title="🔄 Synchronizacja danych">
        <p className="text-xs text-gray-400">Zaciąga mecze wszystkich lig do końca roku: {COMPETITIONS.map(c => c.code).join(', ')}</p>
        <button
          onClick={() => { setSyncMsg(null); syncAll.mutate() }}
          disabled={syncAll.isPending}
          className="bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white font-semibold px-6 py-2.5 rounded-lg transition"
        >
          {syncAll.isPending ? '⏳ Synchronizuję...' : '🔄 Synchronizuj wszystkie dane'}
        </button>
        {gameSettings?.last_synced_at && (
          <p className="text-xs text-gray-500">
            Ostatnia synchronizacja: {new Date(gameSettings.last_synced_at + 'Z').toLocaleString('pl-PL', { dateStyle: 'short', timeStyle: 'short' })}
          </p>
        )}
        {syncMsg && <p className="text-sm text-green-400">{syncMsg}</p>}
      </Section>

      {/* Punktacja */}
      <Section title="⭐ Punktacja">
        <p className="text-xs text-gray-400">
          Aktualne: dobry typ ✅ = <span className="text-brand-500 font-bold">{gameSettings?.points_outcome ?? 2} pkt</span>,
          dokładny wynik ⭐ = <span className="text-brand-500 font-bold">{gameSettings?.points_exact ?? 5} pkt</span>
        </p>
        <div className="flex items-center gap-3 flex-wrap">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Za dobry typ ✅</label>
            <input type="number" min="0" max="100" value={pointsOutcome} onChange={e => setPointsOutcome(e.target.value)}
              className="w-20 text-center bg-gray-700 rounded-lg px-2 py-1.5 font-bold outline-none focus:ring-2 focus:ring-brand-500" />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Za dokładny wynik ⭐</label>
            <input type="number" min="1" max="100" value={pointsExact} onChange={e => setPointsExact(e.target.value)}
              className="w-20 text-center bg-gray-700 rounded-lg px-2 py-1.5 font-bold outline-none focus:ring-2 focus:ring-brand-500" />
          </div>
          <button
            onClick={() => { setSettingsMsg(null); saveSettings.mutate() }}
            disabled={saveSettings.isPending || !pointsExact || !pointsOutcome}
            className="mt-4 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white font-semibold px-4 py-1.5 rounded-lg transition text-sm"
          >
            {saveSettings.isPending ? 'Zapisuję...' : 'Zapisz'}
          </button>
        </div>
        {settingsMsg && <p className="text-sm text-green-400">{settingsMsg}</p>}
      </Section>

      {/* Czat */}
      <Section title="💬 Czat">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-sm font-medium text-white">Czat</span>
            {gameSettings?.chat_enabled === false
              ? <span className="ml-2 text-xs bg-gray-700 text-gray-500 px-1.5 py-0.5 rounded">wyłączony</span>
              : <span className="ml-2 text-xs bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded">aktywny</span>
            }
          </div>
          <button
            onClick={() => {
              const newVal = gameSettings?.chat_enabled === false ? true : false
              updateSettings({
                points_exact: parseInt(pointsExact) || gameSettings?.points_exact,
                points_outcome: parseInt(pointsOutcome) || gameSettings?.points_outcome,
                world_cup_only: worldCupOnly,
                chat_enabled: newVal,
              }).then(() => queryClient.invalidateQueries({ queryKey: ['game-settings'] }))
            }}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${gameSettings?.chat_enabled !== false ? 'bg-green-500' : 'bg-gray-600'}`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${gameSettings?.chat_enabled !== false ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </div>
        <p className="text-xs text-gray-400">Usuwa wszystkie wiadomości z czatu</p>
        {clearChatConfirm ? (
          <div className="flex items-center gap-2">
            <button onClick={() => clearChat.mutate()} disabled={clearChat.isPending}
              className="text-xs bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg transition">
              {clearChat.isPending ? '...' : 'Tak, wyczyść'}
            </button>
            <button onClick={() => setClearChatConfirm(false)}
              className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 px-3 py-1.5 rounded-lg transition">
              Anuluj
            </button>
          </div>
        ) : (
          <button onClick={() => setClearChatConfirm(true)}
            className="text-xs bg-gray-700 hover:bg-red-700 text-gray-300 hover:text-white px-3 py-1.5 rounded-lg transition">
            🗑 Wyczyść czat
          </button>
        )}
      </Section>

      {/* Weryfikacja */}
      <Section title="✅ Weryfikacja">
        <p className="text-xs text-gray-400">Usuwa weryfikację wszystkim użytkownikom (oprócz admina)</p>
        {unverifyConfirm ? (
          <div className="flex items-center gap-2">
            <button onClick={() => unverifyAll.mutate()} disabled={unverifyAll.isPending}
              className="text-xs bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg transition">
              {unverifyAll.isPending ? '...' : 'Tak, usuń'}
            </button>
            <button onClick={() => setUnverifyConfirm(false)}
              className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 px-3 py-1.5 rounded-lg transition">
              Anuluj
            </button>
          </div>
        ) : (
          <button onClick={() => setUnverifyConfirm(true)}
            className="text-xs bg-gray-700 hover:bg-red-700 text-gray-300 hover:text-white px-3 py-1.5 rounded-lg transition">
            Odweryf. wszystkich
          </button>
        )}
      </Section>

      {/* Reset punktów */}
      <Section title="🔁 Reset punktów">
        <p className="text-xs text-gray-400">Zeruje punkty wszystkich typów</p>
        {resetPointsConfirm ? (
          <div className="flex items-center gap-2">
            <button onClick={() => resetPoints.mutate()} disabled={resetPoints.isPending}
              className="text-xs bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg transition">
              {resetPoints.isPending ? '...' : 'Tak, zeruj'}
            </button>
            <button onClick={() => setResetPointsConfirm(false)}
              className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 px-3 py-1.5 rounded-lg transition">
              Anuluj
            </button>
          </div>
        ) : (
          <button onClick={() => setResetPointsConfirm(true)}
            className="text-xs bg-gray-700 hover:bg-red-700 text-gray-300 hover:text-white px-3 py-1.5 rounded-lg transition">
            Zeruj punkty
          </button>
        )}
      </Section>

      {/* Ligi */}
      <Section title="🏅 Ligi">
        <LeaguesSection queryClient={queryClient} />
      </Section>

      {/* Użytkownicy podzieleni na ligi */}
      {(() => {
        if (!users) return null
        const byLeague = {}
        const noLeague = []
        users.forEach(u => {
          if (u.league_id) {
            const key = u.league_id
            if (!byLeague[key]) byLeague[key] = { name: u.league_name, users: [] }
            byLeague[key].users.push(u)
          } else {
            noLeague.push(u)
          }
        })
        return (
          <>
            {Object.entries(byLeague).map(([lid, { name, users: lu }]) => (
              <Section key={lid} title={`👥 ${name} (${lu.length})`}>
                <div className="divide-y divide-gray-700">
                  {lu.map(u => <UserRow key={u.id} u={u} currentUserId={user?.id} leagues={allLeagues} onChanged={refreshUsers} />)}
                </div>
              </Section>
            ))}
            {noLeague.length > 0 && (
              <Section title={`👥 Bez ligi (${noLeague.length})`}>
                <div className="divide-y divide-gray-700">
                  {noLeague.map(u => <UserRow key={u.id} u={u} currentUserId={user?.id} leagues={allLeagues} onChanged={refreshUsers} />)}
                </div>
              </Section>
            )}
          </>
        )
      })()}
    </div>
  )
}
