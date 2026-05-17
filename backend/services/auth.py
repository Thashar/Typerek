from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from models.user import User
from core.security import hash_password, verify_password, create_access_token, create_refresh_token, decode_token


def register_user(db: Session, username: str, email: str, password: str) -> User:
    if db.query(User).filter(User.username == username).first():
        raise HTTPException(status_code=400, detail="Nazwa użytkownika jest już zajęta")
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(status_code=400, detail="Email jest już zarejestrowany")

    user = User(
        username=username,
        email=email,
        hashed_password=hash_password(password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def login_user(db: Session, username: str, password: str) -> dict:
    user = db.query(User).filter(User.username == username).first()
    if not user or not verify_password(password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Nieprawidłowa nazwa użytkownika lub hasło")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Konto jest zablokowane")
    if not user.is_verified:
        raise HTTPException(status_code=403, detail="Potwierdź adres e-mail przed zalogowaniem")

    payload = {"sub": str(user.id)}
    return {
        "access_token": create_access_token(payload),
        "refresh_token": create_refresh_token(payload),
    }


def refresh_tokens(db: Session, refresh_token: str) -> dict:
    payload = decode_token(refresh_token)
    if not payload:
        raise HTTPException(status_code=401, detail="Nieprawidłowy token odświeżania")

    user = db.query(User).filter(User.id == int(payload["sub"])).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="Użytkownik nie istnieje")

    token_payload = {"sub": str(user.id)}
    return {
        "access_token": create_access_token(token_payload),
        "refresh_token": create_refresh_token(token_payload),
    }


def get_user_by_id(db: Session, user_id: int) -> User:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Użytkownik nie istnieje")
    return user
