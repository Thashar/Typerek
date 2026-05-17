from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from core.database import get_db
from routers.deps import get_admin_user
from models.user import User
from models.match import Match, MatchStatus
from models.prediction import Prediction

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/stats")
def admin_stats(
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    users = db.query(User).count()
    matches = db.query(Match).count()
    upcoming = db.query(Match).filter(Match.status == MatchStatus.SCHEDULED).count()
    predictions = db.query(Prediction).count()
    return {
        "users": users,
        "matches": matches,
        "upcoming_matches": upcoming,
        "predictions": predictions,
    }


@router.get("/users")
def admin_users(
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    users = db.query(User).order_by(User.id).all()
    return [
        {
            "id": u.id,
            "username": u.username,
            "email": u.email,
            "is_admin": u.is_admin,
            "is_active": u.is_active,
            "total_points": u.total_points,
            "created_at": u.created_at.isoformat() if u.created_at else None,
        }
        for u in users
    ]


@router.post("/sync/{comp_code}")
async def admin_sync_competition(
    comp_code: str,
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    from services import sync, football_api
    from datetime import date

    from_date = date.today().isoformat()
    to_date = f"{date.today().year}-12-31"

    fixtures = await football_api.fetch_fixtures_by_competition(comp_code.upper(), from_date, to_date)
    saved = 0
    for f in fixtures:
        saved += sync._upsert_fixture(db, f)
    db.commit()
    return {"competition": comp_code, "synced": saved}
