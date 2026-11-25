"""Uploading the recording.

The video goes through the API, gets its faces blurred and only then reaches storage. If the
blurring cannot run the endpoint refuses the upload instead of storing recognisable faces.
"""

import io
import pathlib
import uuid

from db import guides
from media import faces, pipeline, storage, video_io
from media_fixtures import make_video


def upload(client, guide_id, *, content=b"fake video bytes", content_type="video/mp4"):
    return client.post(
        f"/guides/{guide_id}/video",
        files={"video": ("recorrido.mp4", io.BytesIO(content), content_type)},
    )


def test_a_guide_that_does_not_exist_is_not_found(client):
    response = upload(client, uuid.uuid4())

    assert response.status_code == 404
    assert response.json()["detail"] == "guide not found"


def test_something_that_is_not_a_video_is_refused(client, db_session, make_guide):
    guide = make_guide()
    db_session.add(guide)
    db_session.commit()

    response = upload(client, guide.id, content_type="application/pdf")

    assert response.status_code == 415
    assert "vídeo" in response.json()["detail"] or "video" in response.json()["detail"]


def test_a_video_over_the_limit_is_refused_without_reading_it_all(
    client, db_session, make_guide, monkeypatch
):
    monkeypatch.setattr("routers.guides.MAX_VIDEO_BYTES", 10)
    guide = make_guide()
    db_session.add(guide)
    db_session.commit()

    response = upload(client, guide.id, content=b"x" * 50)

    assert response.status_code == 413


def test_the_upload_is_refused_when_faces_cannot_be_blurred(client, db_session, make_guide, monkeypatch):
    guide = make_guide()
    db_session.add(guide)
    db_session.commit()

    def unavailable(video, steps):
        raise pipeline.ProcessingUnavailable("ffmpeg no está disponible en este servidor")

    monkeypatch.setattr("media.pipeline.process", unavailable)

    response = upload(client, guide.id)

    # 503, not 500: nothing is broken in the request, the capability is missing on this server.
    assert response.status_code == 503
    assert "ffmpeg" in response.json()["detail"]


def test_something_that_looks_like_a_video_but_is_not_one_is_unprocessable(client, db_session, make_guide):
    guide = make_guide()
    db_session.add(guide)
    db_session.commit()

    response = upload(client, guide.id, content=b"not really a video" * 50)

    assert response.status_code == 422
    assert "vídeo" in response.json()["detail"]


def test_the_recording_is_never_left_behind_on_disk(client, db_session, make_guide, tmp_path, monkeypatch):
    monkeypatch.setattr("routers.guides.UPLOAD_DIR", tmp_path)
    guide = make_guide()
    db_session.add(guide)
    db_session.commit()

    upload(client, guide.id)

    # Whatever happens, the original recording does not stay on the server.
    assert list(tmp_path.iterdir()) == []


def test_a_real_recording_is_blurred_before_anything_reaches_storage(
    client, db_session, make_guide, make_step, monkeypatch, tmp_path
):
    """No fakes in the pipeline: the clip and the photo that reach storage have no face in them."""
    import cv2
    import numpy as np

    guide = make_guide(public_slug="centro-oeste")
    guide.steps = [make_step(position=1, start_seconds=0.0, end_seconds=2.0, photo_second=1.0)]
    db_session.add(guide)
    db_session.commit()

    monkeypatch.setattr("routers.guides.UPLOAD_DIR", tmp_path / "uploads")
    monkeypatch.setattr(
        "media.storage.config_from_env",
        lambda: storage.StorageConfig(url="https://p.supabase.co", key="k", bucket="guides"),
    )
    stored = {}
    monkeypatch.setattr(
        "media.storage.upload",
        lambda config, path, data, content_type, **kwargs: stored.__setitem__(path, data) or path,
    )
    recording = make_video(tmp_path / "recording.mp4", seconds=2).read_bytes()

    response = upload(client, guide.id, content=recording)

    assert response.status_code == 200, response.text
    base = f"{guide.id}/{guide.steps[0].id}"
    assert set(stored) == {f"{base}.mp4", f"{base}.jpg"}
    photo = cv2.imdecode(np.frombuffer(stored[f"{base}.jpg"], np.uint8), cv2.IMREAD_COLOR)
    assert faces.find_faces(photo) == []
    assert list((tmp_path / "uploads").iterdir()) == []


def test_the_processed_media_reaches_storage_and_the_steps(
    client, db_session, make_guide, make_step, monkeypatch, tmp_path
):
    """The whole pipeline, with the hole filled in.

    This is the contract pipeline.process() has to honour: give back one ProcessedStep per step
    and the endpoint stores the media and writes the URLs. It also pins down that a measured
    noise level is recorded as measured, not as a human correction.
    """
    guide = make_guide(public_slug="centro-oeste")
    guide.steps = [make_step(position=1)]
    db_session.add(guide)
    db_session.commit()

    monkeypatch.setattr("routers.guides.UPLOAD_DIR", tmp_path)
    monkeypatch.setenv("SUPABASE_URL", "https://p.supabase.co")
    monkeypatch.delenv("SUPABASE_BUCKET", raising=False)  # api/.env may name another bucket
    monkeypatch.setattr(
        "media.pipeline.process",
        lambda video, steps: [
            pipeline.ProcessedStep(
                position=1, clip=b"clip", photo=b"photo", sound=b"sound", noise_level="noisy"
            )
        ],
    )
    monkeypatch.setattr(
        "media.storage.config_from_env",
        lambda: storage.StorageConfig(url="https://p.supabase.co", key="k", bucket="guides"),
    )
    uploaded = []
    monkeypatch.setattr(
        "media.storage.upload",
        lambda config, path, data, content_type, **kwargs: uploaded.append(path) or path,
    )

    response = upload(client, guide.id)

    assert response.status_code == 200, response.text
    # The ids, not the slug or the position: neither is stable once the guide is published or a
    # route is inserted.
    stem = f"{guide.id}/{guide.steps[0].id}"
    assert uploaded == [f"{stem}.mp4", f"{stem}.jpg", f"{stem}.mp3"]

    step = response.json()["steps"][0]
    base = "https://p.supabase.co/storage/v1/object/public/guides"
    assert step["clip_url"] == f"{base}/{stem}.mp4"
    assert step["photo_url"] == f"{base}/{stem}.jpg"
    # The database keeps the path, not the URL.
    db_session.refresh(guide)
    assert guide.steps[0].clip_path == f"{stem}.mp4"
    assert step["sound_available"] is True
    assert step["sound_url"] == f"{base}/{stem}.mp3"
    assert guide.steps[0].sound_path == f"{stem}.mp3"
    assert step["noise_level"] == "noisy"
    # Measured by the pipeline, not corrected by a person: the panel shows the difference.
    assert step["noise_level_source"] == "measured"
    assert list(tmp_path.iterdir()) == []


def status_after(client, db_session, guide, **kwargs):
    response = upload(client, guide.id, **kwargs)
    db_session.refresh(guide)
    return response, guide.processing_status


def test_a_new_guide_waits_for_its_recording(client, db_session, make_guide):
    guide = make_guide()
    db_session.add(guide)
    db_session.commit()

    assert client.get(f"/guides/{guide.id}").json()["processing_status"] == "pending"


def test_a_processed_recording_marks_the_guide_done(
    client, db_session, make_guide, make_step, monkeypatch, tmp_path
):
    guide = make_guide()
    guide.steps = [make_step(position=1)]
    db_session.add(guide)
    db_session.commit()
    monkeypatch.setattr("routers.guides.UPLOAD_DIR", tmp_path)
    monkeypatch.setattr("media.pipeline.process", lambda video, steps: [
        pipeline.ProcessedStep(position=1, clip=b"c", photo=b"p", sound=None, noise_level=None)])
    monkeypatch.setattr("media.storage.config_from_env",
                        lambda: storage.StorageConfig(url="https://p.supabase.co", key="k"))
    monkeypatch.setattr("media.storage.upload", lambda config, path, *a, **kw: path)

    response, status = status_after(client, db_session, guide)

    assert response.status_code == 200
    assert status == "done"
    assert response.json()["processing_status"] == "done"


def test_a_recording_that_cannot_be_read_marks_the_guide_failed(client, db_session, make_guide):
    guide = make_guide()
    db_session.add(guide)
    db_session.commit()

    response, status = status_after(client, db_session, guide, content=b"not really a video" * 50)

    assert response.status_code == 422
    assert status == "failed"


def test_a_storage_failure_marks_the_guide_failed_and_keeps_no_paths(
    client, db_session, make_guide, make_step, monkeypatch, tmp_path
):
    guide = make_guide()
    guide.steps = [make_step(position=1)]
    db_session.add(guide)
    db_session.commit()
    monkeypatch.setattr("routers.guides.UPLOAD_DIR", tmp_path)
    monkeypatch.setattr("media.pipeline.process", lambda video, steps: [
        pipeline.ProcessedStep(position=1, clip=b"c", photo=b"p", sound=None, noise_level=None)])
    monkeypatch.setattr("media.storage.config_from_env",
                        lambda: storage.StorageConfig(url="https://p.supabase.co", key="k"))
    calls = []

    def flaky(config, path, *args, **kwargs):
        calls.append(path)
        if len(calls) == 2:
            raise storage.StorageError("storage refused the upload: HTTP 500")
        return path

    monkeypatch.setattr("media.storage.upload", flaky)

    response, status = status_after(client, db_session, guide)

    assert response.status_code == 502
    assert status == "failed"
    assert guide.steps[0].clip_path is None


def test_an_unavailable_pipeline_leaves_the_guide_waiting(client, db_session, make_guide, monkeypatch):
    guide = make_guide()
    db_session.add(guide)
    db_session.commit()

    def unavailable(video, steps):
        raise pipeline.ProcessingUnavailable("ffmpeg no está disponible")

    monkeypatch.setattr("media.pipeline.process", unavailable)

    response, status = status_after(client, db_session, guide)

    assert response.status_code == 503
    assert status == "pending"


def test_a_recording_already_being_processed_is_refused(client, db_session, make_guide):
    guide = make_guide(processing_status="processing")
    db_session.add(guide)
    db_session.commit()

    response = upload(client, guide.id)

    assert response.status_code == 409


def _two_part_guide(db_session):
    guide = guides.create(
        db_session, title="Recorrido principal", venue_name="Centro Trinidad",
        marks=[{"title": "Entrada", "category": "entrance", "marked_at_seconds": 0.0},
               {"title": "Recepción", "category": "reception", "marked_at_seconds": 12.0}],
        video_duration_seconds=30.0,
    )
    db_session.commit()
    return guide


def test_the_steps_reach_the_pipeline_on_the_timeline_of_the_file(
    client, db_session, monkeypatch, tmp_path
):
    """The phone said 30 s; the file lasts 20 s. Only retiming can produce what the pipeline gets."""
    guide = _two_part_guide(db_session)
    monkeypatch.setattr("routers.guides.UPLOAD_DIR", tmp_path)
    monkeypatch.setattr(video_io, "duration", lambda video: 20.0)
    received = []

    def refuse(video, timings):
        received.extend(timings)
        raise pipeline.ProcessingFailed("stop here")

    monkeypatch.setattr("media.pipeline.process", refuse)

    upload(client, guide.id)

    assert [(t.start_seconds, t.end_seconds, t.photo_second) for t in received] == [
        (0.0, 12.0, 6.0),
        (12.0, 20.0, 16.0),  # before: (12.0, 30.0, 13.5)
    ]


def test_a_recording_that_cannot_be_measured_marks_the_route_failed(
    client, db_session, monkeypatch, tmp_path
):
    guide = _two_part_guide(db_session)
    monkeypatch.setattr("routers.guides.UPLOAD_DIR", tmp_path)

    def unreadable(video):
        raise video_io.ProcessingFailed("no se pudo leer el vídeo")

    monkeypatch.setattr(video_io, "duration", unreadable)

    response = upload(client, guide.id)

    assert response.status_code == 422
    assert response.json()["detail"] == "no se pudo leer el vídeo"
    db_session.refresh(guide)
    assert guide.routes[0].processing_status == "failed"
    assert list(tmp_path.iterdir()) == []


def test_a_mark_past_the_real_end_of_the_file_is_still_processed(
    client, db_session, monkeypatch, tmp_path
):
    """The part marked at 12 s of a 5 s file keeps its last second instead of failing the upload."""
    guide = _two_part_guide(db_session)
    monkeypatch.setattr("routers.guides.UPLOAD_DIR", tmp_path)
    monkeypatch.setattr(video_io, "duration", lambda video: 5.0)
    monkeypatch.setattr("media.pipeline.process", lambda video, steps: [
        pipeline.ProcessedStep(position=n, clip=b"c", photo=b"p", sound=None, noise_level=None)
        for n in (1, 2)])
    monkeypatch.setattr("media.storage.config_from_env",
                        lambda: storage.StorageConfig(url="https://p.supabase.co", key="k"))
    monkeypatch.setattr("media.storage.upload", lambda config, path, *a, **kw: path)

    response = upload(client, guide.id)

    assert response.status_code == 200, response.text
    db_session.refresh(guide)
    assert [(s.start_seconds, s.end_seconds) for s in guide.routes[0].steps] == [
        (0.0, 5.0), (4.0, 5.0)]
