from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from core.database import get_db
from routers.deps import get_current_user
from models.user import User
from models.prediction import Prediction
from models.private_league import PrivateLeagueMember
import re

router = APIRouter(prefix="/api/users", tags=["users"])


class AvatarRequest(BaseModel):
    avatar: str


class ChangeUsernameRequest(BaseModel):
    new_username: str


@router.put("/me/username")
def change_username(
    body: ChangeUsernameRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    new = body.new_username.strip()
    if not re.match(r"^[a-zA-Z0-9_]{3,50}$", new):
        raise HTTPException(status_code=400, detail="Nazwa użytkownika może zawierać tylko litery (a–z, A–Z), cyfry i _ (3–50 znaków)")
    if db.query(User).filter(User.username == new, User.id != current_user.id).first():
        raise HTTPException(status_code=400, detail="Ta nazwa użytkownika jest już zajęta")
    current_user.username = new
    db.commit()
    return {"detail": "ok"}


@router.put("/me/avatar")
def update_avatar(
    body: AvatarRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not body.avatar.startswith("data:image/"):
        raise HTTPException(status_code=400, detail="Nieprawidłowy format awatara")
    if len(body.avatar) > 150_000:
        raise HTTPException(status_code=400, detail="Awatar jest zbyt duży (max ~100KB)")
    current_user.avatar = body.avatar
    db.commit()
    return {"detail": "ok"}


@router.delete("/me/avatar", status_code=204)
def delete_avatar(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    current_user.avatar = None
    db.commit()


@router.get("/me/live-points")
def my_live_points(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from services.ranking import get_user_live_extra_points
    return {"extra_points": get_user_live_extra_points(db, current_user.id)}


@router.delete("/me", status_code=204)
def delete_account(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.is_admin:
        raise HTTPException(status_code=400, detail="Administrator nie może usunąć własnego konta")
    db.query(Prediction).filter(Prediction.user_id == current_user.id).delete()
    db.query(PrivateLeagueMember).filter(PrivateLeagueMember.user_id == current_user.id).delete()
    db.delete(current_user)
    db.commit()
