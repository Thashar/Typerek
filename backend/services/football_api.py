import httpx
from datetime import datetime, timezone
from core.config import settings

_BASE_URL = "https://api.football-data.org/v4"

COMPETITIONS = {
    "WC": {"id": 2000, "name": "FIFA World Cup", "country": "World", "season": 2026},
    "NL": {"id": 2019, "name": "UEFA Nations League", "country": "Europe", "season": 2024},
    "EC": {"id": 2018, "name": "UEFA Euro", "country": "Europe", "season": 2024},
}


def _headers() -> dict:
    return {"X-Auth-Token": settings.FOOTBALL_DATA_API_KEY}


def _status_short(status: str) -> str:
    return {
        "SCHEDULED": "NS", "TIMED": "NS",
        "IN_PLAY": "1H", "PAUSED": "HT",
        "FINISHED": "FT", "AWARDED": "FT", "WALKOVER": "FT",
        "POSTPONED": "PST",
        "CANCELLED": "CANC", "SUSPENDED": "CANC",
    }.get(status, "NS")


def _to_fixture(m: dict, comp_code: str) -> dict:
    comp = COMPETITIONS.get(comp_code, {})
    utc = m.get("utcDate", "")
    try:
        ts = int(datetime.fromisoformat(utc.replace("Z", "+00:00")).timestamp())
    except Exception:
        ts = 0
    ft = m.get("score", {}).get("fullTime", {})
    return {
        "fixture": {
            "id": m["id"],
            "timestamp": ts,
            "status": {"short": _status_short(m.get("status", ""))},
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
    }


async def _get(path: str, params: dict = None) -> dict:
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.get(f"{_BASE_URL}{path}", headers=_headers(), params=params or {})
        r.raise_for_status()
        return r.json()


async def fetch_fixtures_by_competition(comp_code: str, from_date: str, to_date: str) -> list[dict]:
    data = await _get(f"/competitions/{comp_code}/matches", {"dateFrom": from_date, "dateTo": to_date})
    return [_to_fixture(m, comp_code) for m in data.get("matches", [])]


async def fetch_live_fixtures() -> list[dict]:
    results = []
    for code in COMPETITIONS:
        try:
            data = await _get(f"/competitions/{code}/matches", {"status": "IN_PLAY"})
            results.extend(_to_fixture(m, code) for m in data.get("matches", []))
        except Exception:
            pass
    return results


async def fetch_fixtures_by_ids(fixture_ids: list[int]) -> list[dict]:
    results = []
    for code in COMPETITIONS:
        try:
            data = await _get(f"/competitions/{code}/matches", {"status": "FINISHED"})
            for m in data.get("matches", []):
                if m["id"] in fixture_ids:
                    results.append(_to_fixture(m, code))
        except Exception:
            pass
    return results
