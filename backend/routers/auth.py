from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from core.database import get_db
from schemas.user import RegisterRequest, LoginRequest, TokenResponse, RefreshRequest, UserResponse
from services.auth import register_user, login_user, refresh_tokens
from routers.deps import get_current_user
from models.user import User

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=UserResponse, status_code=201)
def register(body: RegisterRequest, db: Session = Depends(get_db)):
    from datetime import datetime, timezone
    from models.invite_code import InviteCode

    code = db.query(InviteCode).filter(InviteCode.code == body.invite_code.upper()).first()
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    if not code or code.used_by_id is not None or now > code.expires_at:
        raise HTTPException(status_code=400, detail="Nieprawidłowy lub wygasły kod zaproszenia")

    user = register_user(db, body.username, body.email, body.password)

    code.used_by_id = user.id
    code.used_at = now
    db.commit()
    return user


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)):
    tokens = login_user(db, body.username, body.password)
    return tokens


@router.post("/refresh", response_model=TokenResponse)
def refresh(body: RefreshRequest, db: Session = Depends(get_db)):
    tokens = refresh_tokens(db, body.refresh_token)
    return tokens


@router.get("/me", response_model=UserResponse)
def me(current_user: User = Depends(get_current_user)):
    return current_user
