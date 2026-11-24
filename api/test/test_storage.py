"""The Supabase Storage client.

Nothing here talks to the network in the tests: the sender is injected, because the CI has no
Supabase project and a test that needs one is a test nobody runs.
"""

import pytest

from media import storage


@pytest.fixture
def config():
    return storage.StorageConfig(url="https://project.supabase.co", key="secret", bucket="guides")


def test_a_file_lands_on_the_bucket_path(config):
    sent = {}

    def send(url, data, headers):
        sent.update(url=url, data=data, headers=headers)
        return 200

    storage.upload(config, "guia/paso-1.mp4", b"bytes", "video/mp4", send=send)

    assert sent["url"] == "https://project.supabase.co/storage/v1/object/guides/guia/paso-1.mp4"
    assert sent["data"] == b"bytes"
    assert sent["headers"]["Content-Type"] == "video/mp4"


def test_the_secret_key_authorises_the_upload(config):
    sent = {}

    def send(url, data, headers):
        sent.update(headers=headers)
        return 200

    storage.upload(config, "a.mp4", b"x", "video/mp4", send=send)

    assert sent["headers"]["Authorization"] == "Bearer secret"


def test_the_public_url_is_what_a_visitor_opens(config):
    url = storage.upload(config, "guia/paso-1.jpg", b"x", "image/jpeg", send=lambda *_: 200)

    assert url == "https://project.supabase.co/storage/v1/object/public/guides/guia/paso-1.jpg"


def test_a_refused_upload_is_reported_not_swallowed(config):
    def send(url, data, headers):
        return 403

    with pytest.raises(storage.StorageError) as error:
        storage.upload(config, "a.mp4", b"x", "video/mp4", send=send)

    assert "403" in str(error.value)


def test_a_trailing_slash_in_the_url_does_not_double_up():
    config = storage.StorageConfig(url="https://project.supabase.co/", key="k", bucket="guides")
    sent = {}

    storage.upload(
        config, "a.mp4", b"x", "video/mp4",
        send=lambda url, data, headers: sent.update(url=url) or 200,
    )

    assert "//storage" not in sent["url"].removeprefix("https://")


def test_the_config_comes_from_the_environment(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "https://x.supabase.co")
    monkeypatch.setenv("SUPABASE_SECRET_KEY", "sk")

    config = storage.config_from_env()

    assert config.url == "https://x.supabase.co"
    assert config.key == "sk"


def test_a_missing_credential_says_which_one(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "https://x.supabase.co")
    monkeypatch.delenv("SUPABASE_SECRET_KEY", raising=False)

    with pytest.raises(storage.StorageError) as error:
        storage.config_from_env()

    assert "SUPABASE_SECRET_KEY" in str(error.value)
