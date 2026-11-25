"""Repository layer: the only place that talks to the ORM. Fixtures live in conftest.py.

The route is not detected by the AI: the person picks the parts before recording and taps
"Llegue a: X" on each one. The repository turns those marks into steps.
"""

import uuid
from datetime import UTC, datetime

import pytest

from db import guides

MARKS = [
    {"title": "Entrada", "category": "entrance", "marked_at_seconds": 0.0},
    {"title": "Recepcion", "category": "reception", "marked_at_seconds": 12.0},
    {"title": "Sala de espera", "category": "waiting", "marked_at_seconds": 30.0},
]


def create(session, **overrides):
    values = {
        "title": "Recorrido principal",
        "venue_name": "Centro de salud Trinidad",
        "marks": MARKS,
        "video_duration_seconds": 48.0,
    }
    values.update(overrides)
    return guides.create(session, **values)


def complete(guide):
    """Fill in what a human would fill in before approving."""
    for step in guide.steps:
        step.easy_read_text = "Entras por una puerta de cristal. Se abre sola."
        step.missing_fields = []
        step.reviewed = True


def test_each_mark_becomes_a_step_in_order(db_session):
    created = create(db_session)

    assert [(s.position, s.title) for s in created.steps] == [
        (1, "Entrada"),
        (2, "Recepcion"),
        (3, "Sala de espera"),
    ]


def test_a_step_runs_from_its_mark_to_the_next_one(db_session):
    created = create(db_session)

    assert (created.steps[0].start_seconds, created.steps[0].end_seconds) == (0.0, 12.0)
    assert (created.steps[1].start_seconds, created.steps[1].end_seconds) == (12.0, 30.0)


def test_the_last_step_runs_until_the_video_ends(db_session):
    created = create(db_session)

    assert created.steps[-1].end_seconds == 48.0


def test_the_photo_is_taken_while_the_person_stands_still(db_session):
    """The UI asks for a 3 second pause on arrival: the clearest frame is in the middle of it."""
    created = create(db_session)

    assert created.steps[1].photo_second == 13.5


def test_a_very_short_step_still_keeps_its_photo_inside_the_clip(db_session):
    created = create(
        db_session,
        marks=[
            {"title": "Entrada", "category": "entrance", "marked_at_seconds": 0.0},
            {"title": "Recepcion", "category": "reception", "marked_at_seconds": 1.0},
        ],
        video_duration_seconds=2.0,
    )

    first = created.steps[0]
    assert first.start_seconds <= first.photo_second <= first.end_seconds


def test_marks_must_move_forward_in_time(db_session):
    with pytest.raises(ValueError, match="forward"):
        create(
            db_session,
            marks=[
                {"title": "Entrada", "category": "entrance", "marked_at_seconds": 10.0},
                {"title": "Recepcion", "category": "reception", "marked_at_seconds": 4.0},
            ],
        )


def test_the_video_cannot_end_before_the_last_mark(db_session):
    with pytest.raises(ValueError, match="video"):
        create(db_session, video_duration_seconds=20.0)


def test_a_route_needs_at_least_one_mark(db_session):
    with pytest.raises(ValueError, match="one mark"):
        create(db_session, marks=[])


def test_a_single_mark_runs_to_the_end_of_the_video(db_session):
    created = create(db_session, marks=MARKS[:1])

    assert len(created.steps) == 1
    assert created.steps[0].end_seconds == 48.0


def test_a_new_step_has_no_text_yet(db_session):
    """Gemini writes the easy-read text later. Nothing is invented at creation time."""
    created = create(db_session)

    assert created.steps[0].easy_read_text is None
    assert created.steps[0].reviewed is False


def test_publishing_is_blocked_while_a_step_has_no_text(db_session):
    created = create(db_session)

    with pytest.raises(ValueError, match="not ready"):
        guides.publish(db_session, created)


def test_publishing_is_blocked_while_data_is_missing(db_session):
    created = create(db_session)
    complete(created)
    created.steps[1].missing_fields = ["who_to_ask_for_help"]

    with pytest.raises(ValueError, match="not ready"):
        guides.publish(db_session, created)


def test_publishing_is_blocked_until_every_step_is_reviewed(db_session):
    created = create(db_session)
    complete(created)
    created.steps[2].reviewed = False

    with pytest.raises(ValueError, match="not ready"):
        guides.publish(db_session, created)


def test_publishing_works_once_a_person_completed_everything(db_session):
    created = create(db_session)
    complete(created)

    guides.publish(db_session, created)

    assert created.status == "published"
    assert created.reviewed_at is not None
    assert created.public_slug == "centro-de-salud-trinidad"


def test_what_is_still_pending_can_be_asked_for(db_session):
    """Drives "3 de 5 pasos revisados" and "2 datos por completar" in the panel."""
    created = create(db_session)
    complete(created)
    created.steps[0].reviewed = False
    created.steps[1].missing_fields = ["duration_text"]

    pending = guides.pending_before_publishing(created)

    assert pending == {"steps_reviewed": 2, "steps_total": 3, "missing_data": 1}


def test_get_returns_the_guide_by_id(db_session):
    created = create(db_session)

    assert guides.get(db_session, created.id) is created


def test_get_returns_nothing_for_an_unknown_id(db_session):
    assert guides.get(db_session, uuid.uuid4()) is None


def test_the_public_link_never_serves_a_draft(db_session):
    created = create(db_session)
    created.public_slug = "centro"
    db_session.flush()

    assert guides.get_published(db_session, "centro") is None


def test_the_public_link_serves_a_published_guide(db_session):
    created = create(db_session)
    complete(created)
    guides.publish(db_session, created)

    assert guides.get_published(db_session, created.public_slug) is created


def test_two_venues_with_the_same_name_get_different_slugs(db_session):
    first = create(db_session, venue_name="Centro de salud")
    second = create(db_session, venue_name="Centro de salud")
    complete(first)
    complete(second)

    guides.publish(db_session, first)
    guides.publish(db_session, second)

    assert first.public_slug == "centro-de-salud"
    assert second.public_slug != first.public_slug


def test_accents_and_symbols_do_not_reach_the_slug(db_session):
    created = create(db_session, venue_name="Hospital Vall d'Hebron (Area General)")
    complete(created)

    guides.publish(db_session, created)

    assert created.public_slug == "hospital-vall-d-hebron-area-general"


def test_listing_guides_is_paginated(db_session):
    for index in range(5):
        create(db_session, venue_name=f"Centro {index}")

    assert len(guides.list_guides(db_session, limit=2, offset=2)) == 2


def test_listing_shows_the_most_recent_guides_first(db_session):
    # now() is the transaction timestamp, shared by both rows, so the dates are set by hand.
    older = create(db_session, venue_name="Primero")
    newer = create(db_session, venue_name="Segundo")
    older.created_at = datetime(2026, 1, 1, tzinfo=UTC)
    newer.created_at = datetime(2026, 6, 1, tzinfo=UTC)
    db_session.flush()

    assert [g.venue_name for g in guides.list_guides(db_session)] == ["Segundo", "Primero"]


def test_the_catalogue_only_has_published_guides(db_session, make_guide):
    db_session.add_all([
        make_guide(venue_name="Centro A", status="published"),
        make_guide(venue_name="Centro B", status="draft"),
        make_guide(venue_name="Centro C", status="needs_review"),
    ])
    db_session.commit()

    assert [g.venue_name for g in guides.list_published(db_session)] == ["Centro A"]


def test_the_catalogue_is_alphabetical_so_it_can_be_browsed(db_session, make_guide):
    for venue, title in (("Hospital Sur", "Urgencias"), ("Centro Trinidad", "Principal"),
                         ("Hospital Sur", "Consultas")):
        db_session.add(make_guide(venue_name=venue, title=title, status="published"))
    db_session.commit()

    assert [(g.venue_name, g.title) for g in guides.list_published(db_session)] == [
        ("Centro Trinidad", "Principal"),
        ("Hospital Sur", "Consultas"),
        ("Hospital Sur", "Urgencias"),
    ]


def test_a_published_guide_without_a_slug_stays_out_of_the_catalogue(db_session, make_guide):
    db_session.add(make_guide(venue_name="Centro sin enlace", status="published", public_slug=None))
    db_session.commit()

    assert guides.list_published(db_session) == []


def test_the_catalogue_is_one_page_at_a_time(db_session, make_guide):
    for n in range(3):
        db_session.add(make_guide(venue_name=f"Centro {n}", status="published"))
    db_session.commit()

    assert len(guides.list_published(db_session, limit=2)) == 2
    assert [g.venue_name for g in guides.list_published(db_session, limit=2, offset=2)] == ["Centro 2"]


# `make_guide` builds a bare Guide, with no routes or steps: a guide with routes is built here.
def _one_take(db_session, seconds: float):
    return guides.create(db_session, title="Recorrido principal", venue_name="Centro Trinidad",
                         marks=[{"title": "Entrada", "category": "entrance",
                                 "marked_at_seconds": 0.0}],
                         video_duration_seconds=seconds)


def test_retiming_stretches_a_step_when_the_file_is_longer(db_session):
    """El reloj del móvil se queda corto al llegar al tope: la cola no se pierde."""
    route = _one_take(db_session, 120.0).routes[0]

    guides.retime_route(route, 120.4)

    assert route.steps[0].end_seconds == 120.4
    assert route.video_duration_seconds == 120.4


def test_retiming_shortens_a_step_when_the_file_is_shorter(db_session):
    route = _one_take(db_session, 30.0).routes[0]

    guides.retime_route(route, 18.5)

    assert route.steps[0].end_seconds == 18.5


def test_retiming_puts_the_photo_in_the_middle_of_the_step(db_session):
    """Hoy sale «marca + 1,5 s»: el instante justo después de pulsar Grabar."""
    route = _one_take(db_session, 30.0).routes[0]

    guides.retime_route(route, 20.0)

    assert route.steps[0].photo_second == 10.0


def test_retiming_adds_up_the_duration_of_the_whole_guide(db_session):
    guide = _one_take(db_session, 30.0)
    guides.add_route(db_session, guide, title="Recepción",
                     marks=[{"title": "Recepción", "category": "reception",
                             "marked_at_seconds": 0.0}],
                     video_duration_seconds=30.0)

    guides.retime_route(guide.routes[0], 18.0)

    assert guide.video_duration_seconds == 48.0


def test_retiming_chains_the_steps_and_clamps_marks_past_the_end(db_session):
    guide = create(db_session)  # marks at 0, 12 and 30

    guides.retime_route(guide.routes[0], 20.0)

    steps = guide.routes[0].steps
    assert [(s.start_seconds, s.end_seconds) for s in steps] == [(0.0, 12.0), (12.0, 20.0), (19.0, 20.0)]


def test_a_mark_past_the_end_keeps_a_short_clip_at_the_tail(db_session):
    """The file is shorter than the phone's clock: the last part was marked after it ended."""
    guide = create(db_session)  # marks at 0, 12 and 30

    guides.retime_route(guide.routes[0], 12.0)

    last = guide.routes[0].steps[-1]
    assert (last.start_seconds, last.end_seconds) == (11.0, 12.0)
    assert last.photo_second == 11.5


def test_a_file_shorter_than_the_floor_is_the_whole_step(db_session):
    route = _one_take(db_session, 30.0).routes[0]

    guides.retime_route(route, 0.4)

    step = route.steps[0]
    assert (step.start_seconds, step.end_seconds) == (0.0, 0.4)
