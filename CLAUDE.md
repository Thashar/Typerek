# CLAUDE.md — Zasady współpracy w projekcie Typerek

## Workflow git

- Po zakończeniu każdego etapu pracy robimy commit na branch `main` i od razu pushujemy do GitHub.
- Commit tylko na `main` — nie tworzymy osobnych branchy, chyba że użytkownik wyraźnie poprosi.
- Wiadomość commita: zwięzła, po polsku lub angielsku, opisuje co zostało zrobione.
- Nie commitujemy niezakończonej pracy — każdy commit powinien być działającym stanem projektu.
- Format commita:

```
git commit -m "$(cat <<'EOF'
Opis zmian

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
git push origin main
```

## Ogólne zasady

- Nie tworzymy zbędnych plików dokumentacji ani komentarzy w kodzie.
- Kod powinien być czysty i minimalny — bez niepotrzebnych abstrakcji.
- Pytamy użytkownika przed ryzykownymi lub nieodwracalnymi operacjami.

---

## Mapa projektu

### Stack
- **Frontend**: React + Vite + Tailwind, `frontend/src/`
- **Backend**: FastAPI + SQLAlchemy + PostgreSQL, `backend/`
- **Deploy**: Vercel (frontend + backend jako serverless), wejście: `api/index.py`
- **Email**: Resend API (`backend/core/email.py`)
- **Dane meczowe**: football-data.org API v4 (`backend/services/football_api.py`)
- **Domena produkcyjna**: `typerek-ngk.pl` (i alias `typerek-ngk.vercel.app`)

### Backend — kluczowe pliki

| Plik | Co robi |
|------|---------|
| `backend/main.py` | FastAPI app, rejestracja routerów |
| `backend/core/config.py` | Zmienne środowiskowe (Settings) |
| `backend/core/database.py` | Silnik SQLAlchemy |
| `backend/core/email.py` | Wysyłka maili przez Resend |
| `backend/models/user.py` | Model użytkownika (is_verified, is_ranked, is_admin) |
| `backend/models/match.py` | Model meczu (MatchStatus enum: scheduled/live/finished/...) |
| `backend/models/prediction.py` | Model typu, logika punktacji (`calculate_points`) |
| `backend/models/settings.py` | GameSettings (points_exact, points_outcome) |
| `backend/routers/auth.py` | Rejestracja, login, weryfikacja emaila, reset hasła |
| `backend/routers/predictions.py` | CRUD typów + `/user/{id}` dla publicznych typów |
| `backend/routers/ranking.py` | Ranking globalny + `/live-changes` |
| `backend/routers/admin.py` | Panel admina — lista użytkowników, weryfikacja |
| `backend/routers/cron.py` | Endpointy cronów (sync-matches, update-results) |
| `backend/services/sync.py` | Synchronizacja meczów z API |
| `backend/services/ranking.py` | Logika rankingu + live-changes |
| `backend/services/auth.py` | Logika logowania (blokuje login gdy is_verified=False) |

### Frontend — kluczowe pliki

| Plik | Co robi |
|------|---------|
| `frontend/src/App.jsx` | Router, ochrona tras przez Layout |
| `frontend/src/components/Layout.jsx` | Navbar, wymaga zalogowania (redirect do /login) |
| `frontend/src/components/MatchCard.jsx` | Karta meczu na stronie głównej |
| `frontend/src/components/PredHistory.jsx` | Grupowana historia typów (dzień → liga), PredRow |
| `frontend/src/pages/Matches.jsx` | Strona główna — mecze wg ligi i dnia |
| `frontend/src/pages/WorldCup.jsx` | Widok grupowy Mundialowy |
| `frontend/src/pages/Profile.jsx` | Profil użytkownika + historia typów |
| `frontend/src/pages/Ranking.jsx` | Ranking + live zmiany + typy użytkownika po kliknięciu |
| `frontend/src/pages/Register.jsx` | Rejestracja |
| `frontend/src/pages/Admin.jsx` | Panel admina |
| `frontend/src/context/AuthContext.jsx` | Globalny stan auth (user, login, register, logout) |
| `frontend/src/api/client.js` | Axios z interceptorem (auto-refresh tokenu, redirect na /login przy 401) |

### Crony (cron-job.org)
- `GET /api/cron/sync-matches` — synchronizacja meczów na 7 dni do przodu (co 1h)
- `GET /api/cron/update-results` — aktualizacja wyników live i przeliczanie punktów (co 15 min)
- Wymagają nagłówka `Authorization: Bearer <CRON_SECRET>`
- URL produkcyjny: `https://typerek-ngk.pl/api/cron/...`

---

## Znane pułapki i uwagi

### Statusy meczów — zawsze lowercase
`MatchStatus` w bazie i API zwraca wartości **lowercase**: `scheduled`, `live`, `finished`, `postponed`, `cancelled`.
W `WorldCup.jsx` był błąd z uppercase (`'LIVE'`, `'FINISHED'`) — poprawione. Uważaj przy nowych komponentach.

### Błędy 422 z FastAPI — detail jako tablica
Gdy Pydantic waliduje dane wejściowe i rzuca błąd (np. zła nazwa użytkownika), FastAPI zwraca `detail` jako **tablicę obiektów**, nie string. Frontend musi to obsługiwać — przykład w `Register.jsx`:
```js
const detail = err.response?.data?.detail
if (Array.isArray(detail)) setError(detail.map(d => d.msg).join(', '))
else setError(detail || 'Błąd')
```

### Dwa pola weryfikacji użytkownika
- `is_verified` — email potwierdzony (przez link w mailu). Blokuje login jeśli `False`.
- `is_ranked` — ręcznie ustawiane przez admina. Decyduje o widoczności w rankingu.

### Typy publiczne w rankingu — tylko finished/live
Endpoint `/api/predictions/user/{id}` zwraca tylko typy na mecze `finished` lub `live` — nie ujawniamy przyszłych typów innych graczy.

### Punktacja
Wartości domyślne w modelu (`POINTS_EXACT=5`, `POINTS_OUTCOME=2`) — ale faktyczne wartości są w `GameSettings` w bazie. Zawsze używaj `GameSettings.get(db)` przy obliczaniu punktów.

### Axios interceptor — pułapka przy 401
`frontend/src/api/client.js` automatycznie próbuje odświeżyć token przy 401. Jeśli refresh się nie uda — `localStorage.clear()` i redirect na `/login`. Rejestracja nie dotyczy (brak tokenu).

### COMPETITION_CODES w sync.py
`backend/services/sync.py` ma `COMPETITION_CODES = ["WC"]` — tylko Mundial jest syncowany przez cron. Aby dodać inne ligi do automatycznej synchronizacji, dodaj kod tutaj.
