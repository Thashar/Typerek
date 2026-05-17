import httpx
from core.config import settings

_BASE_URL = "https://v3.football.api-sports.io"
_RAPIDAPI_BASE = "https://api-football-v1.p.rapidapi.com/v3"


def _headers() -> dict:
    if settings.API_FOOTBALL_VIA_RAPIDAPI:
        return {
            "X-RapidAPI-Key": settings.API_FOOTBALL_KEY,
            "X-RapidAPI-Host": "api-football-v1.p.rapidapi.com",
        }
    return {"x-apisports-key": settings.API_FOOTBALL_KEY}


def _base() -> str:
    return _RAPIDAPI_BASE if settings.API_FOOTBALL_VIA_RAPIDAPI else _BASE_URL


async def _get(path: str, params: dict) -> dict:
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.get(f"{_base()}{path}", headers=_headers(), params=params)
        r.raise_for_status()
        return r.json()


async def fetch_fixtures(date: str) -> list[dict]:
    """Pobiera mecze na dany dzien (YYYY-MM-DD)."""
    data = await _get("/fixtures", {"date": date, "timezone": "Europe/Warsaw"})
    return data.get("response", [])


async def fetch_fixtures_by_league_season(league_id: int, season: int, from_date: str, to_date: str) -> list[dict]:
    """Pobiera wszystkie mecze danej ligi w sezonie w zakresie dat."""
    data = await _get("/fixtures", {
        "league": league_id,
        "season": season,
        "from": from_date,
        "to": to_date,
        "timezone": "Europe/Warsaw",
    })
    return data.get("response", [])


async def fetch_fixtures_by_ids(fixture_ids: list[int]) -> list[dict]:
    """Pobiera szczegoly konkretnych meczy (max 20 na raz)."""
    ids_str = "-".join(str(i) for i in fixture_ids[:20])
    data = await _get("/fixtures", {"ids": ids_str})
    return data.get("response", [])


async def fetch_live_fixtures() -> list[dict]:
    """Pobiera aktualnie trwajace mecze."""
    data = await _get("/fixtures", {"live": "all"})
    return data.get("response", [])


async def fetch_leagues(season: int) -> list[dict]:
    """Pobiera wszystkie dostepne ligi dla danego sezonu."""
    data = await _get("/leagues", {"season": season, "current": "true"})
    return data.get("response", [])
