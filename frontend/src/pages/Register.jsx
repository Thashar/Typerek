import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Register() {
  const { register } = useAuth()
  const [form, setForm] = useState({ username: '', email: '', password: '', invite_code: '' })
  const [agreedToRodo, setAgreedToRodo] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const handle = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await register(form.username, form.email, form.password, form.invite_code)
      setDone(true)
    } catch (err) {
      const detail = err.response?.data?.detail
      if (Array.isArray(detail)) {
        setError(detail.map(d => d.msg).join(', '))
      } else {
        setError(detail || 'Błąd rejestracji')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold">⚽ <span className="text-white">Type</span><span className="text-brand-500">Rek</span></h1>
          <p className="text-gray-400 mt-2">Dołącz do zabawy</p>
        </div>
        <div className="bg-gray-900 rounded-2xl p-8 space-y-5 shadow-xl">
          <h2 className="text-xl font-semibold">Rejestracja</h2>

          {done ? (
            <div className="space-y-4">
              <div className="bg-green-950 rounded-lg px-4 py-4 space-y-1">
                <p className="text-green-400 font-semibold">Konto zostało utworzone!</p>
                <p className="text-green-300 text-sm">Wysłaliśmy link aktywacyjny na adres <span className="font-bold">{form.email}</span>. Kliknij w link, aby aktywować konto i się zalogować.</p>
                <p className="text-gray-500 text-xs pt-1">Sprawdź też folder spam, jeśli mail nie dotarł.</p>
              </div>
              <Link to="/login" className="block text-center text-brand-500 hover:underline text-sm">
                Przejdź do logowania
              </Link>
              <p className="text-center text-gray-500 text-xs">
                Mail nie dotarł?{' '}
                <Link to="/resend-verification" className="text-brand-500 hover:underline">Wyślij ponownie</Link>
              </p>
            </div>
          ) : (
            <form onSubmit={handle} className="space-y-4">
              {error && <p className="text-red-400 text-sm bg-red-950 rounded-lg px-4 py-2">{error}</p>}
              <div>
                <label className="block text-sm text-gray-400 mb-1">Kod zaproszenia</label>
                <input
                  className="w-full bg-gray-800 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-brand-500 tracking-widest font-mono uppercase"
                  value={form.invite_code}
                  onChange={e => setForm(f => ({ ...f, invite_code: e.target.value.toUpperCase() }))}
                  required
                  placeholder="np. ABC1234567"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Nazwa użytkownika</label>
                <input
                  className="w-full bg-gray-800 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-brand-500"
                  value={form.username}
                  onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                  required minLength={3} maxLength={50}
                />
                <p className="text-xs text-gray-500 mt-1">Tylko litery (a–z, A–Z), cyfry i znak podkreślenia _</p>
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
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id="rodo"
                  checked={agreedToRodo}
                  onChange={e => setAgreedToRodo(e.target.checked)}
                  required
                  className="mt-0.5 shrink-0 accent-brand-500"
                />
                <label htmlFor="rodo" className="text-xs text-gray-400 leading-relaxed">
                  Rejestrując się, akceptuję przetwarzanie danych osobowych (adres e-mail, nazwa użytkownika)
                  w celu świadczenia usługi typowania meczów zgodnie z RODO. Dane nie są udostępniane osobom trzecim.
                </label>
              </div>
              <button
                type="submit"
                disabled={loading || !agreedToRodo}
                className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-50 rounded-lg py-2.5 font-semibold transition"
              >
                {loading ? 'Rejestracja...' : 'Zarejestruj się'}
              </button>
              <p className="text-center text-gray-400 text-sm">
                Masz już konto?{' '}
                <Link to="/login" className="text-brand-500 hover:underline">Zaloguj się</Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
