import time as _time
from datetime import datetime
from sqlalchemy import Integer, DateTime
from sqlalchemy.orm import Mapped, mapped_column, Session
from core.database import Base

_gs_cache: tuple[int, int] | None = None  # (points_exact, points_outcome)
_gs_cache_ts: float = 0.0
_GS_TTL = 300.0


class GameSettings(Base):
    __tablename__ = "game_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    points_exact: Mapped[int] = mapped_column(Integer, default=5)
    points_outcome: Mapped[int] = mapped_column(Integer, default=2)
    last_synced_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    @classmethod
    def get(cls, db: Session) -> "GameSettings":
        s = db.query(cls).filter(cls.id == 1).first()
        if not s:
            s = cls(id=1, points_exact=5, points_outcome=2)
            db.add(s)
            db.commit()
            db.refresh(s)
        return s

    @classmethod
    def get_points(cls, db: Session) -> tuple[int, int]:
        global _gs_cache, _gs_cache_ts
        now = _time.monotonic()
        if _gs_cache and (now - _gs_cache_ts) < _GS_TTL:
            return _gs_cache
        s = cls.get(db)
        _gs_cache = (s.points_exact, s.points_outcome)
        _gs_cache_ts = now
        return _gs_cache

    @classmethod
    def invalidate_cache(cls) -> None:
        global _gs_cache
        _gs_cache = None
