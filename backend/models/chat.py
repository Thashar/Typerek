from datetime import datetime, timezone
from sqlalchemy import ForeignKey, Text, DateTime, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship
from core.database import Base


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    league_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("private_leagues.id"), nullable=True, index=True)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None), index=True)

    user: Mapped["User"] = relationship("User")


class ChatTyping(Base):
    __tablename__ = "chat_typing"

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), primary_key=True)
    league_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("private_leagues.id"), nullable=True)
    typed_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)

    user: Mapped["User"] = relationship("User")
