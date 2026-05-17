from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from core.database import engine, Base

import models.user
import models.league
import models.match
import models.prediction
import models.private_league
import models.invite_code
import models.settings

from routers import auth, matches, cron, predictions, ranking, leagues, debug, admin, game_settings, users

app = FastAPI(title="Typerek API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
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

try:
    Base.metadata.create_all(bind=engine)
except Exception as e:
    print(f"[WARN] DB init failed: {e}")

try:
    from sqlalchemy import text as _text
    with engine.connect() as _conn:
        _conn.execute(_text("ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar TEXT"))
        _conn.commit()
except Exception:
    pass


@app.get("/api/health")
def health():
    return {"status": "ok", "version": "0.1.0"}


