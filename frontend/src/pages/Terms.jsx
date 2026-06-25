import { Link } from 'react-router-dom'
import { usePageTitle } from '../hooks/usePageTitle'

export default function Terms() {
  usePageTitle('Regulamin')
  return (
    <div className="min-h-screen px-4 py-10 max-w-2xl mx-auto space-y-6 text-sm text-gray-300">
      <Link to="/login" className="text-brand-400 hover:underline text-xs">← Wróć</Link>

      <h1 className="text-2xl font-bold text-white">Regulamin serwisu TypeRek</h1>
      <p className="text-gray-500 text-xs">Ostatnia aktualizacja: czerwiec 2025</p>

      <section className="space-y-2">
        <h2 className="font-semibold text-white">1. Postanowienia ogólne</h2>
        <p>
          Serwis TypeRek dostępny pod adresem <strong>typerek-ngk.pl</strong> jest niekomercyjną
          platformą do typowania wyników meczów piłkarskich. Korzystanie z serwisu jest bezpłatne.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold text-white">2. Rejestracja i konto użytkownika</h2>
        <ul className="list-disc pl-5 space-y-1 text-gray-400">
          <li>Do korzystania z serwisu wymagane jest założenie konta i weryfikacja adresu e-mail.</li>
          <li>Użytkownik jest zobowiązany do podania prawdziwego adresu e-mail.</li>
          <li>Konto jest aktywowane ręcznie przez administratora po rejestracji.</li>
          <li>Użytkownik odpowiada za zachowanie poufności swoich danych logowania.</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold text-white">3. Zasady korzystania</h2>
        <ul className="list-disc pl-5 space-y-1 text-gray-400">
          <li>Serwis jest przeznaczony wyłącznie do celów rozrywkowych — bez stawek pieniężnych.</li>
          <li>Zabrania się używania automatycznych narzędzi (botów) do składania typów.</li>
          <li>Zabrania się udostępniania konta osobom trzecim.</li>
          <li>Zabrania się publikowania treści obraźliwych, niezgodnych z prawem lub naruszających prawa osób trzecich.</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold text-white">4. Typy i ranking</h2>
        <ul className="list-disc pl-5 space-y-1 text-gray-400">
          <li>Typy można składać do momentu rozpoczęcia meczu.</li>
          <li>Złożonego i zablokowanego typu nie można zmienić.</li>
          <li>Punktacja jest ustalana przez administratora i może ulec zmianie.</li>
          <li>Administrator zastrzega sobie prawo do korekty punktacji w przypadku błędów technicznych.</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold text-white">5. Odpowiedzialność</h2>
        <p>
          Serwis TypeRek jest udostępniany w stanie „takim, jaki jest". Administrator nie ponosi
          odpowiedzialności za przerwy w działaniu serwisu, błędy techniczne ani utratę danych.
          Serwis nie gwarantuje ciągłości działania.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold text-white">6. Usunięcie konta</h2>
        <p>
          Użytkownik może w każdej chwili poprosić o usunięcie konta kontaktując się z administratorem.
          Po usunięciu konta wszystkie dane osobowe zostają trwale usunięte z bazy danych.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold text-white">7. Zmiany regulaminu</h2>
        <p>
          Administrator zastrzega sobie prawo do zmiany regulaminu. O istotnych zmianach
          użytkownicy będą informowani przez serwis. Dalsze korzystanie z serwisu po wprowadzeniu
          zmian oznacza akceptację nowego regulaminu.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold text-white">8. Prawo właściwe</h2>
        <p>
          Regulamin podlega prawu polskiemu. Wszelkie spory będą rozstrzygane przez sąd
          właściwy dla siedziby administratora.
        </p>
      </section>

      <p className="text-gray-500 text-xs pt-4">
        <Link to="/privacy" className="text-brand-400 hover:underline">Polityka prywatności</Link>
      </p>
    </div>
  )
}
