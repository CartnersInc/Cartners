"""PROPOSAL (#4): "Not here" punt. The seeded family run belongs to Sam and carries Tortillas."""

from __future__ import annotations

import uuid
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.main import create_app


@pytest.fixture()
def client(tmp_path: Path):
    app = create_app(tmp_path / "test.db")
    with TestClient(app) as test_client:
        yield test_client


def tortillas(client: TestClient) -> dict:
    workspace = client.get("/api/workspace", params={"workspaceId": "demo-family"}).json()
    return next(item for item in workspace["items"] if item["id"] == "item-tortillas")


def punt(client: TestClient, actor: str, version: int, punted: bool = True):
    return client.patch(
        "/api/items/item-tortillas",
        json={"workspaceId": "demo-family", "actorId": actor, "requestId": str(uuid.uuid4()), "expectedItemVersion": version, "punted": punted},
    )


def test_shopper_punts_and_puts_back(client: TestClient):
    item = tortillas(client)
    assert item["runId"] and item["punted"] is None
    run_id = item["runId"]

    moved = punt(client, "sam", item["version"])
    assert moved.status_code == 200
    after = next(i for i in moved.json()["workspace"]["items"] if i["id"] == "item-tortillas")
    assert after["runId"] is None
    assert after["punted"]["by"] == "sam" and after["punted"]["runId"] == run_id
    assert after["punted"]["storeName"] == "Sample neighborhood store"

    back = punt(client, "sam", after["version"], punted=False)
    assert back.status_code == 200
    restored = next(i for i in back.json()["workspace"]["items"] if i["id"] == "item-tortillas")
    assert restored["runId"] == run_id and restored["punted"] is None


def test_only_the_shopper_can_punt(client: TestClient):
    response = punt(client, "leila", tortillas(client)["version"])
    assert response.status_code == 403
    assert response.json()["error"]["code"] == "NOT_SHOPPER"


def test_stale_version_conflicts(client: TestClient):
    response = punt(client, "sam", tortillas(client)["version"] + 5)
    assert response.status_code == 409
    assert "workspace" in response.json()


def test_next_run_claims_punted_request_and_buying_clears_it(client: TestClient):
    item = tortillas(client)
    punted = next(i for i in punt(client, "sam", item["version"]).json()["workspace"]["items"] if i["id"] == "item-tortillas")

    workspace = client.get("/api/workspace", params={"workspaceId": "demo-family"}).json()
    finish = client.patch("/api/trip", json={"workspaceId": "demo-family", "actorId": "sam", "requestId": str(uuid.uuid4()), "expectedTripVersion": workspace["trip"]["version"], "action": "finish"})
    assert finish.status_code == 200
    trip = finish.json()["workspace"]["trip"]

    put_back = punt(client, "sam", punted["version"], punted=False)
    assert put_back.status_code == 422  # the run it was punted from is over

    start = client.patch("/api/trip", json={"workspaceId": "demo-family", "actorId": "leila", "requestId": str(uuid.uuid4()), "expectedTripVersion": trip["version"], "action": "start", "storeName": "QFC", "requestWindowMinutes": 10})
    assert start.status_code == 200
    claimed = next(i for i in start.json()["workspace"]["items"] if i["id"] == "item-tortillas")
    assert claimed["runId"] == start.json()["workspace"]["trip"]["id"]
    assert claimed["punted"]["storeName"] == "Sample neighborhood store"  # "Not found there last time"

    bought = client.patch("/api/items/item-tortillas", json={"workspaceId": "demo-family", "actorId": "leila", "requestId": str(uuid.uuid4()), "expectedItemVersion": claimed["version"], "bought": True})
    assert bought.status_code == 200
    assert next(i for i in bought.json()["workspace"]["items"] if i["id"] == "item-tortillas")["punted"] is None
