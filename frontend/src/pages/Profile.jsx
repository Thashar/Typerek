import { useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { myPredictions } from '../api/predictions'
import { getSettings } from '../api/settings'
import { useAuth } from '../context/AuthContext'
import { GroupedPredHistory } from '../components/PredHistory'
import api from '../api/client'

function resizeToBase64(file) {
  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = 80
      canvas.height = 80
      const ctx = canvas.getContext('2d')
      const size = Math.min(img.width, img.height)
      const sx = (img.width - size) / 2
      const sy = (img.height - size) / 2
      ctx.drawImage(img, sx, sy, size, size, 0, 0, 80, 80)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL('image/jpeg', 0.85))
    }
    img.src = url
  })
}

function ChangeUsernameForm({ onUpdated }) {
  const [open, setOpen] = useState(false)
  const [newUsername, setNewUsername] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const reset = () => { setOpen(false); setNewUsername(''); setError('') }

  const handle = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await api.put('/users/me/username', { new_username: newUsername })
      await onUpdated()
      reset()
    } catch (err) {
      const detail = err.response?.data?.detail
      setError(Array.isArray(detail) ? detail.map(d => d.msg).join(', ') : detail || 'Błąd')
    } finally {
      setLoading(false)
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="text-xs text-gray-500 hover:text-gray-300 transition">
        Zmień nick
      </button>
    )
  }

  return (
    <form onSubmit={handle} className="mt-3 space-y-2 border-t border-gray-800 pt-3">
      {error && <p className="text-red-400 text-xs bg-red-950 rounded px-3 py-1.5">{error}</p>}
      <div>
        <label className="block text-xs text-gray-400 mb-1">Nowa nazwa użytkownika</label>
        <input
          className="w-full bg-gray-800 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500"
          value={newUsername}
          onChange={e => setNewUsername(e.target.value)}
          required minLength={3} maxLength={50}
          autoFocus
        />
        <p className="text-xs text-gray-600 mt-0.5">Tylko litery (a–z, A–Z), cyfry i _</p>
      </div>
      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-1.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 rounded-lg text-sm font-semibold transition"
        >
          {loading ? '...' : 'Zapisz'}
        </button>
        <button type="button" onClick={reset} className="px-4 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition">
          Anuluj
        </button>
      </div>
    </form>
  )
}

function Avatar({ user, onUpdated }) {
  const fileRef = useRef(null)
  const [loading, setLoading] = useState(false)
  const initials = (user?.username ?? '?').slice(0, 2).toUpperCase()

  const handleFile = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setLoading(true)
    try {
      const base64 = await resizeToBase64(file)
      await api.put('/users/me/avatar', { avatar: base64 })
      onUpdated()
    } finally {
      setLoading(false)
      e.target.value = ''
    }
  }

  const handleDelete = async () => {
    setLoading(true)
    try {
      await api.delete('/users/me/avatar')
      onUpdated()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative shrink-0">
      <button
        onClick={() => fileRef.current?.click()}
        disabled={loading}
        className="w-16 h-16 rounded-full overflow-hidden bg-gray-700 flex items-center justify-center hover:opacity-80 transition"
        title="Zmień awatar"
      >
        {user?.avatar
          ? <img src={user.avatar} className="w-full h-full object-cover" alt="" />
          : <span className="text-xl font-bold text-gray-400">{initials}</span>
        }
        {loading && (
          <div className="absolute inset-0 bg-black/60 rounded-full flex items-center justify-center">
            <span className="text-xs text-white">...</span>
          </div>
        )}
      </button>
      {user?.avatar && !loading && (
        <button
          onClick={handleDelete}
          className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-gray-600 hover:bg-red-600 rounded-full text-white text-xs flex items-center justify-center transition"
          title="Usuń awatar"
        >×</button>
      )}
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
    </div>
  )
}

export default function Profile() {
  const { user, logout, refreshUser } = useAuth()
  const navigate = useNavigate()
  const { data: preds } = useQuery({ queryKey: ['predictions'], queryFn: myPredictions })
  const { data: settings } = useQuery({ queryKey: ['game-settings'], queryFn: getSettings })

  const predictions = preds ?? []
  const scored = predictions.filter(p => p.points != null)
  const totalPts = scored.reduce((s, p) => s + p.points, 0)
  const exactHits = scored.filter(p => p.points === (settings?.points_exact ?? 3)).length
  const outcomeHits = scored.filter(p => p.points === (settings?.points_outcome ?? 1)).length

  const handleLogout = () => { logout(); navigate('/login') }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      {user?.is_ranked
        ? <div className="bg-green-950/60 border border-green-700/50 rounded-xl px-4 py-3 flex items-center gap-2">
            <span className="text-green-400 font-semibold text-sm">Zweryfikowany</span>
            <span className="text-green-200/60 text-xs">— jesteś widoczny w rankingu</span>
          </div>
        : <div className="bg-yellow-950/60 border border-yellow-700/50 rounded-xl px-4 py-3">
            <p className="text-yellow-300 font-semibold text-sm">Konto niezweryfikowane</p>
            <p className="text-yellow-200/60 text-xs mt-0.5">Skontaktuj się z adminem w celu weryfikacji konta i pojawienia się w rankingu.</p>
          </div>
      }
      <div className="bg-gray-900 rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <Avatar user={user} onUpdated={refreshUser} />
            <div className="min-w-0">
              <h2 className="text-xl font-bold truncate">{user?.username}</h2>
              <p className="text-gray-400 text-sm truncate">{user?.email}</p>
              <ChangeUsernameForm onUpdated={refreshUser} />
            </div>
          </div>
          <button onClick={handleLogout} className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm transition shrink-0">
            Wyloguj
          </button>
        </div>
        <div className="grid grid-cols-3 gap-3 pt-2">
          <div className="bg-gray-800 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-brand-400">{totalPts}</p>
            <p className="text-xs text-gray-400 mt-1">Punkty</p>
          </div>
          <div className="bg-gray-800 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-green-400">{outcomeHits}</p>
            <p className="text-xs text-gray-400 mt-1">Typ ✅</p>
          </div>
          <div className="bg-gray-800 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-yellow-400">{exactHits}</p>
            <p className="text-xs text-gray-400 mt-1">Dokładny ⭐</p>
          </div>
        </div>
        <div className="bg-gray-800/60 rounded-lg px-3 py-2 text-xs text-gray-400 space-y-0.5">
          <div>⭐ <span className="text-white">Dokładny wynik</span> (wynik regulaminowy) = <span className="text-yellow-400 font-bold">{settings?.points_exact ?? 3} pkt</span></div>
          <div>✅ <span className="text-white">Dobry typ</span> (1/X/2) = <span className="text-green-400 font-bold">{settings?.points_outcome ?? 1} pkt</span></div>
          <div className="text-gray-500 pt-0.5">W fazie pucharowej liczy się wynik po 90 min — bez dogrywki i karnych.</div>
        </div>
      </div>

      <h3 className="font-semibold text-lg">Historia typów</h3>
      <GroupedPredHistory predictions={predictions} />
    </div>
  )
}
