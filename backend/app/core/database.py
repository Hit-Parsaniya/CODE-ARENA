from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from typing import Generator
from app.core.config import settings

from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent.parent
SQLITE_DB_PATH = BASE_DIR / "aicode_dev.db"

try:
    connect_args = {"connect_timeout": 3} if "postgresql" in settings.DB_URL else {}
    engine = create_engine(
        settings.DB_URL,
        pool_pre_ping=True,
        connect_args=connect_args
    )
    with engine.connect() as _test_conn:
        pass
except Exception:
    # Graceful fallback to SQLite for local development without Postgres
    engine = create_engine(
        f"sqlite:///{SQLITE_DB_PATH.as_posix()}",
        connect_args={"check_same_thread": False}
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db() -> Generator:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
