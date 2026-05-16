import traceback
import re
from fastapi import APIRouter
from core.database import engine
from core.config import settings

router = APIRouter(prefix="/api/debug", tags=["debug"])


@router.get("/db")
def test_db():
    raw = settings.DATABASE_URL
    sanitized = re.sub(r":([^@]+)@", ":***@", raw)

    try:
        from sqlalchemy import text
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return {"db": "ok", "url": sanitized}
    except Exception as e:
        return {"db": "error", "url": sanitized, "url_repr": repr(raw[:50]), "detail": str(e), "trace": traceback.format_exc()}
