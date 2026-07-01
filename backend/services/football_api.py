import asyncio
import httpx
from datetime import datetime, timezone
from core.config import settings

_http_client: httpx.AsyncClient | None = None


def _client() -> httpx.AsyncClient:
    global _http_client
    if _http_client is None or _http_client.is_closed:
        _http_client = httpx.AsyncClient(timeout=8)
    return _http_client

_BASE_URL = "https://api.football-data.org/v4"

COMPETITIONS = {
    "WC":  {"id": 2000, "name": "FIFA World Cup", "country": "World", "season": 2026},
    "CL":  {"id": 2001, "name": "UEFA Champions League", "country": "Europe", "season": 2024},
    "PL":  {"id": 2021, "name": "Premier League", "country": "England", "season": 2024},
    "BL1": {"id": 2002, "name": "Bundesliga", "country": "Germany", "season": 2024},
    "SA":  {"id": 2019, "name": "Serie A", "country": "Italy", "season": 2024},
    "PD":  {"id": 2014, "name": "La Liga", "country": "Spain", "season": 2024},
    "FL1": {"id": 2015, "name": "Ligue 1", "country": "France", "season": 2024},
}


def _headers() -> dict:
    return {"X-Auth-Token": settings.FOOTBALL_DATA_API_KEY}


def _status_short(raw: str, minute: int | None = None) -> str:
    if raw == "IN_PLAY":
        return "2H" if (minute is not None and minute > 45) else "1H"
    return {
        "PAUSED": "HT",
        "EXTRA_TIME": "ET",
        "PENALTY_SHOOTOUT": "P",
        "FINISHED": "FT", "AWARDED": "FT", "WALKOVER": "FT",
        "POSTPONED": "PST",
        "CANCELLED": "CANC", "SUSPENDED": "CANC",
    }.get(raw, "NS")


def _score_90min(score: dict) -> tuple:
    """Zwraca wynik po 90 min (bez dogrywki i karnych).
    football-data.org w fullTime zwraca wynik skumulowany (wliczajac karne),
    wiec uzywamy regularTime gdy dostepne, lub odejmujemy penalties od fullTime.
    """
    ft = score.get("fullTime") or {}
    regular = score.get("regularTime") or {}
    pens = score.get("penalties") or {}
    if regular.get("home") is not None:
        return regular["home"], regular["away"]
    if pens.get("home") is not None and ft.get("home") is not None:
        return ft["home"] - pens["home"], ft["away"] - pens["away"]
    return ft.get("home"), ft.get("away")


def _to_fixture(m: dict, comp_code: str) -> dict:
    comp = COMPETITIONS.get(comp_code, {})
    utc = m.get("utcDate", "")
    try:
        ts = int(datetime.fromisoformat(utc.replace("Z", "+00:00")).timestamp())
    except Exception:
        ts = 0
    home_score, away_score = _score_90min(m.get("score", {}))
    minute = m.get("minute")
    return {
        "fixture": {
            "id": m["id"],
            "timestamp": ts,
            "status": {"short": _status_short(m.get("status", ""), minute), "elapsed": minute},
        },
        "league": {
            "id": comp.get("id", 0),
            "name": comp.get("name", ""),
            "country": comp.get("country", ""),
            "logo": m.get("competition", {}).get("emblem", ""),
            "season": comp.get("season", 2026),
        },
        "teams": {
            "home": {
                "name": m.get("homeTeam", {}).get("name") or "TBD",
                "logo": m.get("homeTeam", {}).get("crest", ""),
            },
            "away": {
                "name": m.get("awayTeam", {}).get("name") or "TBD",
                "logo": m.get("awayTeam", {}).get("crest", ""),
            },
        },
        "goals": {"home": home_score, "away": away_score},
        "stage": m.get("stage"),
        "group": m.get("group"),
    }


async def _get(path: str, params: dict = None) -> dict:
    r = await _client().get(f"{_BASE_URL}{path}", headers=_headers(), params=params or {})
    r.raise_for_status()
    return r.json()


async def fetch_fixtures_by_competition(comp_code: str, from_date: str, to_date: str) -> list[dict]:
    data = await _get(f"/competitions/{comp_code}/matches", {"dateFrom": from_date, "dateTo": to_date})
    return [_to_fixture(m, comp_code) for m in data.get("matches", [])]


async def fetch_live_fixtures(codes: list[str] | None = None) -> list[dict]:
    target_codes = codes if codes is not None else list(COMPETITIONS)

    async def _fetch_one(code: str) -> list[dict]:
        result = []
        # IN_PLAY = gra trwa; PAUSED = przerwa między połowami
        for status in ("IN_PLAY", "PAUSED"):
            try:
                data = await _get(f"/competitions/{code}/matches", {"status": status})
                result.extend(_to_fixture(m, code) for m in data.get("matches", []))
            except Exception:
                pass
        return result

    nested = await asyncio.gather(*[_fetch_one(code) for code in target_codes])
    return [item for sublist in nested for item in sublist]


async def fetch_fixtures_by_ids(fixture_ids: list[int], comp_codes: list[str] | None = None) -> list[dict]:
    """Pobiera mecze po ID. Najpierw odpytuje po kompetycji+dacie, a dla niezalezionych
    meczy robi pojedyncze zapytania do /matches/{id} — to gwarantuje ze ostatni live'owy
    mecz zawsze dostanie aktualny status, nawet jesli wypadnie z okna dat / kompetycji.
    """
    from datetime import date, timedelta
    codes = comp_codes if comp_codes is not None else list(COMPETITIONS)
    id_set = set(fixture_ids)
    today = date.today().isoformat()
    yesterday = (date.today() - timedelta(days=1)).isoformat()

    async def _fetch_one(code: str) -> list[dict]:
        try:
            data = await _get(f"/competitions/{code}/matches", {"dateFrom": yesterday, "dateTo": today})
            return [_to_fixture(m, code) for m in data.get("matches", []) if m["id"] in id_set]
        except Exception:
            return []

    nested = await asyncio.gather(*[_fetch_one(code) for code in codes])
    found = [item for sublist in nested for item in sublist]

    found_ids = {f["fixture"]["id"] for f in found}
    missing = [fid for fid in fixture_ids if fid not in found_ids]
    if missing:
        extra = await asyncio.gather(*[fetch_match_by_id(fid) for fid in missing])
        found.extend(f for f in extra if f is not None)

    return found


async def fetch_fixture_by_id_on_date(fixture_id: int, comp_code: str, match_date: str) -> dict | None:
    """Pobiera mecz po ID przez endpoint kompetycji+data. Dziala dla starych, zakonczonych
    meczy, w odroznieniu od /matches/{id}, ktory bywa niedostepny w darmowym planie API.
    Rzuca wyjatek przy bledzie HTTP (zamiast go polykac), zeby admin widzial realna przyczyne."""
    data = await _get(f"/competitions/{comp_code}/matches", {"dateFrom": match_date, "dateTo": match_date})
    for m in data.get("matches", []):
        if m["id"] == fixture_id:
            return _to_fixture(m, comp_code)
    return None


async def fetch_match_by_id(fixture_id: int) -> dict | None:
    """Pobiera pojedynczy mecz po ID — fallback gdy /competitions go nie zwraca."""
    try:
        return await fetch_match_by_id_raw(fixture_id)
    except Exception:
        return None


async def fetch_match_by_id_raw(fixture_id: int) -> dict | None:
    """Jak fetch_match_by_id, ale rzuca wyjatek przy bledzie HTTP zamiast go polykac."""
    data = await _get(f"/matches/{fixture_id}")
    match = data.get("match") if isinstance(data, dict) else None
    if not match:
        return None
    comp = match.get("competition", {}) or {}
    api_code = comp.get("code")
    if api_code and api_code in COMPETITIONS:
        return _to_fixture(match, api_code)
    # Lokalna kopia _to_fixture dla kompetycji spoza COMPETITIONS — minimalna,
    # gwarantuje ze status/scores dotra do _upsert_fixture (league_id juz w DB).
    utc = match.get("utcDate", "")
    try:
        ts = int(datetime.fromisoformat(utc.replace("Z", "+00:00")).timestamp())
    except Exception:
        ts = 0
    home_score, away_score = _score_90min(match.get("score", {}))
    minute = match.get("minute")
    return {
        "fixture": {
            "id": match["id"],
            "timestamp": ts,
            "status": {"short": _status_short(match.get("status", ""), minute), "elapsed": minute},
        },
        "league": {
            "id": comp.get("id", 0),
            "name": comp.get("name", ""),
            "country": comp.get("area", {}).get("name", ""),
            "logo": comp.get("emblem", ""),
            "season": (match.get("season", {}) or {}).get("startDate", "")[:4] or 2026,
        },
        "teams": {
            "home": {
                "name": match.get("homeTeam", {}).get("name") or "TBD",
                "logo": match.get("homeTeam", {}).get("crest", ""),
            },
            "away": {
                "name": match.get("awayTeam", {}).get("name") or "TBD",
                "logo": match.get("awayTeam", {}).get("crest", ""),
            },
        },
        "goals": {"home": home_score, "away": away_score},
        "stage": match.get("stage"),
        "group": match.get("group"),
    }
