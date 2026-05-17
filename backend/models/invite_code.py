import random
from datetime import datetime, timezone, timedelta
from sqlalchemy import String, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import Mapped, mapped_column
from core.database import Base

_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"


def _gen_code() -> str:
    return "".join(random.choices(_CHARS, k=5))


class InviteCode(Base):
    __tablename__ = "invite_codes"

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(5), unique=True, index=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None))
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    used_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    used_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)

    @property
    def is_expired(self) -> bool:
        return datetime.now(timezone.utc).replace(tzinfo=None) > self.expires_at

    @property
    def is_used(self) -> bool:
        return self.used_by_id is not None

    @property
    def is_valid(self) -> bool:
        return not self.is_used and not self.is_expired

    @classmethod
    def generate(cls, db) -> "InviteCode":
        for _ in range(10):
            code = _gen_code()
            if not db.query(cls).filter(cls.code == code).first():
                break
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        return cls(code=code, created_at=now, expires_at=now + timedelta(hours=24))
