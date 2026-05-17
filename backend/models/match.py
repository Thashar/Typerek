from datetime import datetime
from sqlalchemy import String, Integer, DateTime, ForeignKey, Enum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from core.database import Base
import enum


class MatchStatus(str, enum.Enum):
    SCHEDULED = "scheduled"
    LIVE = "live"
    FINISHED = "finished"
    POSTPONED = "postponed"
    CANCELLED = "cancelled"


class Match(Base):
    __tablename__ = "matches"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    api_id: Mapped[int] = mapped_column(Integer, unique=True, index=True, nullable=False)
    league_id: Mapped[int] = mapped_column(ForeignKey("leagues.id"), nullable=False)

    home_team: Mapped[str] = mapped_column(String(100), nullable=False)
    away_team: Mapped[str] = mapped_column(String(100), nullable=False)
    home_team_logo: Mapped[str | None] = mapped_column(String(500), nullable=True)
    away_team_logo: Mapped[str | None] = mapped_column(String(500), nullable=True)

    kickoff: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    status: Mapped[MatchStatus] = mapped_column(Enum(MatchStatus), default=MatchStatus.SCHEDULED)

    home_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    away_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    minute: Mapped[int | None] = mapped_column(Integer, nullable=True)
    status_short: Mapped[str | None] = mapped_column(String(10), nullable=True)
    stage: Mapped[str | None] = mapped_column(String(100), nullable=True)
    match_group: Mapped[str | None] = mapped_column(String(50), nullable=True)

    league: Mapped["League"] = relationship("League", back_populates="matches")
    predictions: Mapped[list["Prediction"]] = relationship("Prediction", back_populates="match")

    @property
    def result(self) -> str | None:
        if self.home_score is None or self.away_score is None:
            return None
        if self.home_score > self.away_score:
            return "1"
        if self.home_score < self.away_score:
            return "2"
        return "X"
