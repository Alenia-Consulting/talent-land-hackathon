"""Engine and sessions built from DATABASE_URL. Nothing connects at import time, so the app (and the
CI) can import without a database; the engine is created on first use."""

import os
from collections.abc import Iterator
from functools import lru_cache

from sqlalchemy import Engine, create_engine, text
from sqlalchemy.orm import Session, sessionmaker


def database_url() -> str:
    url = os.getenv("DATABASE_URL", "")
    if not url:
        raise RuntimeError("DATABASE_URL is missing, see api/.env.example")
    return url


@lru_cache(maxsize=1)
def get_engine() -> Engine:
    return create_engine(database_url(), pool_pre_ping=True)


@lru_cache(maxsize=1)
def get_sessionmaker() -> sessionmaker[Session]:
    return sessionmaker(bind=get_engine(), expire_on_commit=False)


def get_session() -> Iterator[Session]:
    """FastAPI dependency: one session per request, always closed.

    Usage: def route(session: Session = Depends(get_session)): ...
    """
    with get_sessionmaker()() as session:
        yield session


def ping() -> None:
    """Raise if the database cannot be reached."""
    with get_engine().connect() as connection:
        connection.execute(text("SELECT 1"))
