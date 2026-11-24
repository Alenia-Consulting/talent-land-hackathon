from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from sqlalchemy.exc import SQLAlchemyError

from db.session import ping

load_dotenv()

app = FastAPI(title="talent-land-hackathon", root_path="/api")


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/health/db")
def health_db():
    try:
        ping()
    except (RuntimeError, SQLAlchemyError) as exc:
        raise HTTPException(status_code=503, detail="database unavailable") from exc
    return {"status": "ok", "database": "ok"}
