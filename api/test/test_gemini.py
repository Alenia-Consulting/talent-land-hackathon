"""Gemini writes the draft text of each step from its blurred clip. It never invents."""

import json

import pytest
from ai import gemini
from media import pipeline, storage

from test_video_upload import upload

CLIP = b"clip bytes"


def answer(**fields):
    text = {
        "easy_read_text": "Llegas al mostrador azul. Dices tu nombre.",
        "what_to_expect": ["Puede haber una fila"],
        "who_to_ask_for_help": "Persona del mostrador azul",
        "duration_text": "Unos 5 minutos",
        "interests": ["where_to_wait"],
    }
    text.update(fields)
    return {"candidates": [{"content": {"parts": [{"text": json.dumps(text)}]}}]}


@pytest.fixture(autouse=True)
def key(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "test-key")
    monkeypatch.delenv("GEMINI_MODEL", raising=False)


def request(position=1):
    return gemini.StepRequest(position=position, title="Recepción", category="reception", clip=CLIP)


def test_the_clip_and_the_rules_go_to_gemini():
    sent = {}

    def send(url, body, headers):
        sent.update(url=url, body=body, headers=headers)
        return answer()

    text = gemini.describe_step(request(), send=send)

    assert text.easy_read_text == "Llegas al mostrador azul. Dices tu nombre."
    assert sent["headers"]["x-goog-api-key"] == "test-key"
    assert sent["url"].endswith(f"/{gemini.DEFAULT_MODEL}:generateContent")
    parts = sent["body"]["contents"][0]["parts"]
    assert parts[0]["inline_data"]["mime_type"] == "video/mp4"
    prompt = parts[1]["text"]
    assert "Recepción" in prompt and "NO inventes" in prompt and "No describas a las personas" in prompt
    assert sent["body"]["generationConfig"]["responseMimeType"] == "application/json"


def test_the_model_can_be_chosen_from_the_environment(monkeypatch):
    monkeypatch.setenv("GEMINI_MODEL", "gemini-3.5-flash")
    urls = []
    gemini.describe_step(request(), send=lambda url, *_: urls.append(url) or answer())

    assert urls[0].endswith("/gemini-3.5-flash:generateContent")


def test_what_the_clip_does_not_show_stays_empty_and_is_listed_as_missing():
    text = gemini.describe_step(
        request(),
        send=lambda *_: answer(who_to_ask_for_help=None, duration_text="  ", what_to_expect=[]),
    )

    assert text.who_to_ask_for_help is None
    assert text.duration_text is None
    assert text.missing_fields == ["who_to_ask_for_help", "duration_text"]


def test_the_answer_is_cut_to_what_the_contract_accepts():
    text = gemini.parse(json.dumps({
        "easy_read_text": "Frase. " * 100,
        "what_to_expect": ["a", "", "b", "c", "d", "e"],
        "who_to_ask_for_help": None,
        "duration_text": "x" * 200,
        "interests": ["where_to_wait", "made_up", "where_to_wait"],
    }))

    assert len(text.easy_read_text) <= gemini.MAX_EASY_READ_CHARS
    assert text.what_to_expect == ["a", "b", "c", "d"]
    assert len(text.duration_text) <= gemini.MAX_DURATION_CHARS
    assert text.interests == ["where_to_wait"]


@pytest.mark.parametrize("raw", ["not json", "[1, 2]"])
def test_an_answer_that_is_not_the_expected_json_is_refused(raw):
    with pytest.raises(gemini.GeminiError):
        gemini.parse(raw)


def test_a_blocked_answer_is_an_error_not_a_crash():
    with pytest.raises(gemini.GeminiError):
        gemini.describe_step(request(), send=lambda *_: {"candidates": []})


def test_without_a_key_nothing_is_called(monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY")

    with pytest.raises(gemini.GeminiError, match="GEMINI_API_KEY"):
        gemini.describe_step(request(), send=lambda *_: pytest.fail("must not be called"))
    assert gemini.describe_steps([request()], send=lambda *_: pytest.fail("no")) == {1: None}


def test_a_clip_too_big_for_gemini_is_not_sent(monkeypatch):
    monkeypatch.setattr(gemini, "MAX_CLIP_BYTES", 3)

    with pytest.raises(gemini.GeminiError, match="too big"):
        gemini.describe_step(request(), send=lambda *_: pytest.fail("no"))


def test_one_step_failing_does_not_affect_the_others():
    def send(url, body, headers):
        if "«Sala»" in body["contents"][0]["parts"][1]["text"]:
            raise gemini.GeminiError("boom")
        return answer()

    steps = [request(1), gemini.StepRequest(2, "Sala", "waiting", CLIP)]

    result = gemini.describe_steps(steps, send=send)

    assert result[1].easy_read_text and result[2] is None


def test_http_errors_become_gemini_errors(monkeypatch):
    import urllib.error

    def refuse(*_args, **_kwargs):
        raise urllib.error.HTTPError("u", 429, "quota", {}, None)

    monkeypatch.setattr("urllib.request.urlopen", refuse)

    with pytest.raises(gemini.GeminiError, match="HTTP 429"):
        gemini.describe_step(request())


def stored_guide(db_session, make_guide, make_step, monkeypatch, tmp_path):
    guide = make_guide()
    guide.steps = [make_step(position=1, title="Recepción", category="reception", easy_read_text=None)]
    db_session.add(guide)
    db_session.commit()
    monkeypatch.setattr("routers.guides.UPLOAD_DIR", tmp_path)
    monkeypatch.setenv("SUPABASE_URL", "https://p.supabase.co")
    monkeypatch.setattr("media.pipeline.process", lambda video, steps: [
        pipeline.ProcessedStep(position=1, clip=CLIP, photo=b"p", sound=None, noise_level=None)])
    monkeypatch.setattr("media.storage.config_from_env",
                        lambda: storage.StorageConfig(url="https://p.supabase.co", key="k"))
    monkeypatch.setattr("media.storage.upload", lambda config, path, *a, **kw: path)
    return guide


def test_the_draft_text_lands_on_the_step_with_its_blanks_listed(
    client, db_session, make_guide, make_step, monkeypatch, tmp_path
):
    guide = stored_guide(db_session, make_guide, make_step, monkeypatch, tmp_path)
    monkeypatch.setattr(
        "ai.gemini._send", lambda *_: answer(who_to_ask_for_help=None))

    response = upload(client, guide.id)

    step = response.json()["steps"][0]
    assert response.status_code == 200
    assert step["easy_read_text"] == "Llegas al mostrador azul. Dices tu nombre."
    assert step["what_to_expect"] == ["Puede haber una fila"]
    assert step["who_to_ask_for_help"] is None
    assert step["interests"] == ["where_to_wait"]
    assert step["missing_fields"] == ["who_to_ask_for_help"]
    # Drafted by the AI, not reviewed: a person still has to approve it.
    assert step["reviewed"] is False
    # The original draft is kept apart from the editable fields, with who wrote it and when.
    db_session.refresh(guide)
    draft = guide.steps[0].ai_draft
    assert draft["model"] == gemini.DEFAULT_MODEL
    assert draft["generated_at"]
    assert draft["easy_read_text"] == "Llegas al mostrador azul. Dices tu nombre."
    assert draft["who_to_ask_for_help"] is None
    assert response.json()["pending"]["missing_data"] == 1


def test_a_gemini_failure_keeps_the_media_and_leaves_the_text_empty(
    client, db_session, make_guide, make_step, monkeypatch, tmp_path
):
    guide = stored_guide(db_session, make_guide, make_step, monkeypatch, tmp_path)

    def down(*_):
        raise gemini.GeminiError("quota")

    monkeypatch.setattr("ai.gemini._send", down)

    response = upload(client, guide.id)

    step = response.json()["steps"][0]
    assert response.status_code == 200
    assert response.json()["processing_status"] == "done"
    assert step["clip_url"].endswith(f"{guide.id}/paso-1.mp4")  # the media is stored regardless
    assert step["easy_read_text"] is None
    assert response.json()["pending"]["missing_data"] == 1


def test_editing_a_step_leaves_the_original_ai_draft_untouched(
    client, db_session, make_guide, make_step, monkeypatch, tmp_path
):
    guide = stored_guide(db_session, make_guide, make_step, monkeypatch, tmp_path)
    monkeypatch.setattr("ai.gemini._send", lambda *_: answer())
    step_id = upload(client, guide.id).json()["steps"][0]["id"]

    edited = client.patch(f"/guides/{guide.id}/steps/{step_id}", json={"easy_read_text": "Texto corregido."})

    assert edited.json()["steps"][0]["easy_read_text"] == "Texto corregido."
    db_session.refresh(guide)
    assert guide.steps[0].ai_draft["easy_read_text"] == "Llegas al mostrador azul. Dices tu nombre."


def test_a_step_gemini_could_not_describe_has_no_draft(
    client, db_session, make_guide, make_step, monkeypatch, tmp_path
):
    guide = stored_guide(db_session, make_guide, make_step, monkeypatch, tmp_path)
    monkeypatch.delenv("GEMINI_API_KEY")

    upload(client, guide.id)

    db_session.refresh(guide)
    assert guide.steps[0].ai_draft is None
