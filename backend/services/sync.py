from datetime import date, timedelta, datetime, timezone
from sqlalchemy.orm import Session
from models.league import League
from models.match import Match, MatchStatus
from models.prediction import Prediction
from services import football_api


def _parse_status(short: str) -> MatchStatus:
    # ET/BT/P = dogrywka/karne — wynik po 90 min jest juz znany, zamykamy
    live = {"1H", "HT", "2H", "LIVE"}
    finished = {"FT", "AET", "PEN", "ET", "BT", "P"}
    cancelled = {"CANC", "ABD", "AWD", "WO"}
    postponed = {"PST"}
    if short in live:
        return MatchStatus.LIVE
    if short in finished:
        return MatchStatus.FINISHED
    if short in cancelled:
        return MatchStatus.CANCELLED
    if short in postponed:
        return MatchStatus.POSTPONED
    return MatchStatus.SCHEDULED


# Kody turniejow z football-data.org
COMPETITION_CODES = ["WC"]


async def sync_fixtures_for_days(db: Session, days_ahead: int = 7) -> int:
    from_date = date.today().isoformat()
    to_date = (date.today() + timedelta(days=days_ahead)).isoformat()
    saved = 0
    for code in COMPETITION_CODES:
        try:
            fixtures = await football_api.fetch_fixtures_by_competition(code, from_date, to_date)
            for f in fixtures:
                saved += _upsert_fixture(db, f)
        except Exception:
            pass
    db.commit()
    return saved


async def sync_bulk_to_end_of_year(db: Session) -> int:
    """Pobiera wszystkie mecze wybranych turniejow do konca roku."""
    from_date = date.today().isoformat()
    to_date = f"{date.today().year}-12-31"
    saved = 0
    for code in COMPETITION_CODES:
        try:
            fixtures = await football_api.fetch_fixtures_by_competition(code, from_date, to_date)
            for f in fixtures:
                saved += _upsert_fixture(db, f)
        except Exception:
            pass
    db.commit()
    return saved


async def update_live_and_recent(db: Session) -> int:
    """Aktualizuje wyniki meczy live i zakonczonych w ostatnich 2h."""
    fixtures = await football_api.fetch_live_fixtures()

    recent = db.query(Match).filter(
        Match.status == MatchStatus.LIVE,
    ).all()
    if recent:
        ids = [m.api_id for m in recent]
        finished_data = await football_api.fetch_fixtures_by_ids(ids)
        fixtures += finished_data

    updated = 0
    for f in fixtures:
        updated += _upsert_fixture(db, f)

    # Zabezpieczenie: mecze ktore tkwia w statusie LIVE ponad 3h od kickoffu
    # (np. API przestalo je zwracac albo uzylo niestandardowego statusu)
    cutoff = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(hours=3)
    stuck = db.query(Match).filter(
        Match.status == MatchStatus.LIVE,
        Match.kickoff < cutoff,
    ).all()
    for match in stuck:
        match.status = MatchStatus.FINISHED
        updated += 1

    if updated:
        _calculate_points_for_finished(db)
        db.commit()
    return updated


def _upsert_fixture(db: Session, f: dict) -> int:
    api_id = f["fixture"]["id"]
    league_data = f["league"]
    teams = f["teams"]
    goals = f["goals"]
    status_short = f["fixture"]["status"]["short"]

    league = _get_or_create_league(db, league_data)

    kickoff_ts = f["fixture"]["timestamp"]
    kickoff = datetime.fromtimestamp(kickoff_ts, tz=timezone.utc).replace(tzinfo=None)

    match = db.query(Match).filter(Match.api_id == api_id).first()
    if not match:
        match = Match(api_id=api_id)
        db.add(match)

    match.league_id = league.id
    match.home_team = teams["home"]["name"]
    match.away_team = teams["away"]["name"]
    match.home_team_logo = teams["home"].get("logo")
    match.away_team_logo = teams["away"].get("logo")
    parsed_status = _parse_status(status_short)
    # Fallback: API mowi LIVE ale minelo 2h od kickoffu (90 min + przerwa + czas doliczony)
    if parsed_status == MatchStatus.LIVE:
        cutoff = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(hours=2)
        if kickoff < cutoff:
            parsed_status = MatchStatus.FINISHED

    match.kickoff = kickoff
    match.status = parsed_status
    match.status_short = status_short
    match.home_score = goals.get("home")
    match.away_score = goals.get("away")
    match.minute = f["fixture"]["status"].get("elapsed")
    match.stage = f.get("stage")
    match.match_group = f.get("group")
    return 1


def _get_or_create_league(db: Session, data: dict) -> League:
    league = db.query(League).filter(League.api_id == data["id"]).first()
    if not league:
        league = League(
            api_id=data["id"],
            name=data["name"],
            country=data["country"],
            logo_url=data.get("logo"),
            season=data["season"],
        )
        db.add(league)
        db.flush()
    return league


def _calculate_points_for_finished(db: Session) -> None:
    from models.settings import GameSettings
    gs = GameSettings.get(db)

    finished = db.query(Match).filter(
        Match.status == MatchStatus.FINISHED,
        Match.home_score.isnot(None),
        Match.away_score.isnot(None),
    ).all()

    for match in finished:
        unscored = db.query(Prediction).filter(
            Prediction.match_id == match.id,
            Prediction.points.is_(None),
        ).all()
        for pred in unscored:
            pred.points = pred.calculate_points(match.home_score, match.away_score, gs.points_exact, gs.points_outcome)
