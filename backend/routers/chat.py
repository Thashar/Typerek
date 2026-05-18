from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from datetime import datetime
from sqlalchemy.orm import Session
from core.database import get_db
from routers.deps import get_current_user
from models.user import User
from models.chat import ChatMessage

router = APIRouter(prefix="/api/chat", tags=["chat"])


class SendMessageRequest(BaseModel):
    content: str


class ChatMessageResponse(BaseModel):
    id: int
    user_id: int
    username: str
    avatar: str | None
    content: str
    created_at: datetime

    model_config = {"from_attributes": True}


@router.get("/messages", response_model=list[ChatMessageResponse])
def get_messages(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    msgs = (
        db.query(ChatMessage)
        .order_by(ChatMessage.created_at.desc())
        .limit(100)
        .all()
    )
    msgs.reverse()
    return [
        {
            "id": m.id,
            "user_id": m.user_id,
            "username": m.user.username,
            "avatar": m.user.avatar,
            "content": m.content,
            "created_at": m.created_at,
        }
        for m in msgs
    ]


@router.post("/messages", response_model=ChatMessageResponse, status_code=201)
def send_message(
    body: SendMessageRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    content = body.content.strip()
    if not content:
        raise HTTPException(status_code=400, detail="Wiadomość nie może być pusta")
    if len(content) > 500:
        raise HTTPException(status_code=400, detail="Wiadomość za długa (max 500 znaków)")

    msg = ChatMessage(user_id=current_user.id, content=content)
    db.add(msg)
    db.commit()
    db.refresh(msg)

    return {
        "id": msg.id,
        "user_id": msg.user_id,
        "username": current_user.username,
        "avatar": current_user.avatar,
        "content": msg.content,
        "created_at": msg.created_at,
    }
