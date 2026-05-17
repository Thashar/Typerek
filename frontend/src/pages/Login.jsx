import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ username: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handle = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(form.username, form.password)
      navigate('/')
    } catch (err) {
      setError(err.response?.data?.detail || 'Błąd logowania')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-brand-500">⚽ Typerek</h1>
          <p className="text-gray-400 mt-2">Typuj wyniki. Rywalizuj. Wygrywaj.</p>
        </div>
        <form onSubmit={handle} className="bg-gray-900 rounded-2xl p-8 space-y-5 shadow-xl">
          <h2 className="text-xl font-semibold">Logowanie</h2>
          {error && <p className="text-red-400 text-sm bg-red-950 rounded-lg px-4 py-2">{error}</p>}
          <div>
            <label className="block text-sm text-gray-400 mb-1">Nazwa użytkownika</label>
            <input
              className="w-full bg-gray-800 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-brand-500"
              value={form.username}
              onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
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
