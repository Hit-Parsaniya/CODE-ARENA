from typing import List, Union
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

    PROJECT_NAME: str = "AI Code Review & Contest Platform"
    DB_URL: str = "postgresql+psycopg2://postgres:postgres@localhost:5432/aicode_db"
    JWT_SECRET: str = "dev_jwt_secret_change_in_production_key_random_32_bytes"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440
    ANTHROPIC_API_KEY: str = ""
    JUDGE0_URL: str = "https://ce.judge0.com"
    JUDGE0_API_KEY: str = ""
    JUDGE0_API_HOST: str = "judge0-ce.p.rapidapi.com"
    CORS_ORIGINS: Union[List[str], str] = [
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:3000",
        "http://127.0.0.1:5173"
    ]

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v):
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",") if origin.strip()]
        return v


settings = Settings()
