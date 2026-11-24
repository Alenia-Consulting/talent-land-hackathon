from fastapi.testclient import TestClient
from sqlalchemy.exc import OperationalError

import main

client = TestClient(main.app)


def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_health_db_ok(monkeypatch):
    monkeypatch.setattr(main, "ping", lambda: None)
    response = client.get("/health/db")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "database": "ok"}


def test_health_db_unreachable(monkeypatch):
    def unreachable():
        raise OperationalError("SELECT 1", {}, Exception("connection refused"))

    monkeypatch.setattr(main, "ping", unreachable)
    response = client.get("/health/db")
    assert response.status_code == 503


def test_health_db_not_configured(monkeypatch):
    def not_configured():
        raise RuntimeError("DATABASE_URL is missing")

    monkeypatch.setattr(main, "ping", not_configured)
    assert client.get("/health/db").status_code == 503
