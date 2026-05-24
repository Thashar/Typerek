from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from core.database import engine, Base
from core.config import settings
from core.limiter import limiter

import models.user
import models.league
import models.match
import models.prediction
import models.private_league
import models.invite_code
import models.settings
import models.chat

from routers import auth, matches, cron, predictions, ranking, leagues, debug, admin, game_settings, users, chat

app = FastAPI(title="Typerek API", version="0.1.0")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

_cors_origins = list({
    settings.FRONTEND_URL,
    "https://typerek-ngk.pl",
    "https://www.typerek-ngk.pl",
    *settings.CORS_ORIGINS,
})

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(matches.router)
app.include_router(predictions.router)
app.include_router(ranking.router)
app.include_router(leagues.router)
app.include_router(cron.router)
app.include_router(debug.router)
app.include_router(admin.router)
app.include_router(game_settings.router)
app.include_router(users.router)
app.include_router(chat.router)

try:
    Base.metadata.create_all(bind=engine)
except Exception as e:
    print(f"[WARN] DB init failed: {e}")

try:
    from sqlalchemy import text as _text
    with engine.connect() as _conn:
        _conn.execute(_text("ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar TEXT"))
        _conn.execute(_text("ALTER TABLE matches ADD COLUMN IF NOT EXISTS live_started_at TIMESTAMP"))
        _conn.execute(_text("ALTER TABLE matches ADD COLUMN IF NOT EXISTS second_half_started_at TIMESTAMP"))
        _conn.commit()
except Exception:
    pass

try:
    from sqlalchemy import text as _text
    with engine.connect() as _conn:
        _conn.execute(_text("CREATE INDEX IF NOT EXISTS ix_matches_status ON matches (status)"))
        _conn.execute(_text("CREATE INDEX IF NOT EXISTS ix_matches_league_id ON matches (league_id)"))
        _conn.execute(_text("CREATE INDEX IF NOT EXISTS ix_prediction_user_match ON predictions (user_id, match_id)"))
        _conn.execute(_text("CREATE INDEX IF NOT EXISTS ix_chat_messages_created_at ON chat_messages (created_at)"))
        _conn.execute(_text("ALTER TABLE game_settings ADD COLUMN IF NOT EXISTS world_cup_only BOOLEAN NOT NULL DEFAULT FALSE"))
        _conn.execute(_text("""
            CREATE TABLE IF NOT EXISTS chat_typing (
                user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
                league_id INTEGER REFERENCES private_leagues(id) ON DELETE CASCADE,
                typed_at TIMESTAMP NOT NULL
            )
        """))
        _conn.commit()
except Exception:
    pass


@app.get("/api/health")
def health():
    return {"status": "ok", "version": "0.1.0"}


