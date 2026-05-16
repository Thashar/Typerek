from datetime import datetime
from pydantic import BaseModel, field_validator


class CreateLeagueRequest(BaseModel):
    name: str

    @field_validator("name")
    @classmethod
    def name_valid(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 3 or len(v) > 100:
            raise ValueError("Nazwa ligi musi mieć 3–100 znaków")
        return v


class JoinLeagueRequest(BaseModel):
    invite_code: str


class PrivateLeagueResponse(BaseModel):
    id: int
    name: str
    invite_code: str
    owner_id: int
    created_at: datetime
    members_count: int

    model_config = {"from_attributes": True}
