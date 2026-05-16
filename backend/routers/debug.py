import traceback
from fastapi import APIRouter
from core.database import engine

router = APIRouter(prefix="/api/debug", tags=["debug"])


@router.get("/db")
def test_db():
    try:
        with engine.connect() as conn:
            result = conn.execute(engine.dialect.statement_compiler(engine.dialect, None).__class__.__mro__[0].__init__)
    except Exception:
        pass

    try:
        from sqlalchemy import text
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return {"db": "ok"}
    except Exception as e:
        return {"db": "error", "detail": str(e), "trace": traceback.format_exc()}
