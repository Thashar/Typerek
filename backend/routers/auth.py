from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from jose import jwt, JWTError
from core.database import get_db
from core.config import settings
from core.security import hash_password
from schemas.user import RegisterRequest, LoginRequest, TokenResponse, RefreshRequest, UserResponse
from services.auth import register_user, login_user, refresh_tokens
from routers.deps import get_current_user
from models.user import User

router = APIRouter(prefix="/api/auth", tags=["auth"])


class ForgotPasswordRequest(BaseModel):
    email: str


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


@router.post("/register", response_model=UserResponse, status_code=201)
def register(body: RegisterRequest, db: Session = Depends(get_db)):
    user = register_user(db, body.username, body.email, body.password)

    expire = datetime.now(timezone.utc) + timedelta(hours=24)
    token = jwt.encode(
        {"sub": user.email, "type": "email_verify", "exp": expire},
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM,
    )
    try:
        from core.email import send_verification_email
        send_verification_email(user.email, token)
    except Exception:
        pass

    return user


class UseInviteRequest(BaseModel):
    code: str


@router.post("/use-invite")
def use_invite(body: UseInviteRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    from models.invite_code import InviteCode
    now = datetime.now(timezone.utc).replace(tzinfo=None)

    if current_user.is_ranked:
        raise HTTPException(status_code=400, detail="Konto jest już zweryfikowane kodem")

    code = db.query(InviteCode).filter(InviteCode.code == body.code.upper()).first()
    if not code or code.used_by_id is not None or now > code.expires_at:
        raise HTTPException(status_code=400, detail="Nieprawidłowy lub wygasły kod zaproszenia")

    code.used_by_id = current_user.id
    code.used_at = now
    current_user.is_ranked = True
    db.commit()
    return {"detail": "Konto zostało zweryfikowane. Jesteś teraz widoczny w rankingu."}


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


@router.get("/verify-email")
def verify_email(token: str, db: Session = Depends(get_db)):
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError:
        raise HTTPException(status_code=400, detail="Nieprawidłowy lub wygasły link weryfikacyjny")
    if payload.get("type") != "email_verify":
        raise HTTPException(status_code=400, detail="Nieprawidłowy token")
    user = db.query(User).filter(User.email == payload["sub"]).first()
    if not user:
        raise HTTPException(status_code=404, detail="Użytkownik nie istnieje")
    if user.is_verified:
        return {"detail": "Konto już zostało zweryfikowane"}
    user.is_verified = True
    db.commit()
    return {"detail": "Adres e-mail został potwierdzony. Możesz się teraz zalogować."}


@router.post("/resend-verification")
def resend_verification(body: ForgotPasswordRequest, db: Session = Depends(get_db)):
    from core.email import send_verification_email
    user = db.query(User).filter(User.email == body.email.lower().strip()).first()
    if user and not user.is_verified:
        expire = datetime.now(timezone.utc) + timedelta(hours=24)
        token = jwt.encode(
            {"sub": user.email, "type": "email_verify", "exp": expire},
            settings.SECRET_KEY,
            algorithm=settings.ALGORITHM,
        )
        try:
            send_verification_email(user.email, token)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Błąd wysyłania e-maila: {e}")
    return {"detail": "Jeśli konto istnieje i nie jest zweryfikowane, wysłaliśmy nowy link."}


@router.post("/forgot-password")
def forgot_password(body: ForgotPasswordRequest, db: Session = Depends(get_db)):
    from core.email import send_reset_email
    user = db.query(User).filter(User.email == body.email.lower().strip()).first()
    if user:
        expire = datetime.now(timezone.utc) + timedelta(minutes=15)
        token = jwt.encode(
            {"sub": user.email, "type": "password_reset", "exp": expire},
            settings.SECRET_KEY,
            algorithm=settings.ALGORITHM,
        )
        try:
            send_reset_email(user.email, token)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Błąd wysyłania e-maila: {e}")
    return {"detail": "Jeśli konto z tym adresem istnieje, wysłaliśmy link do resetu hasła."}


@router.post("/reset-password")
def reset_password(body: ResetPasswordRequest, db: Session = Depends(get_db)):
    try:
        payload = jwt.decode(body.token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError:
        raise HTTPException(status_code=400, detail="Nieprawidłowy lub wygasły link resetujący")
    if payload.get("type") != "password_reset":
        raise HTTPException(status_code=400, detail="Nieprawidłowy token")
    if len(body.new_password) < 6:
        raise HTTPException(status_code=400, detail="Hasło musi mieć co najmniej 6 znaków")
    user = db.query(User).filter(User.email == payload["sub"]).first()
    if not user:
        raise HTTPException(status_code=404, detail="Użytkownik nie istnieje")
    user.hashed_password = hash_password(body.new_password)
    db.commit()
    return {"detail": "Hasło zostało zmienione. Możesz się teraz zalogować."}
