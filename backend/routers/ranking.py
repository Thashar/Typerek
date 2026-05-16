from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from core.database import get_db
from schemas.ranking import RankingResponse
from services import ranking as svc

router = APIRouter(prefix="/api/ranking", tags=["ranking"])


@router.get("", response_model=RankingResponse)
def global_ranking(db: Session = Depends(get_db)):
    entries = svc.get_global_ranking(db)
    return {"entries": entries, "total": len(entries)}


@router.get("/league/{league_id}", response_model=RankingResponse)
def league_ranking(league_id: int, db: Session = Depends(get_db)):
    entries = svc.get_private_league_ranking(db, league_id)
    return {"entries": entries, "total": len(entries)}
