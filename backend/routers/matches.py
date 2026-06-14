from datetime import date, timedelta, datetime, timezone
from zoneinfo import ZoneInfo
from fastapi import APIRouter, Depends, Query, WebSocket, WebSocketDisconnect
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload
from core.database import get_db
from core.translations import translate_team, translate_country
from core.ws import match_manager
from models.match import Match, MatchStatus
from schemas.match import MatchResponse, MatchListResponse

router = APIRouter(prefix="/api/matches", tags=["matches"])

_TZ = ZoneInfo('Europe/Warsaw')


def _today_warsaw() -> date:
    return datetime.now(_TZ).date()


def _date_to_utc_range(d: date) -> tuple[datetime, datetime]:
    """Return naive UTC [start, end) for a given Warsaw calendar date."""
    start = datetime(d.year, d.month, d.day, tzinfo=_TZ)
    return (
        start.astimezone(timezone.utc).replace(tzinfo=None),
        (start + timedelta(days=1)).astimezone(timezone.utc).replace(tzinfo=None),
    )


def _warsaw_date_expr():
    """SQLAlchemy expression: Warsaw calendar date of a UTC-stored kickoff."""
    return func.date(func.timezone('Europe/Warsaw', func.timezone('UTC', Match.kickoff)))


def _wc_league_id(db: Session) -> int | None:
    from models.settings import GameSettings
    from models.league import League
    if not GameSettings.get(db).world_cup_only:
        return None
    wc = db.query(League.id).filter(League.api_id == 2000).scalar()
    return wc


@router.get("/leagues")
def get_match_leagues(db: Session = Depends(get_db)):
    from models.league import League
    from_utc, _ = _date_to_utc_range(_today_warsaw())
    q = (
        db.query(League)
        .join(Match, Match.league_id == League.id)
        .filter(Match.kickoff >= from_utc)
        .distinct()
        .order_by(League.name)
    )
    wc_id = _wc_league_id(db)
    if wc_id:
        q = q.filter(League.id == wc_id)
    return [{"id": l.id, "name": l.name, "country": translate_country(l.country), "logo_url": l.logo_url} for l in q.all()]


@router.get("/dates")
def get_match_dates(
    from_date: date = Query(default=None),
    to_date: date = Query(default=None),
    league_id: int | None = Query(default=None),
    db: Session = Depends(get_db),
):
    if from_date is None:
        from_date = _today_warsaw()
    if to_date is None:
        to_date = from_date + timedelta(days=180)
    from_utc, _ = _date_to_utc_range(from_date)
    _, to_utc = _date_to_utc_range(to_date)
    warsaw_date = _warsaw_date_expr()
    q = (
        db.query(warsaw_date)
        .filter(Match.kickoff >= from_utc, Match.kickoff < to_utc)
    )
    effective_league = league_id or _wc_league_id(db)
    if effective_league:
        q = q.filter(Match.league_id == effective_league)
    results = q.distinct().order_by(warsaw_date).all()
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
    from_date: date = Query(default=None),
    to_date: date = Query(default=None),
    status: MatchStatus | None = Query(default=None),
    league_id: int | None = Query(default=None),
    db: Session = Depends(get_db),
):
    if from_date is None:
        from_date = _today_warsaw()
    if to_date is None:
        to_date = from_date + timedelta(days=7)
    from_utc, _ = _date_to_utc_range(from_date)
    _, to_utc = _date_to_utc_range(to_date)
    q = db.query(Match).options(joinedload(Match.league))
    q = q.filter(Match.kickoff >= from_utc, Match.kickoff < to_utc)
    if status:
        q = q.filter(Match.status == status)
    effective_league = league_id or _wc_league_id(db)
    if effective_league:
        q = q.filter(Match.league_id == effective_league)
    q = q.order_by(Match.kickoff)
    matches = q.all()
    return {"matches": matches, "total": len(matches)}


@router.get("/today", response_model=MatchListResponse)
def get_today(db: Session = Depends(get_db)):
    from_utc, to_utc = _date_to_utc_range(_today_warsaw())
    matches = (
        db.query(Match)
        .options(joinedload(Match.league))
        .filter(Match.kickoff >= from_utc, Match.kickoff < to_utc)
        .order_by(Match.kickoff)
        .all()
    )
    return {"matches": matches, "total": len(matches)}


@router.get("/live", response_model=MatchListResponse)
def get_live(db: Session = Depends(get_db)):
    q = (
        db.query(Match)
        .options(joinedload(Match.league))
        .filter(Match.status == MatchStatus.LIVE)
    )
    wc_id = _wc_league_id(db)
    if wc_id:
        q = q.filter(Match.league_id == wc_id)
    matches = q.order_by(Match.kickoff).all()
    return {"matches": matches, "total": len(matches)}


@router.websocket("/ws")
async def matches_ws(websocket: WebSocket):
    await match_manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        match_manager.disconnect(websocket)


@router.get("/{match_id}", response_model=MatchResponse)
def get_match(match_id: int, db: Session = Depends(get_db)):
    from fastapi import HTTPException
    match = db.query(Match).options(joinedload(Match.league)).filter(Match.id == match_id).first()
    if not match:
        raise HTTPException(status_code=404, detail="Mecz nie istnieje")
    return match
