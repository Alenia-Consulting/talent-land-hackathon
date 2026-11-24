"""Write the API contract to contracts/openapi.json.

That file is what the frontend builds against, so it is committed: nobody needs to run the backend
to know the shape of the API. test/test_openapi_contract.py fails when it drifts from the code.

Run from api/:

    python scripts/export_openapi.py
"""

import json
import pathlib
import sys

API_ROOT = pathlib.Path(__file__).resolve().parent.parent
# So the script works whether it is run as a file or with -m.
sys.path.insert(0, str(API_ROOT))

from main import app  # noqa: E402

CONTRACT = API_ROOT.parent / "contracts" / "openapi.json"


def export() -> pathlib.Path:
    CONTRACT.parent.mkdir(parents=True, exist_ok=True)
    CONTRACT.write_text(json.dumps(app.openapi(), indent=2, ensure_ascii=False) + "\n")
    return CONTRACT


if __name__ == "__main__":
    print(f"wrote {export()}")
