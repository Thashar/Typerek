import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import api from '../api/client'

export default function VerifyEmail() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''
  const [status, setStatus] = useState('loading') // loading | ok | error
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!token) { setStatus('error'); setMessage('Brak tokenu weryfikacyjnego.'); return }
    api.get(`/auth/verify-email?token=${encodeURIComponent(token)}`)
      .then(r => { setStatus('ok'); setMessage(r.data.detail) })
      .catch(e => { setStatus('error'); setMessage(e.response?.data?.detail || 'Błąd weryfikacji') })
  }, [token])

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md text-center space-y-6">
        <h1 className="text-4xl font-bold">⚽ <span className="text-white">Type</span><span className="text-brand-500">Rek</span></h1>

        {status === 'loading' && (
          <p className="text-gray-400">Weryfikacja adresu e-mail...</p>
        )}

        {status === 'ok' && (
          <div className="bg-green-950 rounded-2xl p-8 space-y-4">
            <div className="text-4xl">✅</div>
            <p className="text-green-400 font-semibold text-lg">E-mail potwierdzony!</p>
            <p className="text-green-300 text-sm">{message}</p>
            <Link
              to="/login"
              className="inline-block mt-2 bg-brand-600 hover:bg-brand-700 text-white font-semibold px-6 py-2.5 rounded-lg transition"
            >
              Zaloguj się
            </Link>
          </div>
        )}

        {status === 'error' && (
          <div className="bg-red-950 rounded-2xl p-8 space-y-4">
            <div className="text-4xl">❌</div>
            <p className="text-red-400 font-semibold">{message}</p>
            <p className="text-gray-500 text-sm">Link mógł wygasnąć (ważny 24h). Możesz poprosić o nowy link.</p>
            <Link to="/login" className="block text-brand-500 hover:underline text-sm">Wróć do logowania</Link>
          </div>
        )}
      </div>
    </div>
  )
}
