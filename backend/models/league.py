from sqlalchemy import String, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship
from core.database import Base


class League(Base):
    __tablename__ = "leagues"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    api_id: Mapped[int] = mapped_column(Integer, unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    country: Mapped[str] = mapped_column(String(100), nullable=False)
    logo_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    season: Mapped[int] = mapped_column(Integer, nullable=False)

    matches: Mapped[list["Match"]] = relationship("Match", back_populates="league")
