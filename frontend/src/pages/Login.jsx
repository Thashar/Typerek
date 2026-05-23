import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { usePageTitle } from '../hooks/usePageTitle'

export default function Login() {
  usePageTitle('Logowanie')
  const { login, user } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ username: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [unverified, setUnverified] = useState(false)

  useEffect(() => {
    if (user) navigate('/', { replace: true })
  }, [user])

  const handle = async (e) => {
    e.preventDefault()
    setError('')
    setUnverified(false)
    setLoading(true)
    try {
      await login(form.username, form.password)
    } catch (err) {
      const detail = err.response?.data?.detail || 'Błąd logowania'
      if (err.response?.status === 403 && detail.includes('e-mail')) setUnverified(true)
      setError(detail)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold">⚽ <span className="text-white">Type</span><span className="text-brand-500">Rek</span></h1>
          <p className="text-gray-400 mt-2">Typuj wyniki. Rywalizuj. Wygrywaj.</p>
        </div>
        <form onSubmit={handle} className="bg-gray-900 rounded-2xl p-8 space-y-5 shadow-xl">
          <h2 className="text-xl font-semibold">Logowanie</h2>
          {error && (
            <div className="bg-red-950 rounded-lg px-4 py-2 space-y-1">
              <p className="text-red-400 text-sm">{error}</p>
              {unverified && (
                <Link to="/resend-verification" className="text-xs text-brand-400 hover:underline">
                  Wyślij ponownie link aktywacyjny →
                </Link>
              )}
            </div>
          )}
          <div>
            <label className="block text-sm text-gray-400 mb-1">Nazwa użytkownika</label>
            <input
              className="w-full bg-gray-800 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-brand-500"
              value={form.username}
              onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
              autoComplete="username"
              required
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Hasło</label>
            <input
              type="password"
              className="w-full bg-gray-800 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-brand-500"
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              autoComplete="current-password"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-50 rounded-lg py-2.5 font-semibold transition"
          >
            {loading ? 'Logowanie...' : 'Zaloguj się'}
          </button>
          <div className="relative flex items-center">
            <div className="flex-grow border-t border-gray-700" />
            <span className="mx-3 text-gray-600 text-xs">lub</span>
            <div className="flex-grow border-t border-gray-700" />
          </div>
          <button
            type="button"
            onClick={() => window.location.href = '/api/auth/google'}
            className="w-full flex items-center justify-center gap-3 bg-gray-800 hover:bg-gray-700 rounded-lg py-2.5 font-semibold transition"
          >
            <svg width="18" height="18" viewBox="0 0 18 18"><path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/><path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"/><path fill="#FBBC05" d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957C.347 6.175 0 7.55 0 9s.347 2.825.957 4.039l3.007-2.332z"/><path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z"/></svg>
            Zaloguj się przez Google
          </button>
          <p className="text-center text-gray-400 text-sm">
            <Link to="/forgot-password" className="text-gray-500 hover:text-gray-300">Zapomniałem hasła</Link>
          </p>
          <p className="text-center text-gray-400 text-sm">
            Nie masz konta?{' '}
            <Link to="/register" className="text-brand-500 hover:underline">Zarejestruj się</Link>
          </p>
        </form>
      </div>
    </div>
  )
}
