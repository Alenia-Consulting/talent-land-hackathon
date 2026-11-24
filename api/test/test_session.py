"""The CI has no PostgreSQL: these tests use an in-memory SQLite URL to exercise the session layer."""

import pytest
from sqlalchemy.orm import Session

from db import session


def reset_engine():
    if session.get_engine.cache_info().currsize:
        session.get_engine().dispose()
    session.get_engine.cache_clear()
    session.get_sessionmaker.cache_clear()


@pytest.fixture(autouse=True)
def fresh_engine():
    reset_engine()
    yield
    reset_engine()


def test_database_url_missing(monkeypatch):
    monkeypatch.delenv("DATABASE_URL", raising=False)
    with pytest.raises(RuntimeError, match="DATABASE_URL"):
        session.database_url()


def test_ping(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "sqlite://")
    session.ping()


def test_get_session_yields_and_closes(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "sqlite://")
    dependency = session.get_session()
    db_session = next(dependency)
    assert isinstance(db_session, Session)
    dependency.close()
    assert session.get_engine() is session.get_engine()
