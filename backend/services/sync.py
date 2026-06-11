from datetime import date, timedelta, datetime, timezone
from sqlalchemy.orm import Session, joinedload
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


# Kody turniejow z football-data.org — wszystkie dostepne
COMPETITION_CODES = list(football_api.COMPETITIONS.keys())


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
    from sqlalchemy import or_, and_
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    window_start = now - timedelta(hours=3)

    has_active = db.query(Match).filter(
        or_(
            Match.status == MatchStatus.LIVE,
            and_(
                Match.kickoff <= now,
                Match.kickoff >= window_start,
                Match.status.notin_([MatchStatus.FINISHED, MatchStatus.CANCELLED, MatchStatus.POSTPONED]),
            ),
        )
    ).limit(1).first()

    if not has_active:
        # Mimo braku aktywnych meczów przelicz punkty — np. po admin sync
        _calculate_points_for_finished(db)
        db.commit()
        return 0

    # Ustal kody ligowe na podstawie aktywnych meczów w bazie, nie hardkodowanych COMPETITION_CODES
    active_matches = db.query(Match).filter(
        or_(
            Match.status == MatchStatus.LIVE,
            and_(
                Match.kickoff <= now,
                Match.kickoff >= window_start,
                Match.status.notin_([MatchStatus.FINISHED, MatchStatus.CANCELLED, MatchStatus.POSTPONED]),
            ),
        )
    ).all()
    api_id_to_code = {v["id"]: k for k, v in football_api.COMPETITIONS.items()}
    league_ids = {m.league_id for m in active_matches}
    leagues = db.query(League).filter(League.id.in_(league_ids)).all()
    codes_to_query = list({api_id_to_code[l.api_id] for l in leagues if l.api_id in api_id_to_code})
    if not codes_to_query:
        codes_to_query = COMPETITION_CODES

    fixtures = await football_api.fetch_live_fixtures(codes_to_query)

    recent = db.query(Match).filter(
        Match.status == MatchStatus.LIVE,
    ).all()
    if recent:
        ids = [m.api_id for m in recent]
        # Resolve competition codes from league api_ids to avoid querying all competitions
        api_id_to_code = {v["id"]: k for k, v in football_api.COMPETITIONS.items()}
        league_ids = {m.league_id for m in recent}
        leagues = db.query(League).filter(League.id.in_(league_ids)).all()
        comp_codes = list({api_id_to_code[l.api_id] for l in leagues if l.api_id in api_id_to_code})
        finished_data = await football_api.fetch_fixtures_by_ids(ids, comp_codes or None)
        fixtures += finished_data

    updated = 0
    for f in fixtures:
        updated += _upsert_fixture(db, f)

    # Brak auto-zamykania po czasie — status zmieniany tylko gdy potwierdzi go API.
    # Fallback per-match (fetch_match_by_id w fetch_fixtures_by_ids) zapewnia, ze nawet
    # ostatni live'owy mecz dostanie aktualny status, jesli API w ogole go zwraca.

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

    # Blokuj downgrade statusu spowodowany opoznieniem API:
    # LIVE → SCHEDULED oraz FINISHED → SCHEDULED/LIVE nigdy nie powinno sie zdarzac.
    current_status = match.status
    status_blocked = False
    if current_status == MatchStatus.LIVE and parsed_status == MatchStatus.SCHEDULED:
        parsed_status = MatchStatus.LIVE
        status_blocked = True
    elif current_status == MatchStatus.FINISHED and parsed_status in (MatchStatus.SCHEDULED, MatchStatus.LIVE):
        parsed_status = MatchStatus.FINISHED
        status_blocked = True

    match.kickoff = kickoff
    match.status = parsed_status
    match.home_score = goals.get("home")
    match.away_score = goals.get("away")
    match.stage = f.get("stage")
    match.match_group = f.get("group")

    now = datetime.now(timezone.utc).replace(tzinfo=None)

    api_minute = f["fixture"]["status"].get("elapsed")

    # Pierwsza polowa: kotwiczymy w kickoffie jesli mecz wystartowal na czas.
    # Gdy API podaje elapsed, korygujemy: live_started_at = now - (elapsed-1) min.
    if status_short in ('1H', 'LIVE') and match.live_started_at is None:
        if api_minute is not None and api_minute >= 1:
            match.live_started_at = now - timedelta(minutes=api_minute - 1)
        else:
            match.live_started_at = min(kickoff, now)

    # Druga polowa: jesli API podaje elapsed (>=45), cofamy timestamp.
    # W przeciwnym razie szacujemy jako kickoff + 60 min (45 + 15 min przerwy).
    if status_short == '2H' and match.second_half_started_at is None:
        if api_minute is not None and api_minute >= 45:
            match.second_half_started_at = now - timedelta(minutes=api_minute - 45)
        else:
            estimated = kickoff + timedelta(minutes=60)
            match.second_half_started_at = min(estimated, now)

    # Nie cofaj 2H → 1H przy kolejnych upsertach gdy API nie podaje minuty
    if status_short == '1H' and match.second_half_started_at is not None:
        status_short = '2H'

    # Gdy zablokowano downgrade, nie nadpisuj status_short — zachowaj aktualny
    if not status_blocked:
        match.status_short = status_short

    if api_minute is not None:
        match.minute = api_minute
    elif parsed_status == MatchStatus.LIVE:
        # Frontend liczy minute samodzielnie z live_started_at / second_half_started_at,
        # ale zachowujemy pole minute jako referencja dla debugowania / fallback.
        if status_short == '2H' and match.second_half_started_at is not None:
            elapsed = int((now - match.second_half_started_at).total_seconds() / 60)
            match.minute = max(45, 45 + elapsed)
        elif match.live_started_at is not None:
            elapsed = int((now - match.live_started_at).total_seconds() / 60)
            match.minute = max(1, elapsed + 1)

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
    points_exact, points_outcome = GameSettings.get_points(db)

    unscored = (
        db.query(Prediction)
        .join(Match, Prediction.match_id == Match.id)
        .filter(
            Match.status == MatchStatus.FINISHED,
            Match.home_score.isnot(None),
            Match.away_score.isnot(None),
            Prediction.points.is_(None),
        )
        .options(joinedload(Prediction.match))
        .all()
    )
    for pred in unscored:
        m = pred.match
        pred.points = pred.calculate_points(m.home_score, m.away_score, points_exact, points_outcome)
