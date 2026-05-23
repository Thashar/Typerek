from datetime import datetime, timezone, timedelta
import re
import secrets
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session
from jose import jwt, JWTError
import httpx
from core.database import get_db
from core.config import settings
from core.security import hash_password, create_access_token, create_refresh_token
from schemas.user import RegisterRequest, LoginRequest, TokenResponse, RefreshRequest, UserResponse
from services.auth import register_user, login_user, refresh_tokens
from routers.deps import get_current_user
from models.user import User

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo"

router = APIRouter(prefix="/api/auth", tags=["auth"])


class ForgotPasswordRequest(BaseModel):
    email: str


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


@router.post("/register", response_model=UserResponse, status_code=201)
def register(body: RegisterRequest, db: Session = Depends(get_db)):
    user = register_user(db, body.username, body.email, body.password, body.invite_code)

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


@router.get("/google")
def google_login():
    redirect_uri = f"{settings.FRONTEND_URL}/api/auth/google/callback"
    params = (
        f"client_id={settings.GOOGLE_CLIENT_ID}"
        f"&redirect_uri={redirect_uri}"
        f"&response_type=code"
        f"&scope=openid%20email%20profile"
        f"&access_type=offline"
    )
    return RedirectResponse(f"{GOOGLE_AUTH_URL}?{params}")


@router.get("/google/callback")
def google_callback(code: str, db: Session = Depends(get_db)):
    redirect_uri = f"{settings.FRONTEND_URL}/api/auth/google/callback"

    with httpx.Client() as client:
        token_resp = client.post(GOOGLE_TOKEN_URL, data={
            "code": code,
            "client_id": settings.GOOGLE_CLIENT_ID,
            "client_secret": settings.GOOGLE_CLIENT_SECRET,
            "redirect_uri": redirect_uri,
            "grant_type": "authorization_code",
        })
        if token_resp.status_code != 200:
            raise HTTPException(status_code=400, detail="Błąd Google OAuth")
        access_token_google = token_resp.json().get("access_token")

        userinfo_resp = client.get(GOOGLE_USERINFO_URL, headers={
            "Authorization": f"Bearer {access_token_google}"
        })
        userinfo = userinfo_resp.json()

    email = userinfo.get("email", "").lower().strip()
    if not email:
        raise HTTPException(status_code=400, detail="Brak adresu e-mail od Google")

    user = db.query(User).filter(User.email == email).first()
    if user:
        if not user.is_verified:
            user.is_verified = True
            db.commit()
        session_token = jwt.encode(
            {"sub": str(user.id), "type": "google_session", "exp": datetime.now(timezone.utc) + timedelta(minutes=2)},
            settings.SECRET_KEY,
            algorithm=settings.ALGORITHM,
        )
        return RedirectResponse(f"{settings.FRONTEND_URL}/auth/google/callback?session={session_token}")
    else:
        pending_token = jwt.encode(
            {
                "email": email,
                "avatar": userinfo.get("picture", "") or "",
                "type": "google_pending",
                "exp": datetime.now(timezone.utc) + timedelta(minutes=10),
            },
            settings.SECRET_KEY,
            algorithm=settings.ALGORITHM,
        )
        return RedirectResponse(f"{settings.FRONTEND_URL}/auth/google/callback?pending={pending_token}")


class GoogleExchangeRequest(BaseModel):
    session_token: str


class GoogleCompleteRequest(BaseModel):
    pending_token: str
    invite_code: str


@router.post("/google/exchange", response_model=TokenResponse)
def google_exchange(body: GoogleExchangeRequest, db: Session = Depends(get_db)):
    try:
        payload = jwt.decode(body.session_token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError:
        raise HTTPException(status_code=400, detail="Nieważny lub wygasły token sesji")
    if payload.get("type") != "google_session":
        raise HTTPException(status_code=400, detail="Nieprawidłowy typ tokenu")
    user = db.query(User).filter(User.id == int(payload["sub"])).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="Użytkownik nie istnieje")
    return {
        "access_token": create_access_token({"sub": str(user.id)}),
        "refresh_token": create_refresh_token({"sub": str(user.id)}),
    }


@router.post("/google/complete", response_model=TokenResponse)
def google_complete(body: GoogleCompleteRequest, db: Session = Depends(get_db)):
    try:
        payload = jwt.decode(body.pending_token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError:
        raise HTTPException(status_code=400, detail="Nieważny lub wygasły token rejestracji")
    if payload.get("type") != "google_pending":
        raise HTTPException(status_code=400, detail="Nieprawidłowy typ tokenu")

    email = payload["email"]
    user = db.query(User).filter(User.email == email).first()
    if user:
        return {
            "access_token": create_access_token({"sub": str(user.id)}),
            "refresh_token": create_refresh_token({"sub": str(user.id)}),
        }

    from models.private_league import PrivateLeague, PrivateLeagueMember
    league = db.query(PrivateLeague).filter(
        PrivateLeague.invite_code == body.invite_code.strip().upper()
    ).first()
    if not league:
        raise HTTPException(status_code=400, detail="Nieprawidłowy kod zaproszenia")

    base = re.sub(r"[^a-zA-Z0-9_]", "", email.split("@")[0])[:20] or "user"
    username = base
    counter = 1
    while db.query(User).filter(User.username == username).first():
        username = f"{base}{counter}"
        counter += 1

    avatar = payload.get("avatar") or None
    user = User(
        username=username,
        email=email,
        hashed_password=hash_password(secrets.token_hex(16)),
        is_verified=True,
        avatar=avatar,
    )
    db.add(user)
    db.flush()
    db.add(PrivateLeagueMember(league_id=league.id, user_id=user.id))
    db.commit()
    db.refresh(user)
    return {
        "access_token": create_access_token({"sub": str(user.id)}),
        "refresh_token": create_refresh_token({"sub": str(user.id)}),
    }


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
