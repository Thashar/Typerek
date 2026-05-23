import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { me, googleExchange, googleComplete } from '../api/auth'
import { useAuth } from '../context/AuthContext'

export default function GoogleCallback() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { setUser } = useAuth()
  const [pendingToken, setPendingToken] = useState(null)
  const [inviteCode, setInviteCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const session = searchParams.get('session')
    const pending = searchParams.get('pending')

    if (session) {
      googleExchange({ session_token: session })
        .then(tokens => {
          localStorage.setItem('access_token', tokens.access_token)
          localStorage.setItem('refresh_token', tokens.refresh_token)
          return me()
        })
        .then(user => {
          setUser(user)
          navigate('/', { replace: true })
        })
        .catch(() => navigate('/login'))
    } else if (pending) {
      setPendingToken(pending)
    } else {
      navigate('/login')
    }
  }, [])

  const handleInviteSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const tokens = await googleComplete({ pending_token: pendingToken, invite_code: inviteCode.trim().toUpperCase() })
      localStorage.setItem('access_token', tokens.access_token)
      localStorage.setItem('refresh_token', tokens.refresh_token)
      const user = await me()
      setUser(user)
      navigate('/', { replace: true })
    } catch (err) {
      setError(err.response?.data?.detail || 'Błąd rejestracji')
    } finally {
      setLoading(false)
    }
  }

  if (pendingToken) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold">⚽ <span className="text-white">Type</span><span className="text-brand-500">Rek</span></h1>
            <p className="text-gray-400 mt-2">Ostatni krok – potrzebujesz kodu zaproszenia</p>
          </div>
          <form onSubmit={handleInviteSubmit} className="bg-gray-900 rounded-2xl p-8 space-y-5 shadow-xl">
            <h2 className="text-xl font-semibold">Dokończ rejestrację przez Google</h2>
            <p className="text-sm text-gray-400">
              Twoje konto Google zostało zweryfikowane. Aby dołączyć do TypeRek, podaj kod zaproszenia do ligi.
            </p>
            {error && <p className="text-red-400 text-sm bg-red-950 rounded-lg px-4 py-2">{error}</p>}
            <div>
              <label className="block text-sm text-gray-400 mb-1">Kod zaproszenia</label>
              <input
                className="w-full bg-gray-800 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-brand-500 tracking-widest font-mono uppercase"
                value={inviteCode}
                onChange={e => setInviteCode(e.target.value.toUpperCase())}
                required
                placeholder=""
                autoFocus
              />
            </div>
            <button
              type="submit"
              disabled={loading || !inviteCode.trim()}
              className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-50 rounded-lg py-2.5 font-semibold transition"
            >
              {loading ? 'Rejestracja...' : 'Dołącz do ligi'}
            </button>
            <p className="text-center text-gray-400 text-sm">
              <Link to="/login" className="text-gray-500 hover:text-gray-300">Wróć do logowania</Link>
            </p>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-400">Logowanie przez Google...</p>
    </div>
  )
}
