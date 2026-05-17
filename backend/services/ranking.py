from sqlalchemy import text
from sqlalchemy.orm import Session
from models.prediction import POINTS_EXACT, POINTS_OUTCOME
from models.private_league import PrivateLeague, PrivateLeagueMember
from models.user import User
from models.prediction import Prediction, POINTS_EXACT, POINTS_OUTCOME


def get_global_ranking(db: Session) -> list[dict]:
    rows = db.execute(text("""
        SELECT u.id AS user_id, u.username, u.avatar,
               COALESCE(SUM(p.points), 0) AS total_points,
               COUNT(p.id) AS predictions_count,
               SUM(CASE WHEN p.points = :exact THEN 1 ELSE 0 END) AS exact_hits,
               SUM(CASE WHEN p.points = :outcome THEN 1 ELSE 0 END) AS outcome_hits
        FROM users u
        LEFT JOIN predictions p ON p.user_id = u.id
        WHERE u.is_active = TRUE AND u.is_ranked = TRUE
        GROUP BY u.id, u.username, u.avatar
        ORDER BY total_points DESC
    """), {"exact": POINTS_EXACT, "outcome": POINTS_OUTCOME}).fetchall()

    return [
        {
            "rank": idx + 1,
            "user_id": r.user_id,
            "username": r.username,
            "avatar": r.avatar,
            "total_points": int(r.total_points),
            "predictions_count": int(r.predictions_count),
            "exact_hits": int(r.exact_hits or 0),
            "outcome_hits": int(r.outcome_hits or 0),
        }
        for idx, r in enumerate(rows)
    ]


def get_live_ranking_changes(db: Session) -> dict:
    from models.match import Match, MatchStatus
    from models.prediction import Prediction
    from models.user import User
    from models.settings import GameSettings

    live_matches = db.query(Match).filter(Match.status == MatchStatus.LIVE).all()
    if not live_matches:
        return {"has_live": False, "changes": []}

    gs = GameSettings.get(db)
    live_match_map = {m.id: m for m in live_matches}

    predictions = (
        db.query(Prediction)
        .join(User, Prediction.user_id == User.id)
        .filter(
            Prediction.match_id.in_(list(live_match_map.keys())),
            User.is_ranked == True,
            User.is_active == True,
            Prediction.points.is_(None),
        )
        .all()
    )

    extra_points: dict[int, int] = {}
    for pred in predictions:
        match = live_match_map[pred.match_id]
        if match.home_score is None or match.away_score is None:
            continue
        pts = pred.calculate_points(match.home_score, match.away_score, gs.points_exact, gs.points_outcome)
        extra_points[pred.user_id] = extra_points.get(pred.user_id, 0) + pts

    current_ranking = get_global_ranking(db)
    if not current_ranking:
        return {"has_live": True, "changes": []}

    projected_sorted = sorted(
        [{"user_id": r["user_id"], "pts": r["total_points"] + extra_points.get(r["user_id"], 0)} for r in current_ranking],
        key=lambda x: -x["pts"],
    )
    projected_rank = {p["user_id"]: i + 1 for i, p in enumerate(projected_sorted)}

    return {
        "has_live": True,
        "changes": [
            {
                "user_id": r["user_id"],
                "projected_extra_points": extra_points.get(r["user_id"], 0),
                "rank_change": r["rank"] - projected_rank.get(r["user_id"], r["rank"]),
            }
            for r in current_ranking
        ],
    }


def get_private_league_ranking(db: Session, league_id: int) -> list[dict]:
    league = db.query(PrivateLeague).filter(PrivateLeague.id == league_id).first()
    if not league:
        return []

    member_ids = [m.user_id for m in league.members]

    rows = (
        db.query(
            User.id.label("user_id"),
            User.username,
            func.coalesce(func.sum(Prediction.points), 0).label("total_points"),
            func.count(Prediction.id).label("predictions_count"),
            func.sum(
                func.cast(Prediction.points == POINTS_EXACT, int)
            ).label("exact_hits"),
            func.sum(
                func.cast(Prediction.points == POINTS_OUTCOME, int)
            ).label("outcome_hits"),
        )
        .outerjoin(Prediction, Prediction.user_id == User.id)
        .filter(User.id.in_(member_ids))
        .group_by(User.id, User.username)
        .order_by(func.coalesce(func.sum(Prediction.points), 0).desc())
        .all()
    )

    return [
        {
            "rank": idx + 1,
            "user_id": r.user_id,
            "username": r.username,
            "total_points": r.total_points,
            "predictions_count": r.predictions_count,
            "exact_hits": int(r.exact_hits or 0),
            "outcome_hits": int(r.outcome_hits or 0),
        }
        for idx, r in enumerate(rows)
    ]
