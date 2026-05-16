from datetime import date, timedelta
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session, joinedload
from core.database import get_db
from models.match import Match, MatchStatus
from schemas.match import MatchResponse, MatchListResponse

router = APIRouter(prefix="/api/matches", tags=["matches"])


@router.get("", response_model=MatchListResponse)
def get_matches(
    from_date: date = Query(default_factory=date.today),
    to_date: date = Query(default_factory=lambda: date.today() + timedelta(days=7)),
    status: MatchStatus | None = Query(default=None),
    league_id: int | None = Query(default=None),
    db: Session = Depends(get_db),
):
    q = db.query(Match).options(joinedload(Match.league))
    q = q.filter(Match.kickoff >= from_date, Match.kickoff < to_date + timedelta(days=1))
    if status:
        q = q.filter(Match.status == status)
    if league_id:
        q = q.filter(Match.league_id == league_id)
    q = q.order_by(Match.kickoff)
    matches = q.all()
    return {"matches": matches, "total": len(matches)}


@router.get("/today", response_model=MatchListResponse)
def get_today(db: Session = Depends(get_db)):
    today = date.today()
    matches = (
        db.query(Match)
        .options(joinedload(Match.league))
        .filter(Match.kickoff >= today, Match.kickoff < today + timedelta(days=1))
        .order_by(Match.kickoff)
        .all()
    )
    return {"matches": matches, "total": len(matches)}


@router.get("/live", response_model=MatchListResponse)
def get_live(db: Session = Depends(get_db)):
    matches = (
        db.query(Match)
        .options(joinedload(Match.league))
        .filter(Match.status == MatchStatus.LIVE)
        .order_by(Match.kickoff)
        .all()
    )
    return {"matches": matches, "total": len(matches)}


@router.get("/{match_id}", response_model=MatchResponse)
def get_match(match_id: int, db: Session = Depends(get_db)):
    from fastapi import HTTPException
    match = db.query(Match).options(joinedload(Match.league)).filter(Match.id == match_id).first()
    if not match:
        raise HTTPException(status_code=404, detail="Mecz nie istnieje")
    return match
