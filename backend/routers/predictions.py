from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from core.database import get_db
from routers.deps import get_current_user
from models.user import User
from schemas.prediction import PredictionRequest, PredictionResponse, PredictionSummary
from services import predictions as svc

router = APIRouter(prefix="/api/predictions", tags=["predictions"])


@router.post("", response_model=PredictionSummary, status_code=201)
def submit(
    body: PredictionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    pred = svc.submit_prediction(
        db, current_user.id, body.match_id, body.predicted_home, body.predicted_away
    )
    return pred


@router.get("/me", response_model=list[PredictionResponse])
def my_predictions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return svc.get_user_predictions(db, current_user.id)


@router.get("/me/match/{match_id}", response_model=PredictionSummary | None)
def my_prediction_for_match(
    match_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return svc.get_match_prediction(db, current_user.id, match_id)


@router.delete("/match/{match_id}", status_code=204)
def delete_prediction(
    match_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    svc.delete_prediction(db, current_user.id, match_id)
