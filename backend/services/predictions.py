from datetime import datetime, timezone
from fastapi import HTTPException
from sqlalchemy.orm import Session, joinedload
from models.match import Match, MatchStatus
from models.prediction import Prediction, POINTS_EXACT


def submit_prediction(
    db: Session, user_id: int, match_id: int, predicted_home: int, predicted_away: int
) -> Prediction:
    match = db.query(Match).filter(Match.id == match_id).first()
    if not match:
        raise HTTPException(status_code=404, detail="Mecz nie istnieje")
    if match.status != MatchStatus.SCHEDULED:
        raise HTTPException(status_code=400, detail="Nie można typować — mecz już się rozpoczął lub zakończył")
    if match.kickoff <= datetime.now(timezone.utc).replace(tzinfo=None):
        raise HTTPException(status_code=400, detail="Czas na typowanie minął")

    existing = db.query(Prediction).filter(
        Prediction.user_id == user_id,
        Prediction.match_id == match_id,
    ).first()

    if existing:
        # Nie pozwól edytować, jeśli wynik został sfinalizowany
        if existing.is_finalized:
            raise HTTPException(status_code=400, detail="Wynik został sfinalizowany — nie możesz go zmienić")
        existing.predicted_home = predicted_home
        existing.predicted_away = predicted_away
        existing.points = None
        db.commit()
        db.refresh(existing)
        return existing

    pred = Prediction(
        user_id=user_id,
        match_id=match_id,
        predicted_home=predicted_home,
        predicted_away=predicted_away,
    )
    db.add(pred)
    db.commit()
    db.refresh(pred)
    return pred


def get_user_predictions(db: Session, user_id: int) -> list[Prediction]:
    return (
        db.query(Prediction)
        .options(joinedload(Prediction.match).joinedload(Match.league))
        .filter(Prediction.user_id == user_id)
        .order_by(Prediction.created_at.desc())
        .all()
    )


def get_public_predictions(db: Session, user_id: int) -> list[Prediction]:
    return (
        db.query(Prediction)
        .options(joinedload(Prediction.match).joinedload(Match.league))
        .join(Match)
        .filter(
            Prediction.user_id == user_id,
            Match.status.in_([MatchStatus.FINISHED, MatchStatus.LIVE]),
        )
        .order_by(Match.kickoff.desc())
        .all()
    )


def get_match_prediction(db: Session, user_id: int, match_id: int) -> Prediction | None:
    return db.query(Prediction).filter(
        Prediction.user_id == user_id,
        Prediction.match_id == match_id,
    ).first()


def delete_prediction(db: Session, user_id: int, match_id: int) -> None:
    match = db.query(Match).filter(Match.id == match_id).first()
    if not match:
        raise HTTPException(status_code=404, detail="Mecz nie istnieje")
    if match.status != MatchStatus.SCHEDULED:
        raise HTTPException(status_code=400, detail="Nie można usunąć — mecz już się rozpoczął")
    pred = db.query(Prediction).filter(
        Prediction.user_id == user_id,
        Prediction.match_id == match_id,
    ).first()
    if not pred:
        raise HTTPException(status_code=404, detail="Typ nie istnieje")
    db.delete(pred)
    db.commit()
