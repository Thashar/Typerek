from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from core.config import settings

_url = settings.DATABASE_URL

if _url.startswith("sqlite"):
    _kwargs = {"connect_args": {"check_same_thread": False}}
else:
    _url = _url.replace("postgresql://", "postgresql+pg8000://", 1)
    _kwargs = {"connect_args": {"ssl_context": True, "tcp_keepalive": True}}

engine = create_engine(_url, **_kwargs)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
