from sqlalchemy import func
from sqlalchemy.orm import Session
from models.user import User
from models.prediction import Prediction, POINTS_EXACT, POINTS_OUTCOME
from models.private_league import PrivateLeague, PrivateLeagueMember


def get_global_ranking(db: Session) -> list[dict]:
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
        .filter(User.is_active == True, User.is_ranked == True)
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
