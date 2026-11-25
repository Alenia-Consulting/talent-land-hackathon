"""Shared test fixtures.

The CI has no PostgreSQL, so the tests run against in-memory SQLite. create_all() here builds a
throwaway schema for a single test; the real schema is only ever changed by Alembic migrations.
"""

import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from db.models import Base, Guide, Step


@pytest.fixture
def db_session():
    # StaticPool keeps one connection for the whole engine: TestClient runs the app in another
    # thread, and a second connection to "sqlite://" would open a different, empty database.
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        yield session
    engine.dispose()


@pytest.fixture
def make_guide():
    def build(**overrides) -> Guide:
        values = {
            "title": "Recorrido principal",
            "venue_name": "Centro de salud Trinidad",
            "public_slug": f"slug-{uuid.uuid4().hex}",
        }
        values.update(overrides)
        return Guide(**values)

    return build


@pytest.fixture
def make_step():
    def build(**overrides) -> Step:
        values = {
            "position": 1,
            "title": "Recepcion",
            "start_seconds": 12.0,
            "end_seconds": 18.0,
            "photo_second": 15.0,
            "easy_read_text": "Llegas al mostrador azul. Dices tu nombre.",
            "category": "reception",
        }
        values.update(overrides)
        return Step(**values)

    return build


@pytest.fixture
def client(db_session):
    """HTTP client whose routes use the in-memory test session instead of PostgreSQL."""
    import main
    from db.session import get_session

    main.app.dependency_overrides[get_session] = lambda: db_session
    with TestClient(main.app) as test_client:
        yield test_client
    main.app.dependency_overrides.clear()


# Longer than any step a test writes, so retiming leaves the test's own timings alone.
UNMEASURABLE_UPLOAD_SECONDS = 1000.0


@pytest.fixture(autouse=True)
def measurable_upload(monkeypatch):
    """Upload tests send placeholder bytes, which no decoder can measure.

    A real video is measured for real; bytes that are not a video get a stand-in length.
    """
    from media import video_io
    from media.errors import ProcessingFailed

    real = video_io.duration

    def duration(video):
        try:
            return real(video)
        except ProcessingFailed:
            return UNMEASURABLE_UPLOAD_SECONDS

    monkeypatch.setattr(video_io, "duration", duration)
