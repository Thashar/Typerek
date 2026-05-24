from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from core.database import get_db
from routers.deps import get_current_user
from models.user import User
from models.private_league import PrivateLeague, PrivateLeagueMember
from schemas.private_league import CreateLeagueRequest, JoinLeagueRequest, PrivateLeagueResponse
from schemas.ranking import RankingResponse
from services import ranking as ranking_svc

router = APIRouter(prefix="/api/leagues", tags=["leagues"])


def _to_response(league: PrivateLeague) -> dict:
    return {
        "id": league.id,
        "name": league.name,
        "invite_code": league.invite_code,
        "owner_id": league.owner_id,
        "created_at": league.created_at,
        "members_count": len(league.members),
    }


@router.post("", response_model=PrivateLeagueResponse, status_code=201)
def create_league(
    body: CreateLeagueRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    league = PrivateLeague(
        name=body.name,
        invite_code=PrivateLeague.generate_invite_code(),
        owner_id=current_user.id,
    )
    db.add(league)
    db.flush()
    member = PrivateLeagueMember(league_id=league.id, user_id=current_user.id)
    db.add(member)
    db.commit()
    db.refresh(league)
    return _to_response(league)


@router.post("/join", response_model=PrivateLeagueResponse)
def join_league(
    body: JoinLeagueRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    league = db.query(PrivateLeague).options(joinedload(PrivateLeague.members)).filter(
        PrivateLeague.invite_code == body.invite_code.strip().upper()
    ).first()
    if not league:
        raise HTTPException(status_code=404, detail="Nieprawidłowy kod zaproszenia")

    already = any(m.user_id == current_user.id for m in league.members)
    if already:
        raise HTTPException(status_code=400, detail="Jesteś już członkiem tej ligi")

    db.add(PrivateLeagueMember(league_id=league.id, user_id=current_user.id))
    db.commit()
    db.refresh(league)
    return _to_response(league)


@router.get("/me", response_model=list[PrivateLeagueResponse])
def my_leagues(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    memberships = (
        db.query(PrivateLeagueMember)
        .filter(PrivateLeagueMember.user_id == current_user.id)
        .all()
    )
    league_ids = [m.league_id for m in memberships]
    leagues = (
        db.query(PrivateLeague)
        .options(joinedload(PrivateLeague.members))
        .filter(PrivateLeague.id.in_(league_ids))
        .all()
    )
    return [_to_response(l) for l in leagues]


@router.get("/{league_id}", response_model=PrivateLeagueResponse)
def get_league(
    league_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    league = db.query(PrivateLeague).options(joinedload(PrivateLeague.members)).filter(
        PrivateLeague.id == league_id
    ).first()
    if not league:
        raise HTTPException(status_code=404, detail="Liga nie istnieje")
    is_member = any(m.user_id == current_user.id for m in league.members)
    if not is_member:
        raise HTTPException(status_code=403, detail="Nie jesteś członkiem tej ligi")
    return _to_response(league)


@router.get("/{league_id}/ranking", response_model=RankingResponse)
def league_ranking(
    league_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    league = db.query(PrivateLeague).options(joinedload(PrivateLeague.members)).filter(
        PrivateLeague.id == league_id
    ).first()
    if not league:
        raise HTTPException(status_code=404, detail="Liga nie istnieje")
    is_member = any(m.user_id == current_user.id for m in league.members)
    if not is_member:
        raise HTTPException(status_code=403, detail="Nie jesteś członkiem tej ligi")
    entries = ranking_svc.get_private_league_ranking(db, league_id)
    return {"entries": entries, "total": len(entries)}


@router.get("/{league_id}/ranking/live-changes")
def league_ranking_live_changes(
    league_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    league = db.query(PrivateLeague).options(joinedload(PrivateLeague.members)).filter(
        PrivateLeague.id == league_id
    ).first()
    if not league:
        raise HTTPException(status_code=404, detail="Liga nie istnieje")
    is_member = any(m.user_id == current_user.id for m in league.members)
    if not is_member:
        raise HTTPException(status_code=403, detail="Nie jesteś członkiem tej ligi")
    return ranking_svc.get_live_private_league_ranking_changes(db, league_id)


@router.delete("/{league_id}/leave", status_code=204)
def leave_league(
    league_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    league = db.query(PrivateLeague).filter(PrivateLeague.id == league_id).first()
    if not league:
        raise HTTPException(status_code=404, detail="Liga nie istnieje")
    if league.owner_id == current_user.id:
        raise HTTPException(status_code=400, detail="Właściciel nie może opuścić ligi — usuń ją zamiast tego")
    member = db.query(PrivateLeagueMember).filter(
        PrivateLeagueMember.league_id == league_id,
        PrivateLeagueMember.user_id == current_user.id,
    ).first()
    if not member:
        raise HTTPException(status_code=404, detail="Nie jesteś członkiem tej ligi")
    db.delete(member)
    db.commit()
