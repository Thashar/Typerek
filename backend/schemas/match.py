from datetime import datetime
from pydantic import BaseModel
from models.match import MatchStatus


class LeagueInfo(BaseModel):
    id: int
    name: str
    country: str
    logo_url: str | None

    model_config = {"from_attributes": True}


class MatchResponse(BaseModel):
    id: int
    api_id: int
    home_team: str
    away_team: str
    home_team_logo: str | None
    away_team_logo: str | None
    kickoff: datetime
    status: MatchStatus
    home_score: int | None
    away_score: int | None
    result: str | None
    league: LeagueInfo

    model_config = {"from_attributes": True}


class MatchListResponse(BaseModel):
    matches: list[MatchResponse]
    total: int
