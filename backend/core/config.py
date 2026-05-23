from pydantic import field_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite:///./typerek.db"
    SECRET_KEY: str = "dev-secret-key-zmien-w-produkcji"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30
    FOOTBALL_DATA_API_KEY: str = ""
    CRON_SECRET: str = ""
    RESEND_API_KEY: str = ""
    RESEND_FROM: str = "TypeRek <onboarding@resend.dev>"
    FRONTEND_URL: str = "https://typerek-ngk.vercel.app"

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def strip_url(cls, v: str) -> str:
        return v.replace("\n", "").replace("\r", "").strip()

    class Config:
        env_file = ".env"


settings = Settings()
