from datetime import datetime, timezone
from sqlalchemy import Index, Integer, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from core.database import Base

POINTS_OUTCOME = 2
POINTS_EXACT = 5


class Prediction(Base):
    __tablename__ = "predictions"

    __table_args__ = (Index("ix_prediction_user_match", "user_id", "match_id"),)

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    match_id: Mapped[int] = mapped_column(ForeignKey("matches.id"), nullable=False, index=True)

    predicted_home: Mapped[int] = mapped_column(Integer, nullable=False)
    predicted_away: Mapped[int] = mapped_column(Integer, nullable=False)
    points: Mapped[int | None] = mapped_column(Integer, nullable=True)
    is_finalized: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))

    user: Mapped["User"] = relationship("User", back_populates="predictions")
    match: Mapped["Match"] = relationship("Match", back_populates="predictions")

    @property
    def predicted_outcome(self) -> str:
        if self.predicted_home > self.predicted_away:
            return "1"
        if self.predicted_home < self.predicted_away:
            return "2"
        return "X"

    def calculate_points(self, home_score: int, away_score: int, points_exact: int = POINTS_EXACT, points_outcome: int = POINTS_OUTCOME) -> int:
        if self.predicted_home == home_score and self.predicted_away == away_score:
            return points_exact
        actual_outcome = "1" if home_score > away_score else ("2" if home_score < away_score else "X")
        if self.predicted_outcome == actual_outcome:
            return points_outcome
        return 0
