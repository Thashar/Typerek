from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from datetime import datetime, timezone, timedelta
from collections import defaultdict
from sqlalchemy.orm import Session, joinedload
from core.database import get_db, SessionLocal
from core.security import decode_token
from routers.deps import get_current_user
from models.user import User
from models.chat import ChatMessage, ChatTyping
from models.private_league import PrivateLeagueMember
from models.settings import GameSettings

router = APIRouter(prefix="/api/chat", tags=["chat"])


class _ChatManager:
    def __init__(self):
        self._sockets: dict[int | None, set[WebSocket]] = defaultdict(set)

    async def connect(self, ws: WebSocket, league_id: int | None):
        await ws.accept()
        self._sockets[league_id].add(ws)

    def disconnect(self, ws: WebSocket, league_id: int | None):
        self._sockets[league_id].discard(ws)

    async def broadcast(self, league_id: int | None, data: dict):
        dead = set()
        for ws in list(self._sockets.get(league_id, set())):
            try:
                await ws.send_json(data)
            except Exception:
                dead.add(ws)
        for ws in dead:
            self._sockets[league_id].discard(ws)


manager = _ChatManager()


def _get_user_league_id(db: Session, user_id: int) -> int | None:
    m = db.query(PrivateLeagueMember).filter(PrivateLeagueMember.user_id == user_id).first()
    return m.league_id if m else None


class SendMessageRequest(BaseModel):
    content: str
    league_id: int | None = None


class ChatMessageResponse(BaseModel):
    id: int
    user_id: int
    username: str
    avatar: str | None
    content: str
    created_at: datetime

    model_config = {"from_attributes": True}


@router.websocket("/ws")
async def chat_ws(
    websocket: WebSocket,
    token: str = Query(...),
    league_id: int | None = Query(default=None),
):
    payload = decode_token(token)
    if not payload:
        await websocket.close(code=4001)
        return

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.id == int(payload["sub"])).first()
        if not user or not user.is_active:
            await websocket.close(code=4001)
            return
        effective_league_id = league_id if user.is_admin else _get_user_league_id(db, user.id)
    finally:
        db.close()

    await manager.connect(websocket, effective_league_id)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket, effective_league_id)


@router.get("/messages", response_model=list[ChatMessageResponse])
def get_messages(
    league_id: int | None = Query(default=None),
    before_id: int | None = Query(default=None),
    after_id: int | None = Query(default=None),
    limit: int = Query(default=10, le=50),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    s = GameSettings.get(db)
    if not s.chat_enabled and not current_user.is_admin:
        return []

    if current_user.is_admin:
        effective_league_id = league_id
    else:
        effective_league_id = _get_user_league_id(db, current_user.id)

    q = db.query(ChatMessage).options(joinedload(ChatMessage.user))
    if effective_league_id is not None:
        q = q.filter(ChatMessage.league_id == effective_league_id)
    else:
        q = q.filter(ChatMessage.league_id.is_(None))

    if after_id is not None:
        q = q.filter(ChatMessage.id > after_id)
        msgs = q.order_by(ChatMessage.id.asc()).limit(limit).all()
    else:
        if before_id is not None:
            q = q.filter(ChatMessage.id < before_id)
        msgs = q.order_by(ChatMessage.id.desc()).limit(limit).all()
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


@router.post("/typing", status_code=204)
def update_typing(
    league_id: int | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.is_admin:
        effective_league_id = league_id
    else:
        effective_league_id = _get_user_league_id(db, current_user.id)

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    row = db.query(ChatTyping).filter(ChatTyping.user_id == current_user.id).first()
    if row:
        row.league_id = effective_league_id
        row.typed_at = now
    else:
        db.add(ChatTyping(user_id=current_user.id, league_id=effective_league_id, typed_at=now))
    db.commit()


@router.get("/typing")
def get_typing(
    league_id: int | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.is_admin:
        effective_league_id = league_id
    else:
        effective_league_id = _get_user_league_id(db, current_user.id)

    cutoff = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(seconds=5)
    rows = (
        db.query(ChatTyping)
        .options(joinedload(ChatTyping.user))
        .filter(
            ChatTyping.user_id != current_user.id,
            ChatTyping.typed_at >= cutoff,
            ChatTyping.league_id == effective_league_id,
        )
        .all()
    )
    return [r.user.username for r in rows]


@router.post("/messages", response_model=ChatMessageResponse, status_code=201)
async def send_message(
    body: SendMessageRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    s = GameSettings.get(db)
    if not s.chat_enabled and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Czat jest wyłączony")

    content = body.content.strip()
    if not content:
        raise HTTPException(status_code=400, detail="Wiadomość nie może być pusta")
    if len(content) > 500:
        raise HTTPException(status_code=400, detail="Wiadomość za długa (max 500 znaków)")

    if current_user.is_admin and body.league_id is not None:
        league_id = body.league_id
    else:
        league_id = _get_user_league_id(db, current_user.id)

    msg = ChatMessage(user_id=current_user.id, league_id=league_id, content=content)
    db.add(msg)
    db.commit()
    db.refresh(msg)

    payload = {
        "id": msg.id,
        "user_id": msg.user_id,
        "username": current_user.username,
        "avatar": current_user.avatar,
        "content": msg.content,
        "created_at": msg.created_at.isoformat(),
    }
    await manager.broadcast(league_id, payload)
    return payload
