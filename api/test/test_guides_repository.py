"""Repository layer: the only place that talks to the ORM. Fixtures live in conftest.py."""

import uuid
from datetime import UTC, datetime

from db import guides

STEPS = [
    {
        "position": 1,
        "title": "Entrada",
        "start_seconds": 0.0,
        "end_seconds": 6.0,
        "photo_second": 3.0,
        "easy_read_text": "Entras por una puerta de cristal. Se abre sola.",
        "category": "entrance",
    },
    {
        "position": 2,
        "title": "Recepcion",
        "start_seconds": 6.0,
        "end_seconds": 12.0,
        "photo_second": 9.0,
        "easy_read_text": "Llegas al mostrador azul. Dices tu nombre.",
        "category": "reception",
    },
]


def test_a_new_guide_is_created_as_a_draft_with_its_steps(db_session):
    created = guides.create(db_session, venue_name="Centro de salud Trinidad", steps=STEPS)

    assert created.status == "draft"
    assert created.public_slug is None
    assert [s.title for s in created.steps] == ["Entrada", "Recepcion"]


def test_get_returns_the_guide_by_id(db_session):
    created = guides.create(db_session, venue_name="Centro", steps=STEPS)

    assert guides.get(db_session, created.id) is created


def test_get_returns_nothing_for_an_unknown_id(db_session):
    assert guides.get(db_session, uuid.uuid4()) is None


def test_the_public_link_never_serves_a_draft(db_session):
    """Invariant: nothing reaches the public link until a human publishes it."""
    created = guides.create(db_session, venue_name="Centro", steps=STEPS)
    created.public_slug = "centro"
    db_session.flush()

    assert guides.get_published(db_session, "centro") is None


def test_the_public_link_serves_a_published_guide(db_session):
    created = guides.create(db_session, venue_name="Centro de salud Trinidad", steps=STEPS)
    guides.publish(db_session, created)

    assert guides.get_published(db_session, created.public_slug) is created


def test_publishing_records_the_review_date(db_session):
    """The public guide always shows when a human last reviewed it."""
    created = guides.create(db_session, venue_name="Centro", steps=STEPS)

    guides.publish(db_session, created)

    assert created.status == "published"
    assert created.reviewed_at is not None


def test_publishing_derives_the_slug_from_the_venue_name(db_session):
    created = guides.create(db_session, venue_name="Centro de salud Trinidad", steps=STEPS)

    guides.publish(db_session, created)

    assert created.public_slug == "centro-de-salud-trinidad"


def test_two_venues_with_the_same_name_get_different_slugs(db_session):
    first = guides.create(db_session, venue_name="Centro de salud", steps=STEPS)
    second = guides.create(db_session, venue_name="Centro de salud", steps=STEPS)

    guides.publish(db_session, first)
    guides.publish(db_session, second)

    assert first.public_slug == "centro-de-salud"
    assert second.public_slug != first.public_slug


def test_accents_and_symbols_do_not_reach_the_slug(db_session):
    created = guides.create(db_session, venue_name="Hospital Vall d'Hebron (Area General)", steps=STEPS)

    guides.publish(db_session, created)

    assert created.public_slug == "hospital-vall-d-hebron-area-general"


def test_listing_guides_is_paginated(db_session):
    for index in range(5):
        guides.create(db_session, venue_name=f"Centro {index}", steps=STEPS)

    page = guides.list_guides(db_session, limit=2, offset=2)

    assert len(page) == 2


def test_listing_shows_the_most_recent_guides_first(db_session):
    # now() is the transaction timestamp, shared by both rows, so the dates are set by hand.
    older = guides.create(db_session, venue_name="Primero", steps=STEPS)
    newer = guides.create(db_session, venue_name="Segundo", steps=STEPS)
    older.created_at = datetime(2026, 1, 1, tzinfo=UTC)
    newer.created_at = datetime(2026, 6, 1, tzinfo=UTC)
    db_session.flush()

    page = guides.list_guides(db_session, limit=10, offset=0)

    assert [g.venue_name for g in page] == ["Segundo", "Primero"]
