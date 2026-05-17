import os
import traceback
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from core.database import engine, get_db

router = APIRouter(prefix="/api/debug", tags=["debug"])


@router.get("/db")
def test_db():
    raw_env = os.environ.get("DATABASE_URL", "NOT_SET")
    safe_repr = repr(raw_env[-30:])

    try:
        from sqlalchemy import text
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return {"db": "ok", "url_tail": safe_repr}
    except Exception as e:
        return {"db": "error", "url_tail": safe_repr, "detail": str(e)}


@router.get("/apicheck")
async def debug_apicheck():
    import httpx
    from core.config import settings
    key = settings.API_FOOTBALL_KEY
    if not key:
        return {"status": "error", "detail": "API_FOOTBALL_KEY not set"}
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            r = await client.get(
                "https://v3.football.api-sports.io/status",
                headers={"x-apisports-key": key},
            )
            return {"status": "ok", "code": r.status_code, "body": r.json()}
    except Exception as e:
        return {"status": "error", "detail": str(e)}


@router.get("/league-check")
async def debug_league_check():
    """Sprawdza dostepnosc lig - bez filtra daty, tylko league+season."""
    import httpx
    from core.config import settings

    key = settings.API_FOOTBALL_KEY
    results = {}

    checks = [
        (1, 2026, "WorldCup_2026"),
        (10, 2026, "Friendlies_2026"),
        (10, 2025, "Friendlies_2025"),
        (106, 2025, "Ekstraklasa_2025"),
        (106, 2026, "Ekstraklasa_2026"),
        (3, 2025, "UEFA_Euro_2025"),
    ]

    for league_id, season, name in checks:
        try:
            async with httpx.AsyncClient(timeout=8) as client:
                r = await client.get(
                    "https://v3.football.api-sports.io/fixtures",
                    headers={"x-apisports-key": key},
                    params={"league": league_id, "season": season},
                )
                data = r.json()
                results[name] = {
                    "count": data.get("results", 0),
                    "errors": data.get("errors", {}),
                }
        except Exception as e:
            results[name] = {"error": str(e)}
    return results


@router.get("/sync-check")
async def debug_sync_check():
    """Sprawdza co API zwraca dla dzisiejszej daty i rozne sezony per liga."""
    from services import football_api
    from datetime import date
    import httpx
    from core.config import settings

    today = date.today().isoformat()
    results = {}

    # 1. Co jest dzisiaj (bez filtra ligi)
    try:
        today_fixtures = await football_api.fetch_fixtures(today)
        results["today_all"] = {
            "count": len(today_fixtures),
            "leagues": list({f["league"]["id"]: f["league"]["name"] for f in today_fixtures}.items())[:10],
        }
    except Exception as e:
        results["today_all"] = {"error": str(e)}

    # 2. Sprawdz rozne sezony per liga
    checks = [
        (1, 2026, "WorldCup_s2026"),
        (10, 2026, "Friendlies_s2026"),
        (10, 2025, "Friendlies_s2025"),
        (106, 2025, "Ekstraklasa_s2025"),
        (106, 2026, "Ekstraklasa_s2026"),
    ]
    from_date = today
    to_date = f"{date.today().year}-12-31"

    for league_id, season, key in checks:
        try:
            fixtures = await football_api.fetch_fixtures_by_league_season(league_id, season, from_date, to_date)
            results[key] = len(fixtures)
        except Exception as e:
            results[key] = f"error: {e}"

    return results
