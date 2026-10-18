"""Only the person who added a request can remove it; only the active shopper can check items off."""

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


def workspace(client: TestClient) -> dict:
    return client.get("/api/workspace", params={"workspaceId": "demo-family"}).json()


def item(client: TestClient, item_id: str) -> dict:
    return next(i for i in workspace(client)["items"] if i["id"] == item_id)


def patch(client: TestClient, actor: str, item_id: str, **fields):
    return client.patch(
        f"/api/items/{item_id}",
        json={"workspaceId": "demo-family", "actorId": actor, "requestId": str(uuid.uuid4()), "expectedItemVersion": item(client, item_id)["version"], **fields},
    )


def trip(client: TestClient, actor: str, action: str, **fields):
    return client.patch(
        "/api/trip",
        json={"workspaceId": "demo-family", "actorId": actor, "requestId": str(uuid.uuid4()), "expectedTripVersion": workspace(client)["trip"]["version"], "action": action, **fields},
    )


def test_only_the_adder_can_remove_an_item(client: TestClient):
    # Seeded: Leila added Tortillas.
    blocked = patch(client, "sam", "item-tortillas", removed=True)
    assert blocked.status_code == 403
    assert blocked.json()["error"]["code"] == "NOT_YOUR_ITEM"
    assert item(client, "item-tortillas")["removed"] is False

    allowed = patch(client, "leila", "item-tortillas", removed=True)
    assert allowed.status_code == 200
    assert patch(client, "sam", "item-tortillas", removed=False).status_code == 403  # nor restore it
    assert patch(client, "leila", "item-tortillas", removed=False).status_code == 200


def test_only_the_adder_can_edit_details(client: TestClient):
    for fields in ({"quantity": 8}, {"unit": "pack"}, {"note": "corn"}, {"requestFor": "sam"}, {"name": "Wraps"}):
        response = patch(client, "sam", "item-tortillas", **fields)
        assert response.status_code == 403, fields
        assert response.json()["error"]["code"] == "NOT_YOUR_ITEM"
    assert patch(client, "leila", "item-tortillas", quantity=8, requestFor="leila").status_code == 200
    assert item(client, "item-tortillas")["quantity"] == 8


def test_the_shopper_can_still_punt_items_they_did_not_add(client: TestClient):
    # Seeded: Sam is shopping; Leila added Tortillas, which is on his run.
    assert patch(client, "sam", "item-tortillas", punted=True).status_code == 200


def test_only_the_active_shopper_can_check_items_off(client: TestClient):
    # Seeded: Sam is the shopper on the active run.
    blocked = patch(client, "leila", "item-tortillas", bought=True)
    assert blocked.status_code == 403
    assert blocked.json()["error"]["code"] == "NOT_SHOPPING"

    assert patch(client, "sam", "item-tortillas", bought=True).status_code == 200
    assert patch(client, "leila", "item-tortillas", bought=False).status_code == 403  # nor uncheck
    assert patch(client, "sam", "item-tortillas", bought=False).status_code == 200


def test_nobody_can_check_items_off_without_a_run(client: TestClient):
    assert trip(client, "sam", "finish").status_code == 200
    for actor in ("sam", "leila"):
        response = patch(client, actor, "item-milk", bought=True)
        assert response.status_code == 403
        assert response.json()["error"]["code"] == "NOT_SHOPPING"
    assert trip(client, "leila", "start", storeName="QFC", requestWindowMinutes=5).status_code == 200
    assert patch(client, "leila", "item-milk", bought=True).status_code == 200


def test_only_the_person_who_made_a_change_can_undo_it(client: TestClient):
    added = client.post("/api/items", json={"workspaceId": "demo-family", "actorId": "leila", "requestId": str(uuid.uuid4()), "name": "Paper plates"}).json()
    undo = lambda actor: client.post(f"/api/actions/{added['actionId']}/undo", json={"workspaceId": "demo-family", "actorId": actor, "requestId": str(uuid.uuid4())})
    blocked = undo("sam")
    assert blocked.status_code == 403
    assert blocked.json()["error"]["code"] == "NOT_YOUR_ACTION"
    assert undo("leila").status_code == 200
