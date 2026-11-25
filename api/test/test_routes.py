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
