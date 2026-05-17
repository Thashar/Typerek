from sqlalchemy import text
from sqlalchemy.orm import Session
from models.prediction import POINTS_EXACT, POINTS_OUTCOME
from models.private_league import PrivateLeague, PrivateLeagueMember
from models.user import User
from models.prediction import Prediction, POINTS_EXACT, POINTS_OUTCOME


def get_global_ranking(db: Session) -> list[dict]:
    rows = db.execute(text("""
        SELECT u.id AS user_id, u.username,
               COALESCE(SUM(p.points), 0) AS total_points,
               COUNT(p.id) AS predictions_count,
               SUM(CASE WHEN p.points = :exact THEN 1 ELSE 0 END) AS exact_hits,
               SUM(CASE WHEN p.points = :outcome THEN 1 ELSE 0 END) AS outcome_hits
        FROM users u
        LEFT JOIN predictions p ON p.user_id = u.id
        WHERE u.is_active = TRUE AND u.is_ranked = TRUE
        GROUP BY u.id, u.username
        ORDER BY total_points DESC
    """), {"exact": POINTS_EXACT, "outcome": POINTS_OUTCOME}).fetchall()

    return [
        {
            "rank": idx + 1,
            "user_id": r.user_id,
            "username": r.username,
            "total_points": int(r.total_points),
            "predictions_count": int(r.predictions_count),
            "exact_hits": int(r.exact_hits or 0),
            "outcome_hits": int(r.outcome_hits or 0),
        }
        for idx, r in enumerate(rows)
    ]


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
