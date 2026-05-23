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


def _to_fixture(m: dict, comp_code: str) -> dict:
    comp = COMPETITIONS.get(comp_code, {})
    utc = m.get("utcDate", "")
    try:
        ts = int(datetime.fromisoformat(utc.replace("Z", "+00:00")).timestamp())
    except Exception:
        ts = 0
    ft = m.get("score", {}).get("fullTime", {})
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
        "goals": {"home": ft.get("home"), "away": ft.get("away")},
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


async def fetch_live_fixtures() -> list[dict]:
    async def _fetch_one(code: str) -> list[dict]:
        try:
            data = await _get(f"/competitions/{code}/matches", {"status": "IN_PLAY"})
            return [_to_fixture(m, code) for m in data.get("matches", [])]
        except Exception:
            return []

    nested = await asyncio.gather(*[_fetch_one(code) for code in COMPETITIONS])
    return [item for sublist in nested for item in sublist]


async def fetch_fixtures_by_ids(fixture_ids: list[int], comp_codes: list[str] | None = None) -> list[dict]:
    """Pobiera zakończone mecze tylko dla podanych kompetycji (domyślnie wszystkie)."""
    codes = comp_codes if comp_codes is not None else list(COMPETITIONS)
    id_set = set(fixture_ids)

    async def _fetch_one(code: str) -> list[dict]:
        try:
            data = await _get(f"/competitions/{code}/matches", {"status": "FINISHED"})
            return [_to_fixture(m, code) for m in data.get("matches", []) if m["id"] in id_set]
        except Exception:
            return []

    nested = await asyncio.gather(*[_fetch_one(code) for code in codes])
    return [item for sublist in nested for item in sublist]
