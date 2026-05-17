from datetime import date, timedelta
from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload
from core.database import get_db
from core.translations import translate_team, translate_country
from models.match import Match, MatchStatus
from schemas.match import MatchResponse, MatchListResponse

router = APIRouter(prefix="/api/matches", tags=["matches"])


@router.get("/leagues")
def get_match_leagues(db: Session = Depends(get_db)):
    from models.league import League
    today = date.today()
    leagues = (
        db.query(League)
        .join(Match, Match.league_id == League.id)
        .filter(Match.kickoff >= today)
        .distinct()
        .order_by(League.name)
        .all()
    )
    return [{"id": l.id, "name": l.name, "country": translate_country(l.country), "logo_url": l.logo_url} for l in leagues]


@router.get("/dates")
def get_match_dates(
    from_date: date = Query(default_factory=date.today),
    to_date: date = Query(default_factory=lambda: date.today() + timedelta(days=180)),
    league_id: int | None = Query(default=None),
    db: Session = Depends(get_db),
):
    q = (
        db.query(func.date(Match.kickoff))
        .filter(Match.kickoff >= from_date, Match.kickoff <= to_date + timedelta(days=1))
    )
    if league_id:
        q = q.filter(Match.league_id == league_id)
    results = q.distinct().order_by(func.date(Match.kickoff)).all()
    return [str(r[0]) for r in results if r[0]]


@router.get("/worldcup")
def get_worldcup_matches(db: Session = Depends(get_db)):
    from models.league import League
    wc_league = db.query(League).filter(League.api_id == 2000).first()
    if not wc_league:
        return {"groups": {}, "knockout": {}}
    matches = (
        db.query(Match)
        .filter(Match.league_id == wc_league.id)
        .order_by(Match.kickoff)
        .all()
    )
    groups = {}
    knockout = {}
    for m in matches:
        if m.stage == "GROUP_STAGE":
            raw = m.match_group or "?"
            g = raw.replace("GROUP_", "") if raw.startswith("GROUP_") else raw
            groups.setdefault(g, []).append(m)
        else:
            s = m.stage or "OTHER"
            knockout.setdefault(s, []).append(m)

    def fmt(m):
        return {
            "id": m.id,
            "home_team": translate_team(m.home_team),
            "away_team": translate_team(m.away_team),
            "home_team_logo": m.home_team_logo, "away_team_logo": m.away_team_logo,
            "kickoff": m.kickoff.isoformat(), "status": m.status,
            "home_score": m.home_score, "away_score": m.away_score,
            "stage": m.stage, "match_group": m.match_group,
        }

    return {
        "groups": {k: [fmt(m) for m in v] for k, v in sorted(groups.items())},
        "knockout": {k: [fmt(m) for m in v] for k, v in knockout.items()},
    }


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
