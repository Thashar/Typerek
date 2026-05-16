from pydantic import field_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite:///./typerek.db"
    SECRET_KEY: str = "dev-secret-key-zmien-w-produkcji"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30
    API_FOOTBALL_KEY: str = ""
    API_FOOTBALL_VIA_RAPIDAPI: bool = False
    CRON_SECRET: str = ""

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def strip_url(cls, v: str) -> str:
        return v.strip()

    class Config:
        env_file = ".env"


settings = Settings()
