from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.orm import Session
from core.database import get_db
from core.config import settings
from services import sync

router = APIRouter(prefix="/api/cron", tags=["cron"])


def _verify_cron(authorization: str | None = Header(default=None)) -> None:
    """Vercel wysyla naglowek Authorization: Bearer CRON_SECRET."""
    expected = f"Bearer {settings.CRON_SECRET}"
    if not settings.CRON_SECRET or authorization != expected:
        raise HTTPException(status_code=401, detail="Unauthorized")


@router.get("/sync-matches")
async def cron_sync_matches(
    db: Session = Depends(get_db),
    _: None = Depends(_verify_cron),
):
    """Pobiera mecze na nastepne 7 dni. Uruchamiany co 1h przez Vercel Cron."""
    saved = await sync.sync_fixtures_for_days(db, days_ahead=7)
    return {"synced": saved}


@router.get("/update-results")
async def cron_update_results(
    db: Session = Depends(get_db),
    _: None = Depends(_verify_cron),
):
    """Aktualizuje wyniki meczy live i przelicza punkty. Uruchamiany co 15min."""
    updated = await sync.update_live_and_recent(db)
    return {"updated": updated}
