import { Link } from 'react-router-dom'
import { usePageTitle } from '../hooks/usePageTitle'

export default function NotFound() {
  usePageTitle('Nie znaleziono')
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center space-y-4">
        <p className="text-6xl font-bold text-gray-700">404</p>
        <h1 className="text-xl font-semibold text-gray-300">Strona nie istnieje</h1>
        <p className="text-gray-500 text-sm">Adres, który wpisałeś, nie prowadzi do żadnej strony.</p>
        <Link to="/" className="inline-block mt-2 px-5 py-2 bg-brand-600 hover:bg-brand-700 rounded-lg text-sm font-semibold transition">
          Wróć na stronę główną
        </Link>
      </div>
    </div>
  )
}
