import { useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../api/client'

export default function ResendVerification() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handle = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await api.post('/auth/resend-verification', { email })
      setSent(true)
    } catch (err) {
      setError(err.response?.data?.detail || 'Błąd — spróbuj ponownie')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-brand-500">⚽ Typerek</h1>
        </div>
        <div className="bg-gray-900 rounded-2xl p-8 space-y-5 shadow-xl">
          <h2 className="text-xl font-semibold">Wyślij link aktywacyjny</h2>

          {sent ? (
            <div className="space-y-4">
              <p className="text-green-400 text-sm bg-green-950 rounded-lg px-4 py-3">
                Jeśli konto z tym adresem istnieje i nie jest aktywowane, wysłaliśmy nowy link. Sprawdź skrzynkę (i spam).
              </p>
              <Link to="/login" className="block text-center text-brand-500 hover:underline text-sm">
                Wróć do logowania
              </Link>
            </div>
          ) : (
            <form onSubmit={handle} className="space-y-4">
              {error && <p className="text-red-400 text-sm bg-red-950 rounded-lg px-4 py-2">{error}</p>}
              <div>
                <label className="block text-sm text-gray-400 mb-1">Adres e-mail</label>
                <input
                  type="email"
                  className="w-full bg-gray-800 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-brand-500"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required autoFocus
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-50 rounded-lg py-2.5 font-semibold transition"
              >
                {loading ? 'Wysyłanie...' : 'Wyślij link aktywacyjny'}
              </button>
              <p className="text-center">
                <Link to="/login" className="text-gray-500 hover:text-gray-300 text-sm">Wróć do logowania</Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
