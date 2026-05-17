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
    key = settings.FOOTBALL_DATA_API_KEY
    if not key:
        return {"status": "error", "detail": "FOOTBALL_DATA_API_KEY not set"}
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            r = await client.get(
                "https://api.football-data.org/v4/competitions/WC",
                headers={"X-Auth-Token": key},
            )
            data = r.json()
            return {"status": "ok", "code": r.status_code, "competition": data.get("name"), "season": data.get("currentSeason")}
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
    """Sprawdza dostepnosc turniejow w football-data.org."""
    from services import football_api
    from datetime import date

    from_date = date.today().isoformat()
    to_date = f"{date.today().year}-12-31"
    results = {}

    for code in ["WC", "NL", "EC"]:
        try:
            fixtures = await football_api.fetch_fixtures_by_competition(code, from_date, to_date)
            sample = [{"date": f["fixture"].get("timestamp"), "home": f["teams"]["home"]["name"], "away": f["teams"]["away"]["name"]} for f in fixtures[:2]]
            results[code] = {"count": len(fixtures), "sample": sample}
        except Exception as e:
            results[code] = {"error": str(e)}

    return results


@router.get("/sync/{comp_code}")
async def debug_sync_comp(comp_code: str, db: Session = Depends(get_db)):
    try:
        from services import sync, football_api
        from datetime import date
        from_date = date.today().isoformat()
        to_date = f"{date.today().year}-12-31"
        fixtures = await football_api.fetch_fixtures_by_competition(comp_code.upper(), from_date, to_date)
        saved = 0
        for f in fixtures:
            saved += sync._upsert_fixture(db, f)
        db.commit()
        return {"status": "ok", "competition": comp_code, "synced": saved}
    except Exception as e:
        return {"status": "error", "detail": str(e), "trace": traceback.format_exc()}
