"""REST API for guides. Fixtures live in conftest.py.

The routes are mounted under root_path="/api", so the public URLs are /api/guides and friends.
"""

import uuid

PAYLOAD = {
    "title": "Recorrido principal",
    "venue_name": "Clinica Dental Alameda",
    "video_duration_seconds": 48.0,
    "marks": [
        {"title": "Entrada", "category": "entrance", "marked_at_seconds": 0.0},
        {"title": "Recepcion", "category": "reception", "marked_at_seconds": 12.0},
        {"title": "Sala de espera", "category": "waiting", "marked_at_seconds": 30.0},
    ],
}


def create_guide(client, **overrides):
    return client.post("/guides", json={**PAYLOAD, **overrides})


def complete_every_step(client, guide):
    """What the review panel does before approving."""
    for step in guide["steps"]:
        client.patch(
            f"/guides/{guide['id']}/steps/{step['id']}",
            json={
                "easy_read_text": "Entras por una puerta de cristal. Se abre sola.",
                "missing_fields": [],
                "reviewed": True,
            },
        )


def test_the_marks_become_the_steps_of_the_route(client):
    response = create_guide(client)

    assert response.status_code == 201
    body = response.json()
    assert body["status"] == "draft"
    assert [(s["order"], s["title"]) for s in body["steps"]] == [
        (1, "Entrada"),
        (2, "Recepcion"),
        (3, "Sala de espera"),
    ]


def test_a_step_runs_from_its_mark_to_the_next(client):
    steps = create_guide(client).json()["steps"]

    assert (steps[0]["start_seconds"], steps[0]["end_seconds"]) == (0.0, 12.0)
    assert steps[-1]["end_seconds"] == 48.0


def test_a_new_step_has_no_text_and_no_media(client):
    """Nothing is invented: Gemini and the media pipeline fill these in later."""
    step = create_guide(client).json()["steps"][0]

    assert step["easy_read_text"] is None
    assert step["clip_url"] is None
    assert step["noise_level"] is None
    assert step["reviewed"] is False
    assert step["missing_fields"] == []


def test_the_api_speaks_the_contract(client):
    step = create_guide(client).json()["steps"][0]

    assert "position" not in step
    assert set(step) >= {
        "id",
        "order",
        "title",
        "start_seconds",
        "end_seconds",
        "photo_second",
        "easy_read_text",
        "what_to_expect",
        "who_to_ask_for_help",
        "duration_text",
        "category",
        "interests",
        "points_of_interest",
        "missing_fields",
        "reviewed",
        "clip_url",
        "photo_url",
        "sound_available",
        "sound_url",
        "noise_level",
        "noise_level_source",
        "pictogram_url",
    }


def test_marks_that_go_backwards_are_rejected(client):
    response = create_guide(
        client,
        marks=[
            {"title": "Entrada", "category": "entrance", "marked_at_seconds": 10.0},
            {"title": "Recepcion", "category": "reception", "marked_at_seconds": 4.0},
        ],
    )

    assert response.status_code == 422
    assert "forward" in response.json()["detail"]


def test_a_single_mark_is_a_route_that_runs_to_the_end_of_the_video(client):
    response = create_guide(client, marks=PAYLOAD["marks"][:1])

    assert response.status_code == 201
    steps = response.json()["steps"]
    assert len(steps) == 1
    assert steps[0]["end_seconds"] == PAYLOAD["video_duration_seconds"]


def test_a_route_without_marks_is_rejected(client):
    response = create_guide(client, marks=[])

    assert response.status_code == 422


def test_the_detail_says_what_is_still_pending(client):
    """Feeds "3 de 5 pasos revisados" and "2 datos por completar" in the panel."""
    created = create_guide(client).json()

    pending = client.get(f"/guides/{created['id']}").json()["pending"]

    assert pending == {"steps_total": 3, "steps_reviewed": 0, "missing_data": 3}


def test_publishing_is_refused_while_the_guide_is_incomplete(client):
    created = create_guide(client).json()

    response = client.post(f"/guides/{created['id']}/publish")

    assert response.status_code == 409
    assert "not ready" in response.json()["detail"]


def test_a_step_can_be_completed_from_the_panel(client):
    created = create_guide(client).json()
    step = created["steps"][1]

    response = client.patch(
        f"/guides/{created['id']}/steps/{step['id']}",
        json={"who_to_ask_for_help": "La persona del mostrador azul", "noise_level": "noisy"},
    )

    assert response.status_code == 200
    updated = response.json()["steps"][1]
    assert updated["who_to_ask_for_help"] == "La persona del mostrador azul"
    assert updated["noise_level"] == "noisy"
    # A person set it by hand, so it is no longer the measured value.
    assert updated["noise_level_source"] == "manual"


def test_patching_an_unknown_step_returns_404(client):
    created = create_guide(client).json()

    response = client.patch(
        f"/guides/{created['id']}/steps/{uuid.uuid4()}", json={"reviewed": True}
    )

    assert response.status_code == 404


def test_publishing_opens_the_public_link_once_everything_is_complete(client):
    created = create_guide(client).json()
    complete_every_step(client, created)

    published = client.post(f"/guides/{created['id']}/publish").json()

    assert published["status"] == "published"
    assert published["public_slug"] == "clinica-dental-alameda"
    assert published["reviewed_at"] is not None
    assert client.get("/public/clinica-dental-alameda").status_code == 200


def test_the_public_link_refuses_a_draft(client):
    create_guide(client)

    response = client.get("/public/clinica-dental-alameda")

    assert response.status_code == 404
    assert response.json()["detail"] == "guide not found"


def test_reading_an_unknown_guide_returns_404(client):
    response = client.get(f"/guides/{uuid.uuid4()}")

    assert response.status_code == 404
    assert response.json()["detail"] == "guide not found"


def test_publishing_an_unknown_guide_returns_404(client):
    response = client.post(f"/guides/{uuid.uuid4()}/publish")

    assert response.status_code == 404
    assert response.json()["detail"] == "guide not found"


def test_listing_guides_is_paginated(client):
    for index in range(3):
        create_guide(client, venue_name=f"Centro {index}")

    assert len(client.get("/guides", params={"limit": 2}).json()) == 2


def test_the_listing_carries_the_title_but_not_the_steps(client):
    create_guide(client)

    row = client.get("/guides").json()[0]

    assert row["title"] == "Recorrido principal"
    assert "steps" not in row
