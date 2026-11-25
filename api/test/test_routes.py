"""Several recordings per guide, and removing a guide for good."""

import io
import uuid

import pytest

from media import pipeline, storage
from test_guides_api import PAYLOAD, create_guide

ROUTE = {
    "title": "Sala de rayos X",
    "video_duration_seconds": 30.0,
    "marks": [
        {"title": "Pasillo", "category": "corridor", "marked_at_seconds": 0.0},
        {"title": "Rayos X", "category": "other", "marked_at_seconds": 15.0},
    ],
}


def add_route(client, guide_id, **overrides):
    return client.post(f"/guides/{guide_id}/routes", json={**ROUTE, **overrides})


def test_a_new_guide_has_one_route_holding_its_steps(client):
    guide = create_guide(client).json()

    assert [route["order"] for route in guide["routes"]] == [1]
    assert guide["routes"][0]["title"] == PAYLOAD["title"]
    assert {step["route_id"] for step in guide["steps"]} == {guide["routes"][0]["id"]}


def test_a_route_is_added_and_the_steps_continue_the_numbering(client):
    guide = create_guide(client).json()

    response = add_route(client, guide["id"])

    assert response.status_code == 201
    body = response.json()
    assert [route["order"] for route in body["routes"]] == [1, 2]
    assert [step["order"] for step in body["steps"]] == [1, 2, 3, 4, 5]
    assert {step["route_id"] for step in body["steps"][3:]} == {body["routes"][1]["id"]}
    assert body["routes"][1]["processing_status"] == "pending"


def test_adding_a_route_to_a_missing_guide_is_not_found(client):
    assert add_route(client, "00000000-0000-0000-0000-000000000000").status_code == 404


def test_a_route_with_marks_going_backwards_is_unprocessable(client):
    guide = create_guide(client).json()
    marks = list(reversed(ROUTE["marks"]))

    assert add_route(client, guide["id"], marks=marks).status_code == 422


def test_a_guide_without_routes_gets_one_when_needed(client, db_session, make_guide, make_step):
    legacy = make_guide()
    legacy.steps = [make_step(position=1)]
    db_session.add(legacy)
    db_session.commit()

    body = add_route(client, legacy.id).json()

    assert [route["order"] for route in body["routes"]] == [1, 2]
    assert {step["route_id"] for step in body["steps"]} == {r["id"] for r in body["routes"]}


def test_the_video_of_a_route_only_touches_that_route(client, monkeypatch, tmp_path):
    guide = add_route(client, create_guide(client).json()["id"]).json()
    second = guide["routes"][1]
    monkeypatch.setattr("routers.guides.UPLOAD_DIR", tmp_path)
    monkeypatch.setenv("SUPABASE_URL", "https://p.supabase.co")
    monkeypatch.delenv("SUPABASE_BUCKET", raising=False)
    seen = []

    def process(video, steps):
        seen.extend(step.position for step in steps)
        return [pipeline.ProcessedStep(position=4, clip=b"c", photo=b"p", sound=None, noise_level=None)]

    monkeypatch.setattr("media.pipeline.process", process)
    monkeypatch.setattr(
        "media.storage.config_from_env",
        lambda: storage.StorageConfig(url="https://p.supabase.co", key="k"),
    )
    monkeypatch.setattr("media.storage.upload", lambda config, path, *a, **kw: path)

    response = client.post(
        f"/guides/{guide['id']}/routes/{second['id']}/video",
        files={"video": ("r.mp4", io.BytesIO(b"x"), "video/mp4")},
    )

    assert response.status_code == 200, response.text
    assert seen == [4, 5]
    body = response.json()
    assert [route["processing_status"] for route in body["routes"]] == ["pending", "done"]
    assert body["steps"][3]["clip_url"].endswith(f"{guide['id']}/{body['steps'][3]['id']}.mp4")
    assert body["steps"][0]["clip_url"] is None


def test_the_video_of_an_unknown_route_is_not_found(client):
    guide = create_guide(client).json()

    response = client.post(
        f"/guides/{guide['id']}/routes/00000000-0000-0000-0000-000000000000/video",
        files={"video": ("r.mp4", io.BytesIO(b"x"), "video/mp4")},
    )

    assert response.status_code == 404


def _with_media(client, monkeypatch, removed):
    guide = add_route(client, create_guide(client).json()["id"]).json()
    monkeypatch.setattr(
        "media.storage.config_from_env",
        lambda: storage.StorageConfig(url="https://p.supabase.co", key="k"),
    )
    monkeypatch.setattr("media.storage.remove", lambda config, paths: removed.extend(paths))
    return guide


def test_deleting_a_guide_removes_its_files_and_its_rows(client, db_session, monkeypatch):
    from db import guides

    removed = []
    guide = _with_media(client, monkeypatch, removed)
    for step in guides.get(db_session, uuid.UUID(guide["id"])).steps[:2]:
        step.clip_path, step.photo_path = f"{guide['id']}/a.mp4", f"{guide['id']}/a.jpg"
    db_session.commit()

    response = client.delete(f"/guides/{guide['id']}")

    assert response.status_code == 204
    assert sorted(removed) == [f"{guide['id']}/a.jpg", f"{guide['id']}/a.mp4"] * 2 or len(removed) == 4
    assert client.get(f"/guides/{guide['id']}").status_code == 404


def test_a_published_guide_can_be_deleted_too(client, monkeypatch):
    from test_guides_api import complete_every_step

    guide = create_guide(client).json()
    complete_every_step(client, guide)
    published = client.post(f"/guides/{guide['id']}/publish").json()
    monkeypatch.setattr("media.storage.remove", lambda config, paths: None)

    assert client.delete(f"/guides/{guide['id']}").status_code == 204
    assert client.get(f"/public/{published['public_slug']}").status_code == 404


def test_a_storage_failure_keeps_the_guide(client, db_session, monkeypatch):
    from db import guides

    guide = create_guide(client).json()
    guides.get(db_session, uuid.UUID(guide["id"])).steps[0].clip_path = f"{guide['id']}/a.mp4"
    db_session.commit()
    monkeypatch.setattr(
        "media.storage.config_from_env",
        lambda: storage.StorageConfig(url="https://p.supabase.co", key="k"),
    )

    def refuse(config, paths):
        raise storage.StorageError("storage refused the deletion: HTTP 500")

    monkeypatch.setattr("media.storage.remove", refuse)

    assert client.delete(f"/guides/{guide['id']}").status_code == 502
    assert client.get(f"/guides/{guide['id']}").status_code == 200


def test_deleting_a_guide_that_does_not_exist_is_not_found(client):
    assert client.delete("/guides/00000000-0000-0000-0000-000000000000").status_code == 404


@pytest.fixture
def config():
    return storage.StorageConfig(url="https://project.supabase.co/", key="secret", bucket="guides")


def test_remove_asks_storage_to_delete_every_path(config):
    calls = []
    storage.remove(config, ["a/1.mp4", "a/1.jpg"], send=lambda *args: calls.append(args) or 200)

    url, body, headers = calls[0]
    assert url == "https://project.supabase.co/storage/v1/object/guides"
    assert body == {"prefixes": ["a/1.mp4", "a/1.jpg"]}
    assert headers["Authorization"] == "Bearer secret"


def test_remove_with_nothing_to_remove_does_not_call_storage(config):
    storage.remove(config, [], send=lambda *args: pytest.fail("called"))


def test_a_refused_deletion_is_reported(config):
    with pytest.raises(storage.StorageError, match="HTTP 403"):
        storage.remove(config, ["a"], send=lambda *args: 403)


def test_a_route_inserted_before_a_processed_one_does_not_overwrite_its_media(
    client, monkeypatch, tmp_path
):
    """Positions move when a route is inserted; the stored media must stay with its own step."""
    first = create_guide(client).json()
    guide_id = first["id"]
    sala = first["steps"][0]
    monkeypatch.setattr("routers.guides.UPLOAD_DIR", tmp_path)
    monkeypatch.setenv("SUPABASE_URL", "https://p.supabase.co")
    monkeypatch.setattr(
        "media.storage.config_from_env",
        lambda: storage.StorageConfig(url="https://p.supabase.co", key="k"),
    )
    written = []
    monkeypatch.setattr(
        "media.storage.upload",
        lambda config, path, data, content_type, **kw: written.append(path) or path,
    )

    def process(video, steps):
        return [pipeline.ProcessedStep(position=s.position, clip=video.name.encode(), photo=b"p",
                                       sound=None, noise_level=None) for s in steps]

    monkeypatch.setattr("media.pipeline.process", process)

    def upload(route_id):
        return client.post(f"/guides/{guide_id}/routes/{route_id}/video",
                           files={"video": ("r.mp4", io.BytesIO(b"x"), "video/mp4")})

    assert upload(first["routes"][0]["id"]).status_code == 200
    first_uploads = list(written)

    mark = {"title": "Recepción", "category": "reception", "marked_at_seconds": 0.0}
    inserted = client.post(f"/guides/{guide_id}/routes", json={
        "title": "Recepción", "video_duration_seconds": 10, "position": 1, "marks": [mark]}).json()
    new_route = next(r for r in inserted["routes"] if r["title"] == "Recepción")
    assert upload(new_route["id"]).status_code == 200

    assert not set(first_uploads) & set(written[len(first_uploads):])  # nothing written twice
    body = client.get(f"/guides/{guide_id}").json()
    by_title = {s["title"]: s for s in body["steps"]}
    assert by_title["Recepción"]["order"] < by_title[sala["title"]]["order"]
    assert by_title["Recepción"]["clip_url"] != by_title[sala["title"]]["clip_url"]


def _guide_with_three_routes(client):
    guide = create_guide(client).json()
    for title in ("Rayos X", "Salida"):
        guide = add_route(client, guide["id"], title=title).json()
    return guide


def _no_storage(monkeypatch, removed=None):
    monkeypatch.setattr(
        "media.storage.config_from_env",
        lambda: storage.StorageConfig(url="https://p.supabase.co", key="k"),
    )
    monkeypatch.setattr(
        "media.storage.remove", lambda config, paths: removed is None or removed.extend(paths)
    )


def test_deleting_a_route_takes_its_steps_and_renumbers_what_is_left(client, monkeypatch):
    """Without holes: the numbering is one for the whole guide."""
    _no_storage(monkeypatch)
    guide = _guide_with_three_routes(client)
    first = guide["routes"][0]

    assert client.delete(f"/guides/{guide['id']}/routes/{first['id']}").status_code == 204

    after = client.get(f"/guides/{guide['id']}").json()
    assert [route["order"] for route in after["routes"]] == [1, 2]
    assert [route["title"] for route in after["routes"]] == ["Rayos X", "Salida"]
    assert [step["order"] for step in after["steps"]] == [1, 2, 3, 4]
    assert after["video_duration_seconds"] == pytest.approx(
        sum(route["video_duration_seconds"] for route in after["routes"])
    )


def test_deleting_a_route_removes_only_its_files(client, db_session, monkeypatch):
    from db import guides

    removed = []
    _no_storage(monkeypatch, removed)
    guide = _guide_with_three_routes(client)
    stored = guides.get(db_session, uuid.UUID(guide["id"]))
    for number, step in enumerate(stored.steps):
        step.clip_path = f"{guide['id']}/{number}.mp4"
    db_session.commit()
    first = guide["routes"][0]

    client.delete(f"/guides/{guide['id']}/routes/{first['id']}")

    first_steps = [s for s in guide["steps"] if s["route_id"] == first["id"]]
    assert len(removed) == len(first_steps) > 0


def test_a_storage_failure_keeps_the_route(client, db_session, monkeypatch):
    from db import guides

    guide = _guide_with_three_routes(client)
    stored = guides.get(db_session, uuid.UUID(guide["id"]))
    stored.steps[0].clip_path = f"{guide['id']}/a.mp4"
    db_session.commit()
    monkeypatch.setattr(
        "media.storage.config_from_env",
        lambda: storage.StorageConfig(url="https://p.supabase.co", key="k"),
    )

    def refuse(config, paths):
        raise storage.StorageError("storage refused the deletion: HTTP 500")

    monkeypatch.setattr("media.storage.remove", refuse)

    response = client.delete(f"/guides/{guide['id']}/routes/{guide['routes'][0]['id']}")

    assert response.status_code == 502
    assert len(client.get(f"/guides/{guide['id']}").json()["routes"]) == 3


def test_the_last_route_of_a_published_guide_cannot_be_deleted(client, monkeypatch):
    """It would leave a public link, maybe already in a QR, pointing at nothing."""
    from test_guides_api import complete_every_step

    _no_storage(monkeypatch)
    guide = create_guide(client).json()
    complete_every_step(client, guide)
    client.post(f"/guides/{guide['id']}/publish")

    response = client.delete(f"/guides/{guide['id']}/routes/{guide['routes'][0]['id']}")

    assert response.status_code == 409
    assert "publicada" in response.json()["detail"]


def test_one_of_several_routes_can_be_deleted_from_a_published_guide(client, monkeypatch):
    """Whoever deletes is the venue itself: that is the human review."""
    from test_guides_api import complete_every_step

    _no_storage(monkeypatch)
    guide = add_route(client, create_guide(client).json()["id"]).json()
    complete_every_step(client, guide)
    published = client.post(f"/guides/{guide['id']}/publish").json()

    response = client.delete(f"/guides/{guide['id']}/routes/{guide['routes'][1]['id']}")

    assert response.status_code == 204
    assert client.get(f"/public/{published['public_slug']}").status_code == 200


def test_a_route_of_another_guide_is_not_found(client, monkeypatch):
    _no_storage(monkeypatch)
    one = create_guide(client).json()
    other = create_guide(client).json()

    response = client.delete(f"/guides/{other['id']}/routes/{one['routes'][0]['id']}")

    assert response.status_code == 404


def test_the_person_recording_can_say_how_it_sounded(client):
    mark = {"title": "Urgencias", "category": "waiting", "marked_at_seconds": 0.0, "noise_level": "noisy"}

    guide = create_guide(client, marks=[mark]).json()

    step = guide["steps"][0]
    assert step["noise_level"] == "noisy"
    assert step["noise_level_source"] == "manual"


def test_a_part_without_an_answer_has_no_level(client):
    mark = {"title": "Urgencias", "category": "waiting", "marked_at_seconds": 0.0}

    step = create_guide(client, marks=[mark]).json()["steps"][0]

    assert step["noise_level"] is None
    assert step["noise_level_source"] is None


def test_a_measured_level_never_overwrites_what_a_person_said(client, monkeypatch, tmp_path):
    """Whoever stood there knows more than a measurement taken by a microphone."""
    mark = {"title": "Urgencias", "category": "waiting", "marked_at_seconds": 0.0, "noise_level": "quiet"}
    guide = create_guide(client, marks=[mark]).json()
    monkeypatch.setattr("routers.guides.UPLOAD_DIR", tmp_path)
    monkeypatch.setattr(
        "media.pipeline.process",
        lambda video, steps: [
            pipeline.ProcessedStep(position=1, clip=b"c", photo=b"p", sound=None, noise_level="noisy")
        ],
    )
    monkeypatch.setattr(
        "media.storage.config_from_env",
        lambda: storage.StorageConfig(url="https://p.supabase.co", key="k"),
    )
    monkeypatch.setattr("media.storage.upload", lambda config, path, *a, **kw: path)

    response = client.post(
        f"/guides/{guide['id']}/video",
        files={"video": ("r.mp4", io.BytesIO(b"x"), "video/mp4")},
    )

    step = response.json()["steps"][0]
    assert response.status_code == 200, response.text
    assert step["noise_level"] == "quiet"
    assert step["noise_level_source"] == "manual"


def test_repeating_the_only_take_leaves_no_empty_route_behind(client, monkeypatch):
    """Delete the only recording of a draft, then add the new one: the guide has exactly one."""
    _no_storage(monkeypatch)
    guide = create_guide(client).json()

    assert client.delete(f"/guides/{guide['id']}/routes/{guide['routes'][0]['id']}").status_code == 204
    after = add_route(client, guide["id"], position=1).json()

    assert [route["title"] for route in after["routes"]] == [ROUTE["title"]]
    assert [step["order"] for step in after["steps"]] == [1, 2]
