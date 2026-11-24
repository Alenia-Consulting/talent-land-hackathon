"""The published contract must match the code.

contracts/openapi.json is what the frontend builds against. If this test fails, the API changed:
regenerate the file with `python scripts/export_openapi.py` from api/, and tell the team in the
pull request, because somebody is building against the old shape.
"""

import json
import pathlib

from main import app

CONTRACT = pathlib.Path(__file__).resolve().parents[2] / "contracts" / "openapi.json"
REGENERATE = "run `python scripts/export_openapi.py` from api/ and commit contracts/openapi.json"


def test_the_published_contract_is_committed():
    assert CONTRACT.exists(), f"{CONTRACT} is missing: {REGENERATE}"


def test_the_published_contract_matches_the_code():
    published = json.loads(CONTRACT.read_text())

    assert published == app.openapi(), f"the API changed: {REGENERATE}"


def test_every_endpoint_explains_itself():
    """An endpoint nobody can read is one the rest of the team cannot build against.

    Only `description` counts: FastAPI invents a `summary` from the function name, so checking
    that would pass for every endpoint and protect nothing. `description` comes from the docstring.
    """
    undocumented = [
        f"{method.upper()} {path}"
        for path, operations in app.openapi()["paths"].items()
        for method, operation in operations.items()
        if not operation.get("description")
    ]

    assert undocumented == []
