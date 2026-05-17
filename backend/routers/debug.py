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


@router.get("/sync")
async def debug_sync(db: Session = Depends(get_db)):
    try:
        from services import sync
        from services import football_api
        from datetime import date

        from_date = date.today().isoformat()
        to_date = f"{date.today().year}-12-31"

        results = {}
        for league_id, season in sync.BULK_LEAGUES:
            fixtures = await football_api.fetch_fixtures_by_league_season(league_id, season, from_date, to_date)
            results[f"league_{league_id}_s{season}"] = len(fixtures)

        total = await sync.sync_bulk_to_end_of_year(db)
        return {"status": "ok", "synced": total, "per_league": results}
    except Exception as e:
        return {"status": "error", "detail": str(e), "trace": traceback.format_exc()}
