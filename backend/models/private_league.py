import secrets
from datetime import datetime, timezone
from sqlalchemy import String, Integer, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from core.database import Base


class PrivateLeague(Base):
    __tablename__ = "private_leagues"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    invite_code: Mapped[str] = mapped_column(String(16), unique=True, index=True, nullable=False)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))

    owner: Mapped["User"] = relationship("User", foreign_keys=[owner_id])
    members: Mapped[list["PrivateLeagueMember"]] = relationship(
        "PrivateLeagueMember", back_populates="league", cascade="all, delete-orphan"
    )

    @staticmethod
    def generate_invite_code() -> str:
        return secrets.token_urlsafe(8)[:10].upper()


class PrivateLeagueMember(Base):
    __tablename__ = "private_league_members"
    __table_args__ = (UniqueConstraint("league_id", "user_id"),)

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    league_id: Mapped[int] = mapped_column(ForeignKey("private_leagues.id"), nullable=False)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    joined_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))

    league: Mapped["PrivateLeague"] = relationship("PrivateLeague", back_populates="members")
    user: Mapped["User"] = relationship("User")

    @property
    def points(self) -> int:
        return self.user.total_points
