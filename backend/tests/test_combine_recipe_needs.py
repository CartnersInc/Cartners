"""A second recipe that needs something already planned for another meal adds to that row."""

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


def confirm_recipe(client: TestClient, title: str, ingredients: list[dict], request_for: str | None = None) -> dict:
    draft = client.post(
        "/api/event-drafts",
        json={
            "workspaceId": "demo-family",
            "actorId": "leila",
            "requestId": str(uuid.uuid4()),
            "planDate": "2026-10-18",
            "eventName": title,
            "option": {"title": title, "servings": 4, "prepMinutesApprox": 20, "fitReason": "Test.", "ingredients": ingredients, "steps": ["Cook."], "uncertainties": []},
        },
    ).json()
    response = client.post(
        "/api/drafts/confirm",
        json={"workspaceId": "demo-family", "actorId": "leila", "requestId": str(uuid.uuid4()), "draftId": draft["draftId"], "expectedListRevision": draft["listRevision"], "target": "cart", **({"requestFor": request_for} if request_for else {})},
    )
    assert response.status_code == 200, response.json()
    return {"draft": draft, "workspace": response.json()["workspace"], "actionId": response.json()["actionId"]}


def rows(workspace: dict, name: str) -> list[dict]:
    return [item for item in workspace["items"] if item["name"].lower() == name.lower() and not item["removed"]]


def finish_seeded_run(client: TestClient) -> None:
    workspace = client.get("/api/workspace", params={"workspaceId": "demo-family"}).json()
    response = client.patch("/api/trip", json={"workspaceId": "demo-family", "actorId": "sam", "requestId": str(uuid.uuid4()), "expectedTripVersion": workspace["trip"]["version"], "action": "finish"})
    assert response.status_code == 200


def test_second_recipe_adds_to_the_existing_row(client: TestClient):
    finish_seeded_run(client)
    tacos = confirm_recipe(client, "Tacos", [{"name": "Lime", "quantity": 2, "unit": "count"}])
    first = rows(tacos["workspace"], "Lime")
    assert len(first) == 1 and first[0]["quantity"] == 2

    pad_thai = confirm_recipe(client, "Pad Thai", [{"name": "lime", "quantity": 3, "unit": "count"}])
    preview = pad_thai["draft"]["recommendation"]["listPreview"][0]
    assert preview["action"] == "increase" and preview["deltaQuantity"] == 3 and preview["combined"] is True
    combined = rows(pad_thai["workspace"], "Lime")
    assert len(combined) == 1
    assert combined[0]["quantity"] == 5
    assert combined[0]["reservedPlanId"] == first[0]["reservedPlanId"]  # still Tacos' row; Pad Thai adds on top


def test_undo_removes_only_the_added_amount(client: TestClient):
    finish_seeded_run(client)
    confirm_recipe(client, "Tacos", [{"name": "Lime", "quantity": 2, "unit": "count"}])
    pad_thai = confirm_recipe(client, "Pad Thai", [{"name": "Lime", "quantity": 3, "unit": "count"}])
    undo = client.post(f"/api/actions/{pad_thai['actionId']}/undo", json={"workspaceId": "demo-family", "actorId": "leila", "requestId": str(uuid.uuid4())})
    assert undo.status_code == 200
    remaining = rows(undo.json()["workspace"], "Lime")
    assert len(remaining) == 1 and remaining[0]["quantity"] == 2


def test_combines_while_the_run_takes_requests_but_not_once_shopping(client: TestClient):
    finish_seeded_run(client)
    confirm_recipe(client, "Tacos", [{"name": "Lime", "quantity": 2, "unit": "count"}])
    workspace = client.get("/api/workspace", params={"workspaceId": "demo-family"}).json()
    start = client.patch("/api/trip", json={"workspaceId": "demo-family", "actorId": "sam", "requestId": str(uuid.uuid4()), "expectedTripVersion": workspace["trip"]["version"], "action": "start", "storeName": "QFC", "requestWindowMinutes": 5})
    assert start.status_code == 200
    assert rows(start.json()["workspace"], "Lime")[0]["runId"] == start.json()["workspace"]["trip"]["id"]

    # The run is still taking requests: a new recipe adds to the same row.
    pad_thai = confirm_recipe(client, "Pad Thai", [{"name": "Lime", "quantity": 1, "unit": "count"}])
    assert [row["quantity"] for row in rows(pad_thai["workspace"], "Lime")] == [3]

    # Requests close; Sam is shopping. That row is left alone and the next recipe waits for the next run.
    db = client.app.state.db
    db.execute("UPDATE trips SET request_deadline_at = '2000-01-01T00:00:00Z' WHERE workspace_id = 'demo-family'")
    db.commit()
    soup = confirm_recipe(client, "Soup", [{"name": "Lime", "quantity": 1, "unit": "count"}])
    limes = sorted(rows(soup["workspace"], "Lime"), key=lambda row: row["quantity"])
    assert [row["quantity"] for row in limes] == [1, 3]
    assert limes[0]["runId"] is None


def test_different_prep_notes_still_combine(client: TestClient):
    finish_seeded_run(client)
    confirm_recipe(client, "Plokkfiskur", [{"name": "Potatoes", "quantity": 800, "unit": "g", "note": "peeled and quartered"}])
    pav = confirm_recipe(client, "Pav bhaji", [{"name": "Potatoes", "quantity": 500, "unit": "g", "note": "boiled and peeled"}])
    potatoes = rows(pav["workspace"], "Potatoes")
    assert len(potatoes) == 1 and potatoes[0]["quantity"] == 1300
    assert potatoes[0]["note"] == "peeled and quartered"


def test_different_units_stay_separate(client: TestClient):
    finish_seeded_run(client)
    confirm_recipe(client, "Soup", [{"name": "Onion", "quantity": 2, "unit": "count"}])
    curry = confirm_recipe(client, "Curry", [{"name": "Onion", "quantity": 300, "unit": "g"}])
    assert sorted((row["unit"], row["quantity"]) for row in rows(curry["workspace"], "Onion")) == [("count", 2), ("g", 300)]


def test_just_me_recipe_adds_personal_requests(client: TestClient):
    finish_seeded_run(client)
    oats = confirm_recipe(client, "Overnight oats", [{"name": "Rolled oats", "quantity": 80, "unit": "g"}, {"name": "Lime", "quantity": 1, "unit": "count"}], request_for="leila")
    assert {row["requestFor"] for row in rows(oats["workspace"], "Rolled oats") + rows(oats["workspace"], "Lime")} == {"leila"}


def test_personal_and_shared_needs_stay_separate(client: TestClient):
    finish_seeded_run(client)
    confirm_recipe(client, "Tacos", [{"name": "Lime", "quantity": 2, "unit": "count"}])
    mine = confirm_recipe(client, "Drink", [{"name": "Lime", "quantity": 1, "unit": "count"}], request_for="leila")
    assert sorted((row["requestFor"], row["quantity"]) for row in rows(mine["workspace"], "Lime")) == [("household", 2), ("leila", 1)]
    again = confirm_recipe(client, "Another drink", [{"name": "Lime", "quantity": 1, "unit": "count"}], request_for="leila")
    assert sorted((row["requestFor"], row["quantity"]) for row in rows(again["workspace"], "Lime")) == [("household", 2), ("leila", 2)]


def test_unknown_person_is_rejected(client: TestClient):
    draft = client.post(
        "/api/event-drafts",
        json={"workspaceId": "demo-family", "actorId": "leila", "requestId": str(uuid.uuid4()), "planDate": "2026-10-18", "eventName": "X",
              "option": {"title": "X", "servings": 2, "prepMinutesApprox": 10, "fitReason": "Test.", "ingredients": [{"name": "Lime", "quantity": 1, "unit": "count"}], "steps": ["Cook."], "uncertainties": []}},
    ).json()
    response = client.post("/api/drafts/confirm", json={"workspaceId": "demo-family", "actorId": "leila", "requestId": str(uuid.uuid4()), "draftId": draft["draftId"], "expectedListRevision": draft["listRevision"], "target": "cart", "requestFor": "nobody"})
    assert response.status_code == 400
