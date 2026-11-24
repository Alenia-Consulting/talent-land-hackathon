"""Uploading the recording.

The video goes through the API, gets its faces blurred and only then reaches storage. While the
blurring is not implemented the endpoint refuses the upload instead of storing recognisable faces.
"""

import io
import pathlib
import uuid

from media import pipeline, storage


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


def test_the_upload_is_refused_while_faces_cannot_be_blurred(client, db_session, make_guide):
    guide = make_guide()
    db_session.add(guide)
    db_session.commit()

    response = upload(client, guide.id)

    # 503, not 500: nothing is broken, the capability is simply not there yet.
    assert response.status_code == 503
    assert "difumin" in response.json()["detail"].lower()


def test_the_recording_is_never_left_behind_on_disk(client, db_session, make_guide, tmp_path, monkeypatch):
    monkeypatch.setattr("routers.guides.UPLOAD_DIR", tmp_path)
    guide = make_guide()
    db_session.add(guide)
    db_session.commit()

    upload(client, guide.id)

    # Whatever happens, the original recording does not stay on the server.
    assert list(tmp_path.iterdir()) == []


def test_the_processing_step_states_what_it_needs_to_do():
    """The blur is a hole somebody is going to fill: it must fail loudly, never silently pass."""
    try:
        pipeline.process(pathlib.Path("/tmp/none.mp4"), [])
    except pipeline.ProcessingUnavailable as error:
        assert "blur" in str(error).lower() or "difumin" in str(error).lower()
    else:
        raise AssertionError("process() must refuse until the blurring exists")


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
        lambda config, path, data, content_type, **kwargs: uploaded.append(path)
        or f"https://p.supabase.co/storage/v1/object/public/guides/{path}",
    )

    response = upload(client, guide.id)

    assert response.status_code == 200, response.text
    assert uploaded == [
        "centro-oeste/paso-1.mp4",
        "centro-oeste/paso-1.jpg",
        "centro-oeste/paso-1.mp3",
    ]

    step = response.json()["steps"][0]
    assert step["clip_url"].endswith("centro-oeste/paso-1.mp4")
    assert step["photo_url"].endswith("centro-oeste/paso-1.jpg")
    assert step["sound_available"] is True
    assert step["noise_level"] == "noisy"
    # Measured by the pipeline, not corrected by a person: the panel shows the difference.
    assert step["noise_level_source"] == "measured"
    assert list(tmp_path.iterdir()) == []
