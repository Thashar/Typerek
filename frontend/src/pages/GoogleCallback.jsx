import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { me } from '../api/auth'
import { useAuth } from '../context/AuthContext'

export default function GoogleCallback() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { setUser } = useAuth()

  useEffect(() => {
    const at = searchParams.get('access_token')
    const rt = searchParams.get('refresh_token')
    if (!at || !rt) { navigate('/login'); return }
    localStorage.setItem('access_token', at)
    localStorage.setItem('refresh_token', rt)
    me().then(user => {
      setUser(user)
      navigate('/', { replace: true })
    }).catch(() => {
      localStorage.clear()
      navigate('/login')
    })
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-400">Logowanie przez Google...</p>
    </div>
  )
}
