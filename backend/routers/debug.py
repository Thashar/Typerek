import os
import traceback
from fastapi import APIRouter
from core.database import engine

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
