from __future__ import annotations

import uuid
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.main import create_app


@pytest.fixture()
def client(tmp_path: Path):
    app = create_app(tmp_path / "weekly.db")
    with TestClient(app) as test_client:
        yield test_client


def rid() -> str:
    return str(uuid.uuid4())


def test_weekly_plan_saves_seven_days_without_touching_the_cart(client: TestClient, monkeypatch):
    def boom(*_args, **_kwargs):
        raise RuntimeError("force sample week")

    monkeypatch.setattr("app.services.gemini_suggestions.generate_weekly_plan", boom)
    before = client.get("/api/workspace", params={"workspaceId": "demo-family"}).json()
    open_items = [item["id"] for item in before["items"] if not item.get("removed")]

    suggestion = client.post(
        "/api/suggestions",
        json={
            "workspaceId": "demo-family",
            "actorId": "leila",
            "requestId": rid(),
            "message": "Plan dinners for this week using our saved preferences.",
            "planDate": "2026-10-18",
        },
    ).json()
    assert suggestion["kind"] == "weekly_plan"
    assert suggestion["sourceMode"] == "sample"
    assert len(suggestion["days"]) == 7
    assert suggestion["days"][0]["planDate"] == "2026-10-12"
    assert suggestion["days"][6]["planDate"] == "2026-10-18"

    rejected = client.post(
        "/api/drafts/confirm",
        json={
            "workspaceId": "demo-family",
            "actorId": "leila",
            "requestId": rid(),
            "draftId": suggestion["draftId"],
            "expectedListRevision": suggestion["listRevision"],
            "target": "cart",
        },
    )
    assert rejected.status_code == 422

    confirm = client.post(
        "/api/drafts/confirm",
        json={
            "workspaceId": "demo-family",
            "actorId": "leila",
            "requestId": rid(),
            "draftId": suggestion["draftId"],
            "expectedListRevision": suggestion["listRevision"],
            "target": "plans",
        },
    ).json()
    workspace = confirm["workspace"]
    titles = {plan["event"] for plan in workspace["plans"] if plan["date"] >= "2026-10-12"}
    assert "Chickpea coconut stew" in titles
    assert "Sheet-pan tofu and broccoli" in titles
    after_open = [item["id"] for item in workspace["items"] if not item.get("removed")]
    assert after_open == open_items
    assert "No groceries" in confirm["changeSummary"]
