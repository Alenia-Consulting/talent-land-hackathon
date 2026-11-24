"""Guide and Step models.

The CI has no PostgreSQL, so these tests run against in-memory SQLite. create_all() here builds a
throwaway schema for a single test; the real schema is only ever changed by Alembic migrations.
"""

import uuid

import pytest
from sqlalchemy import create_engine
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from db.models import Base, Guide, Step


@pytest.fixture
def db_session():
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        yield session
    engine.dispose()


def guide(**overrides) -> Guide:
    values = {"venue_name": "Centro de salud Trinidad", "public_slug": f"slug-{uuid.uuid4().hex}"}
    values.update(overrides)
    return Guide(**values)


def test_new_guide_is_a_draft(db_session):
    """Nothing reaches the public link until a human publishes it."""
    db_session.add(guide())
    db_session.commit()

    assert db_session.query(Guide).one().status == "draft"


def test_guide_rejects_an_unknown_status(db_session):
    db_session.add(guide(status="live"))

    with pytest.raises(IntegrityError):
        db_session.commit()


def test_public_slug_is_unique(db_session):
    db_session.add(guide(public_slug="centro-trinidad"))
    db_session.commit()
    db_session.add(guide(public_slug="centro-trinidad"))

    with pytest.raises(IntegrityError):
        db_session.commit()


def test_guide_requires_a_venue_name(db_session):
    db_session.add(guide(venue_name=None))

    with pytest.raises(IntegrityError):
        db_session.commit()


def step(**overrides) -> Step:
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


def test_steps_keep_the_order_of_the_route(db_session):
    saved = guide()
    saved.steps = [step(position=2, title="Espera"), step(position=1, title="Recepcion")]
    db_session.add(saved)
    db_session.commit()

    assert [s.title for s in saved.steps] == ["Recepcion", "Espera"]


def test_two_steps_cannot_share_a_position_in_the_same_guide(db_session):
    saved = guide()
    saved.steps = [step(position=1), step(position=1, title="Otra")]
    db_session.add(saved)

    with pytest.raises(IntegrityError):
        db_session.commit()


def test_step_rejects_an_unknown_noise_level(db_session):
    saved = guide()
    saved.steps = [step(noise_level="deafening")]
    db_session.add(saved)

    with pytest.raises(IntegrityError):
        db_session.commit()


def test_noise_level_is_empty_until_the_audio_is_measured(db_session):
    """Gemini writes the texts; the noise level only exists after the backend measures the audio."""
    saved = guide()
    saved.steps = [step()]
    db_session.add(saved)
    db_session.commit()

    assert saved.steps[0].noise_level is None
    assert saved.steps[0].sound_available is False


def test_what_to_expect_stores_a_list_of_warnings(db_session):
    saved = guide()
    saved.steps = [step(what_to_expect=["Puede haber una fila", "Suena un pitido"])]
    db_session.add(saved)
    db_session.commit()
    db_session.expire_all()

    assert db_session.query(Step).one().what_to_expect == [
        "Puede haber una fila",
        "Suena un pitido",
    ]


def test_deleting_a_guide_deletes_its_steps(db_session):
    saved = guide()
    saved.steps = [step()]
    db_session.add(saved)
    db_session.commit()

    db_session.delete(saved)
    db_session.commit()

    assert db_session.query(Step).count() == 0
