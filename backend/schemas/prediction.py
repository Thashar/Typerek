from datetime import datetime
from pydantic import BaseModel, model_validator
from schemas.match import MatchResponse


class PredictionRequest(BaseModel):
    match_id: int
    predicted_home: int
    predicted_away: int

    @model_validator(mode="after")
    def scores_non_negative(self):
        if self.predicted_home < 0 or self.predicted_away < 0:
            raise ValueError("Wynik nie może być ujemny")
        return self


class PredictionResponse(BaseModel):
    id: int
    match_id: int
    predicted_home: int
    predicted_away: int
    predicted_outcome: str
    points: int | None
    created_at: datetime
    match: MatchResponse

    model_config = {"from_attributes": True}


class PredictionSummary(BaseModel):
    id: int
    match_id: int
    predicted_home: int
    predicted_away: int
    predicted_outcome: str
    points: int | None

    model_config = {"from_attributes": True}
