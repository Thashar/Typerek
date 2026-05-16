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


@router.get("/sync")
async def debug_sync(db: Session = Depends(get_db)):
    try:
        from services import sync
        saved = await sync.sync_fixtures_for_days(db, days_ahead=7)
        return {"status": "ok", "synced": saved}
    except Exception as e:
        return {"status": "error", "detail": str(e), "trace": traceback.format_exc()}
