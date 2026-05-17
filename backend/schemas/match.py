from datetime import datetime
from pydantic import BaseModel, field_validator
from models.match import MatchStatus
from core.translations import translate_team, translate_country


class LeagueInfo(BaseModel):
    id: int
    name: str
    country: str
    logo_url: str | None

    model_config = {"from_attributes": True}

    @field_validator("country", mode="before")
    @classmethod
    def translate_c(cls, v: str) -> str:
        return translate_country(v)


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
    minute: int | None
    status_short: str | None
    result: str | None
    stage: str | None
    match_group: str | None
    league: LeagueInfo

    model_config = {"from_attributes": True}

    @field_validator("home_team", "away_team", mode="before")
    @classmethod
    def translate(cls, v: str) -> str:
        return translate_team(v)


class MatchListResponse(BaseModel):
    matches: list[MatchResponse]
    total: int
