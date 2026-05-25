from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload
from core.database import get_db
from routers.deps import get_admin_user
from models.user import User
from models.match import Match, MatchStatus
from models.prediction import Prediction
from models.invite_code import InviteCode
from models.chat import ChatMessage
from models.private_league import PrivateLeague, PrivateLeagueMember
from services import ranking as ranking_svc


import re

class LeagueCodeRequest(BaseModel):
    code: str

class ChangeLeagueRequest(BaseModel):
    league_id: int | None = None

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
    rows = (
        db.query(
            User.id,
            User.username,
            User.email,
            User.is_admin,
            User.is_active,
            User.is_ranked,
            User.is_verified,
            User.created_at,
            func.coalesce(func.sum(Prediction.points), 0).label("total_points"),
        )
        .outerjoin(Prediction, Prediction.user_id == User.id)
        .group_by(User.id)
        .order_by(User.id)
        .all()
    )
    memberships = (
        db.query(PrivateLeagueMember.user_id, PrivateLeague.id, PrivateLeague.name)
        .join(PrivateLeague, PrivateLeagueMember.league_id == PrivateLeague.id)
        .all()
    )
    user_league = {m.user_id: {"league_id": m.id, "league_name": m.name} for m in memberships}
    return [
        {
            "id": r.id,
            "username": r.username,
            "email": r.email,
            "is_admin": r.is_admin,
            "is_active": r.is_active,
            "is_ranked": r.is_ranked,
            "is_verified": r.is_verified,
            "total_points": int(r.total_points),
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "league_id": user_league.get(r.id, {}).get("league_id"),
            "league_name": user_league.get(r.id, {}).get("league_name"),
        }
        for r in rows
    ]



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
    from models.chat import ChatMessage
    from models.private_league import PrivateLeague, PrivateLeagueMember
    db.query(Prediction).filter(Prediction.user_id == user_id).delete()
    db.query(ChatMessage).filter(ChatMessage.user_id == user_id).delete()
    db.query(PrivateLeagueMember).filter(PrivateLeagueMember.user_id == user_id).delete()
    owned = db.query(PrivateLeague).filter(PrivateLeague.owner_id == user_id).all()
    for league in owned:
        db.delete(league)
    db.query(InviteCode).filter(InviteCode.used_by_id == user_id).update(
        {"used_by_id": None, "used_at": None}
    )
    db.delete(target)
    db.commit()


@router.get("/users/{user_id}/predictions")
def user_predictions(
    user_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    from services.predictions import get_user_predictions
    return get_user_predictions(db, user_id)


@router.post("/users/{user_id}/verify")
def verify_user(
    user_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    from fastapi import HTTPException
    target = db.query(User).filter(User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Użytkownik nie istnieje")
    target.is_ranked = True
    db.commit()
    return {"verified": True}


@router.post("/verify-all-users")
def verify_all_users(
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    from sqlalchemy import text
    result = db.execute(text("UPDATE users SET is_ranked = TRUE WHERE is_ranked IS NOT TRUE"))
    db.commit()
    return {"count": result.rowcount}


@router.post("/unverify-all-users")
def unverify_all_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    from sqlalchemy import text
    result = db.execute(text("UPDATE users SET is_ranked = FALSE WHERE is_ranked IS TRUE AND id != :aid"), {"aid": current_user.id})
    db.commit()
    return {"count": result.rowcount}


@router.post("/recalculate-points")
def recalculate_points(
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    """Przelicz punkty dla wszystkich zakończonych meczów bez punktów."""
    sync._calculate_points_for_finished(db)
    db.commit()
    return {"detail": "ok"}


@router.post("/reset-all-points")
def reset_all_points(
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    from sqlalchemy import text
    db.execute(text("UPDATE predictions SET points = NULL"))
    db.commit()
    return {"detail": "ok"}


@router.delete("/chat", status_code=204)
def clear_chat(
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    db.query(ChatMessage).delete()
    db.commit()


@router.post("/sync-all")
async def admin_sync_all(
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    import asyncio
    from services import sync, football_api
    from datetime import date, datetime
    from models.settings import GameSettings

    from_date = date.today().isoformat()
    to_date = f"{date.today().year}-12-31"
    codes = ["WC", "CL", "PL", "SA", "PD", "FL1"]

    async def fetch_one(code):
        try:
            return code, await football_api.fetch_fixtures_by_competition(code, from_date, to_date)
        except Exception:
            return code, []

    fetched = await asyncio.gather(*[fetch_one(code) for code in codes])

    results = {}
    for code, fixtures in fetched:
        results[code] = sum(sync._upsert_fixture(db, f) for f in fixtures)

    sync._calculate_points_for_finished(db)

    gs = GameSettings.get(db)
    gs.last_synced_at = datetime.now(timezone.utc).replace(tzinfo=None)
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
    sync._calculate_points_for_finished(db)
    db.commit()
    return {"competition": comp_code, "synced": saved}


@router.get("/leagues")
def admin_get_leagues(
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    leagues = db.query(PrivateLeague).options(joinedload(PrivateLeague.members)).all()
    return [
        {
            "id": l.id,
            "name": l.name,
            "invite_code": l.invite_code,
            "owner_id": l.owner_id,
            "members_count": len(l.members),
            "created_at": l.created_at,
        }
        for l in leagues
    ]


@router.post("/leagues", status_code=201)
def admin_create_league(
    body: LeagueCodeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    code = body.code.strip().upper()
    if not re.match(r'^[A-Z0-9 ]{3,30}$', code) or code.strip() != code:
        raise HTTPException(status_code=400, detail="Nazwa może zawierać litery, cyfry i spacje (3–30 znaków, bez spacji na początku/końcu)")
    if db.query(PrivateLeague).filter(PrivateLeague.invite_code == code).first():
        raise HTTPException(status_code=400, detail="Liga z tym kodem już istnieje")
    league = PrivateLeague(name=code, invite_code=code, owner_id=current_user.id)
    db.add(league)
    db.commit()
    db.refresh(league)
    return {"id": league.id, "name": league.invite_code, "invite_code": league.invite_code, "owner_id": league.owner_id, "members_count": 0, "created_at": league.created_at}


@router.delete("/leagues/{league_id}", status_code=204)
def admin_delete_league(
    league_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    league = db.query(PrivateLeague).filter(PrivateLeague.id == league_id).first()
    if not league:
        raise HTTPException(status_code=404, detail="Liga nie istnieje")
    db.delete(league)
    db.commit()


@router.get("/leagues/{league_id}/ranking")
def admin_league_ranking(
    league_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    league = db.query(PrivateLeague).filter(PrivateLeague.id == league_id).first()
    if not league:
        raise HTTPException(status_code=404, detail="Liga nie istnieje")
    entries = ranking_svc.get_private_league_ranking(db, league_id)
    return {"entries": entries, "total": len(entries)}


@router.get("/leagues/{league_id}/ranking/live-changes")
def admin_league_ranking_live_changes(
    league_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    return ranking_svc.get_live_private_league_ranking_changes(db, league_id)


@router.post("/leagues/{league_id}/add-ranked")
def admin_add_ranked_to_league(
    league_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    league = db.query(PrivateLeague).filter(PrivateLeague.id == league_id).first()
    if not league:
        raise HTTPException(status_code=404, detail="Liga nie istnieje")
    already_assigned = {m.user_id for m in db.query(PrivateLeagueMember).all()}
    users_to_add = (
        db.query(User)
        .filter(User.is_ranked == True, User.is_active == True, User.id.notin_(already_assigned))
        .all()
    )
    for u in users_to_add:
        db.add(PrivateLeagueMember(league_id=league_id, user_id=u.id))
    db.commit()
    return {"added": len(users_to_add)}


@router.get("/debug/live")
async def debug_live(
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    """Diagnostyka: co widzi baza i co zwraca API dla meczów live."""
    from sqlalchemy import or_, and_
    from datetime import timedelta
    from services import football_api
    from services.sync import COMPETITION_CODES

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    window_start = now - timedelta(hours=3)

    # Mecze aktualnie LIVE w bazie
    live_in_db = db.query(Match).filter(Match.status == "live").all()

    # Mecze scheduled które powinny już trwać
    should_be_active = db.query(Match).filter(
        Match.kickoff <= now,
        Match.kickoff >= window_start,
        Match.status.notin_(["finished", "cancelled", "postponed"]),
    ).all()

    # Sprawdź co zwraca API
    api_results = {}
    api_errors = {}
    for code in COMPETITION_CODES:
        for status in ("IN_PLAY", "PAUSED"):
            key = f"{code}/{status}"
            try:
                data = await football_api._get(f"/competitions/{code}/matches", {"status": status})
                matches = data.get("matches", [])
                api_results[key] = [
                    {"id": m["id"], "home": m.get("homeTeam", {}).get("name"), "away": m.get("awayTeam", {}).get("name"), "status": m.get("status")}
                    for m in matches
                ]
            except Exception as e:
                api_errors[key] = str(e)

    return {
        "now_utc": now.isoformat(),
        "live_in_db": [{"id": m.id, "api_id": m.api_id, "home": m.home_team, "away": m.away_team, "kickoff_utc": m.kickoff.isoformat(), "status": m.status} for m in live_in_db],
        "should_be_active": [{"id": m.id, "api_id": m.api_id, "home": m.home_team, "away": m.away_team, "kickoff_utc": m.kickoff.isoformat(), "status": m.status} for m in should_be_active],
        "api_live_results": api_results,
        "api_errors": api_errors,
        "competition_codes": COMPETITION_CODES,
    }


@router.put("/users/{user_id}/league")
def change_user_league(
    user_id: int,
    body: ChangeLeagueRequest,
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    target = db.query(User).filter(User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Użytkownik nie istnieje")
    db.query(PrivateLeagueMember).filter(PrivateLeagueMember.user_id == user_id).delete()
    if body.league_id:
        league = db.query(PrivateLeague).filter(PrivateLeague.id == body.league_id).first()
        if not league:
            raise HTTPException(status_code=404, detail="Liga nie istnieje")
        db.add(PrivateLeagueMember(league_id=body.league_id, user_id=user_id))
    db.commit()
    return {"user_id": user_id, "league_id": body.league_id}
