"""Supabase Storage client.

Only the processed media goes here: trimmed clips with blurred faces, still frames and the
low-pass filtered ambience. The original recording never reaches this bucket, because it shows
the faces of patients and staff who did not agree to be filmed.

Uses urllib rather than an HTTP library so the API keeps its dependency list short. The sender is
injectable, which is what lets the tests run without a Supabase project.
"""

import json
import os
import urllib.error
import urllib.request
from collections.abc import Callable
from dataclasses import dataclass

DEFAULT_BUCKET = "guides"
UPLOAD_TIMEOUT_SECONDS = 60


class StorageError(RuntimeError):
    """Storage was unreachable, refused the upload, or is not configured."""


@dataclass(frozen=True)
class StorageConfig:
    url: str
    key: str
    bucket: str = DEFAULT_BUCKET


def config_from_env() -> StorageConfig:
    """Read the credentials from the environment. They live in api/.env, never in git."""
    url = os.environ.get("SUPABASE_URL", "")
    # The secret key, not the publishable one: writing to a bucket is not a browser operation.
    key = os.environ.get("SUPABASE_SECRET_KEY", "")

    missing = [name for name, value in (("SUPABASE_URL", url), ("SUPABASE_SECRET_KEY", key)) if not value]
    if missing:
        raise StorageError(f"storage is not configured: {', '.join(missing)} is missing from api/.env")

    return StorageConfig(url=url, key=key, bucket=os.environ.get("SUPABASE_BUCKET", DEFAULT_BUCKET))


def _send(url: str, data: bytes, headers: dict[str, str]) -> int:
    request = urllib.request.Request(url, data=data, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(request, timeout=UPLOAD_TIMEOUT_SECONDS) as response:
            return response.status
    except urllib.error.HTTPError as error:
        return error.code
    except urllib.error.URLError as error:
        raise StorageError(f"storage unreachable: {error.reason}") from error


def upload(
    config: StorageConfig,
    path: str,
    data: bytes,
    content_type: str,
    *,
    send: Callable[[str, bytes, dict[str, str]], int] = _send,
) -> str:
    """Store one file and answer its path in the bucket.

    Upserts, so sending a recording again after a failure replaces the files of the first try.
    """
    base = config.url.rstrip("/")
    status = send(
        f"{base}/storage/v1/object/{config.bucket}/{path}",
        data,
        {"Authorization": f"Bearer {config.key}", "Content-Type": content_type, "x-upsert": "true"},
    )
    if status >= 400:
        raise StorageError(f"storage refused the upload: HTTP {status}")

    return path


def _delete(url: str, body: dict, headers: dict[str, str]) -> int:
    request = urllib.request.Request(url, data=json.dumps(body).encode(), headers=headers, method="DELETE")
    try:
        with urllib.request.urlopen(request, timeout=UPLOAD_TIMEOUT_SECONDS) as response:
            return response.status
    except urllib.error.HTTPError as error:
        return error.code
    except (urllib.error.URLError, TimeoutError) as error:
        raise StorageError(f"storage could not be reached: {error}") from error


def remove(
    config: StorageConfig,
    paths: list[str],
    *,
    send: Callable[[str, dict, dict[str, str]], int] = _delete,
) -> None:
    """Delete these files from the bucket. A path that is already gone is not an error."""
    if not paths:
        return
    status = send(
        f"{config.url.rstrip('/')}/storage/v1/object/{config.bucket}",
        {"prefixes": paths},
        {"Authorization": f"Bearer {config.key}", "Content-Type": "application/json"},
    )
    if status >= 400:
        raise StorageError(f"storage refused the deletion: HTTP {status}")


def public_url(path: str | None) -> str | None:
    """The URL a visitor opens for a stored path, or None when there is no file (or no storage)."""
    url = os.environ.get("SUPABASE_URL", "")
    if not path or not url:
        return None
    bucket = os.environ.get("SUPABASE_BUCKET", DEFAULT_BUCKET)
    return f"{url.rstrip('/')}/storage/v1/object/public/{bucket}/{path}"
