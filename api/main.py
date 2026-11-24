from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from sqlalchemy.exc import SQLAlchemyError

from db.session import ping
from routers.guides import router as guides_router

load_dotenv()

app = FastAPI(
    title="Antesala API",
    version="0.0.1",
    summary="Anticipation guides: a recorded route a person can watch before visiting a place.",
    description=(
        "Shared contract for the recorder (mobile), the review panel and the public player.\n\n"
        "The route is **not** detected by the AI: the person picks the parts before recording and "
        "taps \"Llegue a: X\" on arrival. Those marks become the steps.\n\n"
        "Two rules the API enforces, not the UI:\n"
        "- a guide is only published by a human, and only once every step is reviewed and complete\n"
        "- the public endpoint never serves a draft"
    ),
    root_path="/api",
    # nginx serves the API under /api. Declared explicitly so the committed contract carries
    # it too; root_path_in_servers=False stops FastAPI prefixing it again and producing /api/api.
    servers=[{"url": "/api", "description": "Behind nginx, in every environment"}],
    root_path_in_servers=False,
)

app.include_router(guides_router)


@app.get("/health", tags=["health"], summary="Liveness check")
def health():
    """Answer as soon as the process is up. Does not touch the database."""
    return {"status": "ok"}


@app.get("/health/db", tags=["health"], summary="Database connectivity check")
def health_db():
    """Check the database answers. Returns 503 when it is unreachable or not configured."""
    try:
        ping()
    except (RuntimeError, SQLAlchemyError) as exc:
        raise HTTPException(status_code=503, detail="database unavailable") from exc
    return {"status": "ok", "database": "ok" }
