from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from core.database import get_db
from routers.deps import get_current_user
from models.user import User

router = APIRouter(prefix="/api/users", tags=["users"])


class AvatarRequest(BaseModel):
    avatar: str


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
