import { useState } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import api from '../api/client'

export default function ResetPassword() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = searchParams.get('token') || ''

  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const handle = async (e) => {
    e.preventDefault()
    if (password !== password2) { setError('Hasła się nie zgadzają'); return }
    setError('')
    setLoading(true)
    try {
      await api.post('/auth/reset-password', { token, new_password: password })
      setDone(true)
      setTimeout(() => navigate('/login'), 2500)
    } catch (err) {
      setError(err.response?.data?.detail || 'Błąd — spróbuj ponownie')
    } finally {
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center space-y-3">
          <p className="text-red-400">Brak tokenu resetującego.</p>
          <Link to="/forgot-password" className="text-brand-500 hover:underline text-sm">Wróć do formularza</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold">⚽ <span className="text-white">Type</span><span className="text-brand-500">Rek</span></h1>
        </div>
        <div className="bg-gray-900 rounded-2xl p-8 space-y-5 shadow-xl">
          <h2 className="text-xl font-semibold">Nowe hasło</h2>

          {done ? (
            <p className="text-green-400 text-sm bg-green-950 rounded-lg px-4 py-3">
              Hasło zostało zmienione. Przekierowujemy do logowania...
            </p>
          ) : (
            <form onSubmit={handle} className="space-y-4">
              {error && <p className="text-red-400 text-sm bg-red-950 rounded-lg px-4 py-2">{error}</p>}
              <div>
                <label className="block text-sm text-gray-400 mb-1">Nowe hasło</label>
                <input
                  type="password"
                  className="w-full bg-gray-800 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-brand-500"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required minLength={6}
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Powtórz hasło</label>
                <input
                  type="password"
                  className="w-full bg-gray-800 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-brand-500"
                  value={password2}
                  onChange={e => setPassword2(e.target.value)}
                  required minLength={6}
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-50 rounded-lg py-2.5 font-semibold transition"
              >
                {loading ? 'Zapisywanie...' : 'Ustaw nowe hasło'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
