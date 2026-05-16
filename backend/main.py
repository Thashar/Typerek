from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from core.database import engine, Base

import models.user
import models.league
import models.match
import models.prediction
import models.private_league

from routers import auth, matches, cron, predictions, ranking, leagues

Base.metadata.create_all(bind=engine)

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


@app.get("/api/health")
def health():
    return {"status": "ok", "version": "0.1.0"}
