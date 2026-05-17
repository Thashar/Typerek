import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Register() {
  const { register, user } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ username: '', email: '', password: '', invite_code: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (user) navigate('/', { replace: true })
  }, [user])

  const handle = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await register(form.username, form.email, form.password, form.invite_code)
    } catch (err) {
      setError(err.response?.data?.detail || 'Błąd rejestracji')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-brand-500">⚽ Typerek</h1>
          <p className="text-gray-400 mt-2">Dołącz do zabawy</p>
        </div>
        <form onSubmit={handle} className="bg-gray-900 rounded-2xl p-8 space-y-5 shadow-xl">
          <h2 className="text-xl font-semibold">Rejestracja</h2>
          {error && <p className="text-red-400 text-sm bg-red-950 rounded-lg px-4 py-2">{error}</p>}
          <div>
            <label className="block text-sm text-gray-400 mb-1">Nazwa użytkownika</label>
            <input
              className="w-full bg-gray-800 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-brand-500"
              value={form.username}
              onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
              required minLength={3} maxLength={50}
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Email</label>
            <input
              type="email"
              className="w-full bg-gray-800 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-brand-500"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
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
              required minLength={6}
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Kod zaproszenia</label>
            <input
              className="w-full bg-gray-800 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-brand-500 font-mono uppercase tracking-widest"
              value={form.invite_code}
              onChange={e => setForm(f => ({ ...f, invite_code: e.target.value.toUpperCase() }))}
              placeholder="XXXXX"
              required maxLength={5}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-50 rounded-lg py-2.5 font-semibold transition"
          >
            {loading ? 'Rejestracja...' : 'Zarejestruj się'}
          </button>
          <p className="text-center text-gray-400 text-sm">
            Masz już konto?{' '}
            <Link to="/login" className="text-brand-500 hover:underline">Zaloguj się</Link>
          </p>
        </form>
      </div>
    </div>
  )
}
