from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from core.database import get_db
from routers.deps import get_admin_user
from models.user import User
from models.match import Match, MatchStatus
from models.prediction import Prediction
from models.invite_code import InviteCode

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


@router.get("/invite-codes")
def list_invite_codes(
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    codes = (
        db.query(InviteCode)
        .filter(
            (InviteCode.used_by_id.is_(None)) |
            (InviteCode.expires_at > now)
        )
        .order_by(InviteCode.created_at.desc())
        .limit(50)
        .all()
    )
    return [
        {
            "id": c.id,
            "code": c.code,
            "expires_at": c.expires_at.isoformat(),
            "is_used": c.used_by_id is not None,
            "is_expired": now > c.expires_at,
            "used_by_id": c.used_by_id,
        }
        for c in codes
    ]


@router.post("/invite-codes")
def generate_invite_code(
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    code = InviteCode.generate(db)
    db.add(code)
    db.commit()
    db.refresh(code)
    return {"code": code.code, "expires_at": code.expires_at.isoformat()}


@router.delete("/invite-codes/{code_str}")
def delete_invite_code(
    code_str: str,
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    code = db.query(InviteCode).filter(InviteCode.code == code_str.upper()).first()
    if code:
        db.delete(code)
        db.commit()
    return {"deleted": True}


@router.delete("/users/{user_id}", status_code=204)
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    from fastapi import HTTPException
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Nie możesz usunąć własnego konta")
    target = db.query(User).filter(User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Użytkownik nie istnieje")
    if target.is_admin:
        raise HTTPException(status_code=400, detail="Nie można usunąć administratora")
    db.query(Prediction).filter(Prediction.user_id == user_id).delete()
    db.query(InviteCode).filter(InviteCode.used_by_id == user_id).update(
        {"used_by_id": None, "used_at": None}
    )
    db.delete(target)
    db.commit()


@router.post("/sync-all")
async def admin_sync_all(
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    from services import sync, football_api
    from datetime import date

    from_date = date.today().isoformat()
    to_date = f"{date.today().year}-12-31"
    codes = ["WC", "CL", "PL", "SA", "PD", "FL1"]
    results = {}
    for code in codes:
        try:
            fixtures = await football_api.fetch_fixtures_by_competition(code, from_date, to_date)
            saved = sum(sync._upsert_fixture(db, f) for f in fixtures)
            results[code] = saved
        except Exception:
            results[code] = 0
    db.commit()
    return {"results": results, "total": sum(results.values())}


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
