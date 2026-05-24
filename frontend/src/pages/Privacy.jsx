import { Link } from 'react-router-dom'
import { usePageTitle } from '../hooks/usePageTitle'

export default function Privacy() {
  usePageTitle('Polityka prywatności')
  return (
    <div className="min-h-screen px-4 py-10 max-w-2xl mx-auto space-y-6 text-sm text-gray-300">
      <Link to="/login" className="text-brand-400 hover:underline text-xs">← Wróć</Link>

      <h1 className="text-2xl font-bold text-white">Polityka prywatności TypeRek</h1>
      <p className="text-gray-500 text-xs">Ostatnia aktualizacja: maj 2025</p>

      <section className="space-y-2">
        <h2 className="font-semibold text-white">1. Administrator danych</h2>
        <p>
          Administratorem danych osobowych jest właściciel serwisu TypeRek
          dostępnego pod adresem <strong>typerek-ngk.pl</strong>.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold text-white">2. Jakie dane zbieramy</h2>
        <ul className="list-disc pl-5 space-y-1 text-gray-400">
          <li>Adres e-mail – do weryfikacji konta i komunikacji systemowej</li>
          <li>Nazwa użytkownika (nick) – wyświetlana publicznie w rankingu i czacie</li>
          <li>Wyniki typowań – zapisywane na potrzeby rankingu</li>
          <li>Zdjęcie profilowe (awatar) – opcjonalne, przechowywane w bazie danych</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold text-white">3. Cel przetwarzania</h2>
        <p>
          Dane przetwarzane są wyłącznie w celu świadczenia usługi typowania meczów
          piłkarskich w ramach zamkniętych lig. Podstawa prawna: art. 6 ust. 1 lit. b
          RODO (wykonanie umowy).
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold text-white">4. Zewnętrzni procesorzy danych</h2>
        <p>W celu świadczenia usługi korzystamy z następujących podmiotów zewnętrznych:</p>
        <ul className="list-disc pl-5 space-y-1 text-gray-400">
          <li><strong>Resend</strong> (resend.com) – wysyłka e-maili weryfikacyjnych i resetowania hasła</li>
          <li><strong>Google OAuth</strong> – opcjonalne logowanie przez konto Google (przekazywany jest tylko adres e-mail i awatar)</li>
          <li><strong>Supabase</strong> (supabase.com) – baza danych, w której gromadzone i przechowywane są wszystkie dane konta i typów</li>
          <li><strong>Railway</strong> – hosting backendu</li>
          <li><strong>Vercel</strong> – hosting frontendu</li>
        </ul>
        <p>Wszystkie podmioty przetwarzają dane zgodnie z RODO i posiadają odpowiednie certyfikaty (Privacy Shield / SCC).</p>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold text-white">5. Przechowywanie danych</h2>
        <p>
          Dane przechowywane są przez czas trwania konta. Po usunięciu konta wszystkie
          dane osobowe zostają trwale usunięte z bazy danych.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold text-white">6. Twoje prawa</h2>
        <ul className="list-disc pl-5 space-y-1 text-gray-400">
          <li>Prawo dostępu do danych</li>
          <li>Prawo do sprostowania danych</li>
          <li>Prawo do usunięcia danych (dostępne w ustawieniach profilu)</li>
          <li>Prawo do przenoszenia danych</li>
          <li>Prawo do wniesienia skargi do UODO (uodo.gov.pl)</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold text-white">7. Pliki cookie i localStorage</h2>
        <p>
          Serwis nie korzysta z plików cookie. W celu utrzymania sesji używamy
          mechanizmu <code className="text-gray-300 bg-gray-800 px-1 rounded">localStorage</code> przeglądarki
          do przechowywania tokenów JWT. Tokeny usuwane są po wylogowaniu lub wygaśnięciu sesji.
        </p>
      </section>
    </div>
  )
}
