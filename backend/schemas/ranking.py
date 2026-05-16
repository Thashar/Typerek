from pydantic import BaseModel


class RankingEntry(BaseModel):
    rank: int
    user_id: int
    username: str
    total_points: int
    predictions_count: int
    exact_hits: int
    outcome_hits: int

    model_config = {"from_attributes": True}


class RankingResponse(BaseModel):
    entries: list[RankingEntry]
    total: int


class PrivateLeagueRanking(BaseModel):
    league_id: int
    league_name: str
    entries: list[RankingEntry]
