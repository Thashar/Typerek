from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite:///./typerek.db"
    SECRET_KEY: str = "dev-secret-key-zmien-w-produkcji"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30
    API_FOOTBALL_KEY: str = ""

    class Config:
        env_file = ".env"


settings = Settings()
