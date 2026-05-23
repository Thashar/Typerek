from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from core.database import get_db
from models.settings import GameSettings
from routers.deps import get_admin_user
from models.user import User

router = APIRouter(prefix="/api/settings", tags=["settings"])


class SettingsUpdate(BaseModel):
    points_exact: int
    points_outcome: int


@router.get("")
def get_settings(db: Session = Depends(get_db)):
    s = GameSettings.get(db)
    return {
        "points_exact": s.points_exact,
        "points_outcome": s.points_outcome,
        "last_synced_at": s.last_synced_at.isoformat() if s.last_synced_at else None,
    }


@router.put("")
def update_settings(body: SettingsUpdate, db: Session = Depends(get_db), _: User = Depends(get_admin_user)):
    s = GameSettings.get(db)
    s.points_exact = max(1, body.points_exact)
    s.points_outcome = max(0, body.points_outcome)
    db.commit()
    GameSettings.invalidate_cache()
    return {"points_exact": s.points_exact, "points_outcome": s.points_outcome}
