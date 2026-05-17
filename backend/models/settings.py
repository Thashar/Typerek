from sqlalchemy import Integer
from sqlalchemy.orm import Mapped, mapped_column, Session
from core.database import Base


class GameSettings(Base):
    __tablename__ = "game_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    points_exact: Mapped[int] = mapped_column(Integer, default=5)
    points_outcome: Mapped[int] = mapped_column(Integer, default=2)

    @classmethod
    def get(cls, db: Session) -> "GameSettings":
        s = db.query(cls).filter(cls.id == 1).first()
        if not s:
            s = cls(id=1, points_exact=5, points_outcome=2)
            db.add(s)
            db.commit()
            db.refresh(s)
        return s
