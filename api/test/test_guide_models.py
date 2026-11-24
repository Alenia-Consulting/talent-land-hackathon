"""Guide and Step models. Fixtures live in conftest.py."""

import pytest
from sqlalchemy.exc import IntegrityError

from db.models import Guide, Step


def test_new_guide_is_a_draft(db_session, make_guide, make_step):
    """Nothing reaches the public link until a human publishes it."""
    db_session.add(make_guide())
    db_session.commit()

    assert db_session.query(Guide).one().status == "draft"


def test_guide_rejects_an_unknown_status(db_session, make_guide, make_step):
    db_session.add(make_guide(status="live"))

    with pytest.raises(IntegrityError):
        db_session.commit()


def test_public_slug_is_unique(db_session, make_guide, make_step):
    db_session.add(make_guide(public_slug="centro-trinidad"))
    db_session.commit()
    db_session.add(make_guide(public_slug="centro-trinidad"))

    with pytest.raises(IntegrityError):
        db_session.commit()


def test_guide_requires_a_venue_name(db_session, make_guide, make_step):
    db_session.add(make_guide(venue_name=None))

    with pytest.raises(IntegrityError):
        db_session.commit()


def make_step(**overrides) -> Step:
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


def test_steps_keep_the_order_of_the_route(db_session, make_guide, make_step):
    saved = make_guide()
    saved.steps = [make_step(position=2, title="Espera"), make_step(position=1, title="Recepcion")]
    db_session.add(saved)
    db_session.commit()

    assert [s.title for s in saved.steps] == ["Recepcion", "Espera"]


def test_two_steps_cannot_share_a_position_in_the_same_guide(db_session, make_guide, make_step):
    saved = make_guide()
    saved.steps = [make_step(position=1), make_step(position=1, title="Otra")]
    db_session.add(saved)

    with pytest.raises(IntegrityError):
        db_session.commit()


def test_step_rejects_an_unknown_noise_level(db_session, make_guide, make_step):
    saved = make_guide()
    saved.steps = [make_step(noise_level="deafening")]
    db_session.add(saved)

    with pytest.raises(IntegrityError):
        db_session.commit()


def test_noise_level_is_empty_until_the_audio_is_measured(db_session, make_guide, make_step):
    """Gemini writes the texts; the noise level only exists after the backend measures the audio."""
    saved = make_guide()
    saved.steps = [make_step()]
    db_session.add(saved)
    db_session.commit()

    assert saved.steps[0].noise_level is None
    assert saved.steps[0].sound_available is False


def test_what_to_expect_stores_a_list_of_warnings(db_session, make_guide, make_step):
    saved = make_guide()
    saved.steps = [make_step(what_to_expect=["Puede haber una fila", "Suena un pitido"])]
    db_session.add(saved)
    db_session.commit()
    db_session.expire_all()

    assert db_session.query(Step).one().what_to_expect == [
        "Puede haber una fila",
        "Suena un pitido",
    ]


def test_deleting_a_guide_deletes_its_steps(db_session, make_guide, make_step):
    saved = make_guide()
    saved.steps = [make_step()]
    db_session.add(saved)
    db_session.commit()

    db_session.delete(saved)
    db_session.commit()

    assert db_session.query(Step).count() == 0


def test_a_guide_has_its_own_title_besides_the_venue(db_session, make_guide, make_step):
    """A venue has several guides: "Recorrido principal", "Sala de rayos X"."""
    db_session.add(make_guide(title="Sala de rayos X", venue_name="Clinica Dental Alameda"))
    db_session.commit()

    saved = db_session.query(Guide).one()
    assert (saved.title, saved.venue_name) == ("Sala de rayos X", "Clinica Dental Alameda")


def test_a_published_guide_can_go_back_to_needing_review(db_session, make_guide, make_step):
    """The venue changed: the panel shows "Revisar cambios" until someone looks again."""
    saved = make_guide(status="needs_review")
    db_session.add(saved)
    db_session.commit()

    assert db_session.query(Guide).one().status == "needs_review"


def test_a_step_records_which_data_the_ai_left_blank(db_session, make_guide, make_step):
    """The panel shows "Falta: a quien pedir ayuda" and blocks publishing until it is filled."""
    saved = make_guide()
    saved.steps = [make_step(missing_fields=["who_to_ask_for_help", "duration_text"])]
    db_session.add(saved)
    db_session.commit()
    db_session.expire_all()

    assert db_session.query(Step).one().missing_fields == [
        "who_to_ask_for_help",
        "duration_text",
    ]


def test_a_fresh_step_is_not_reviewed_and_has_no_missing_data(db_session, make_guide, make_step):
    saved = make_guide()
    saved.steps = [make_step()]
    db_session.add(saved)
    db_session.commit()

    step = db_session.query(Step).one()
    assert step.reviewed is False
    assert step.missing_fields == []
    assert step.duration_text is None


def test_the_noise_level_remembers_if_a_person_corrected_it(db_session, make_guide, make_step):
    """The panel shows "Nivel de ruido - medido", and the venue may override it."""
    saved = make_guide()
    saved.steps = [make_step(noise_level="noisy", noise_level_source="manual")]
    db_session.add(saved)
    db_session.commit()

    assert db_session.query(Step).one().noise_level_source == "manual"


def test_the_noise_level_source_must_be_known(db_session, make_guide, make_step):
    saved = make_guide()
    saved.steps = [make_step(noise_level="noisy", noise_level_source="guessed")]
    db_session.add(saved)

    with pytest.raises(IntegrityError):
        db_session.commit()


def test_a_step_carries_the_interests_it_answers(db_session, make_guide, make_step):
    """Drives the "Que quieres ver antes?" filter: a step can answer several interests."""
    saved = make_guide()
    saved.steps = [make_step(interests=["where_to_wait", "who_to_ask"])]
    db_session.add(saved)
    db_session.commit()
    db_session.expire_all()

    assert db_session.query(Step).one().interests == ["where_to_wait", "who_to_ask"]
