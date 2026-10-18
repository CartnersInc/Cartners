"""Focused checks for Xavier's shared backend foundation."""

from __future__ import annotations

import uuid
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from app.money import allocate_split, balances_from_expenses


@pytest.fixture()
def client(tmp_path: Path):
    app = create_app(tmp_path / "test.db")
    with TestClient(app) as test_client:
        yield test_client


def rid() -> str:
    return str(uuid.uuid4())


def test_health_and_two_group_snapshots(client: TestClient):
    health = client.get("/api/health").json()
    assert health["ok"] is True
    assert health["schemaVersion"] == 2

    family = client.get("/api/workspace", params={"workspaceId": "demo-family"}).json()
    roommates = client.get("/api/workspace", params={"workspaceId": "demo-roommates"}).json()
    assert family["schemaVersion"] == 2
    assert family["workspaceId"] == "demo-family"
    assert roommates["workspaceId"] == "demo-roommates"
    assert family["preferences"]["spendingMode"] == "pooled"
    assert roommates["preferences"]["spendingMode"] == "split"
    assert {g["workspaceId"] for g in family["groups"]} == {"demo-family", "demo-roommates"}

    # Seeded Movie Night plan: Event / Date / Plan
    plans = family["plans"]
    assert any(p["event"] == "Movie Night" and p["date"] == "2026-10-17" for p in plans)
    movie = next(p for p in plans if p["event"] == "Movie Night")
    assert movie["plan"]["ingredients"]
    assert movie["plan"]["steps"]


def test_group_isolation_on_add_item(client: TestClient):
    body = {
        "workspaceId": "demo-family",
        "actorId": "leila",
        "requestId": rid(),
        "name": "Paper plates",
    }
    result = client.post("/api/items", json=body).json()
    assert result["duplicate"] is False
    family_ids = {item["name"] for item in result["workspace"]["items"] if not item["removed"]}
    assert "Paper plates" in family_ids

    roommates = client.get("/api/workspace", params={"workspaceId": "demo-roommates"}).json()
    assert "Paper plates" not in {item["name"] for item in roommates["items"]}


def test_add_item_replay_safe(client: TestClient):
    request_id = rid()
    body = {
        "workspaceId": "demo-family",
        "actorId": "sam",
        "requestId": request_id,
        "name": "Sparkling water",
    }
    first = client.post("/api/items", json=body).json()
    second = client.post("/api/items", json=body).json()
    assert first["actionId"] == second["actionId"]
    assert first["itemId"] == second["itemId"]
    names = [item["name"] for item in second["workspace"]["items"] if not item["removed"]]
    assert names.count("Sparkling water") == 1


def test_meal_confirm_saves_recipe_plan_and_cart(client: TestClient):
    suggestion = client.post(
        "/api/suggestions",
        json={
            "workspaceId": "demo-family",
            "actorId": "leila",
            "requestId": rid(),
            "message": "Something fun for dinner",
            "planDate": "2026-10-18",
        },
    ).json()
    assert suggestion["kind"] == "recommendation"
    assert suggestion["recommendation"]["ingredients"]
    assert suggestion["recommendation"]["steps"]

    confirm = client.post(
        "/api/drafts/confirm",
        json={
            "workspaceId": "demo-family",
            "actorId": "leila",
            "requestId": rid(),
            "draftId": suggestion["draftId"],
            "expectedListRevision": suggestion["listRevision"],
            "excludedIngredientIds": [],
            "target": "cart",
        },
    ).json()
    workspace = confirm["workspace"]
    meal_plan = next(p for p in workspace["plans"] if p["date"] == "2026-10-18")
    # Tortillas should increase 6 -> 8 and lock to this meal
    tortillas = next(i for i in workspace["items"] if i["id"] == "item-tortillas")
    assert tortillas["quantity"] == 8
    assert tortillas["reservedPlanId"] == meal_plan["id"]
    beans = next(i for i in workspace["items"] if i["name"] == "Black beans" and not i["removed"])
    assert beans["reservedPlanId"] == meal_plan["id"]

    # Stale expected revision must 409 without another AI call
    stale = client.post(
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
    assert stale.status_code == 409
    assert stale.json()["error"]["code"] == "LIST_CHANGED"


def test_second_meal_cannot_reuse_reserved_quantities(client: TestClient):
    """Quantities committed to one saved meal must not satisfy the next meal."""
    first = client.post(
        "/api/suggestions",
        json={
            "workspaceId": "demo-family",
            "actorId": "leila",
            "requestId": rid(),
            "message": "Something fun for dinner",
            "planDate": "2026-10-18",
        },
    ).json()
    confirmed = client.post(
        "/api/drafts/confirm",
        json={
            "workspaceId": "demo-family",
            "actorId": "leila",
            "requestId": rid(),
            "draftId": first["draftId"],
            "expectedListRevision": first["listRevision"],
            "excludedIngredientIds": [],
            "target": "cart",
        },
    ).json()
    after_first = confirmed["workspace"]
    tortillas_after_first = sum(
        i["quantity"]
        for i in after_first["items"]
        if i["name"] == "Tortillas" and not i["removed"] and not i["bought"]
    )
    assert tortillas_after_first == 8

    second = client.post(
        "/api/suggestions",
        json={
            "workspaceId": "demo-family",
            "actorId": "sam",
            "requestId": rid(),
            "message": "Something fun for dinner",
            "planDate": "2026-10-19",
        },
    ).json()
    preview = next(
        row
        for row in second["recommendation"]["listPreview"]
        if row["ingredientId"] == "ing-tortillas"
        or any(
            ing["id"] == row["ingredientId"] and ing["name"] == "Tortillas"
            for ing in second["recommendation"]["ingredients"]
        )
    )
    # Reserved meal qty must not count; second dinner needs its own eight.
    assert preview["action"] == "add"
    assert preview["deltaQuantity"] == 8

    confirmed_second = client.post(
        "/api/drafts/confirm",
        json={
            "workspaceId": "demo-family",
            "actorId": "sam",
            "requestId": rid(),
            "draftId": second["draftId"],
            "expectedListRevision": second["listRevision"],
            "excludedIngredientIds": [],
            "target": "cart",
        },
    ).json()
    items = confirmed_second["workspace"]["items"]
    tortillas_total = sum(
        i["quantity"] for i in items if i["name"] == "Tortillas" and not i["removed"] and not i["bought"]
    )
    assert tortillas_total == 16
    reserved_plans = {
        i["reservedPlanId"]
        for i in items
        if i["name"] == "Tortillas" and not i["removed"] and i.get("reservedPlanId")
    }
    assert len(reserved_plans) == 2


def test_undo_meal_confirm_releases_reserved_quantities(client: TestClient):
    suggestion = client.post(
        "/api/suggestions",
        json={
            "workspaceId": "demo-family",
            "actorId": "leila",
            "requestId": rid(),
            "message": "Something fun for dinner",
            "planDate": "2026-10-18",
        },
    ).json()
    confirm = client.post(
        "/api/drafts/confirm",
        json={
            "workspaceId": "demo-family",
            "actorId": "leila",
            "requestId": rid(),
            "draftId": suggestion["draftId"],
            "expectedListRevision": suggestion["listRevision"],
            "target": "cart",
        },
    ).json()
    undone = client.post(
        f"/api/actions/{confirm['actionId']}/undo",
        json={"workspaceId": "demo-family", "actorId": "leila", "requestId": rid()},
    ).json()
    tortillas = next(i for i in undone["workspace"]["items"] if i["id"] == "item-tortillas")
    assert tortillas["quantity"] == 6
    assert tortillas["reservedPlanId"] is None
    assert not any(p["date"] == "2026-10-18" for p in undone["workspace"]["plans"])


def test_confirm_replay_same_request_id(client: TestClient):
    suggestion = client.post(
        "/api/suggestions",
        json={
            "workspaceId": "demo-roommates",
            "actorId": "leila",
            "requestId": rid(),
            "message": "Milk, eggs, and paper plates",
            "planDate": "2026-10-18",
        },
    ).json()
    request_id = rid()
    body = {
        "workspaceId": "demo-roommates",
        "actorId": "leila",
        "requestId": request_id,
        "draftId": suggestion["draftId"],
        "expectedListRevision": suggestion["listRevision"],
        "target": "cart",
    }
    first = client.post("/api/drafts/confirm", json=body).json()
    second = client.post("/api/drafts/confirm", json=body).json()
    assert first["actionId"] == second["actionId"]
    paper = [i for i in second["workspace"]["items"] if i["name"] == "Paper plates" and not i["removed"]]
    assert len(paper) == 1


def test_concurrent_trip_claim(client: TestClient):
    # Clear seeded family run first by finishing as sam
    family = client.get("/api/workspace", params={"workspaceId": "demo-family"}).json()
    trip = family["trip"]
    assert trip["claimedBy"] == "sam"
    finish = client.patch(
        "/api/trip",
        json={
            "workspaceId": "demo-family",
            "actorId": "sam",
            "requestId": rid(),
            "expectedTripVersion": trip["version"],
            "action": "finish",
        },
    ).json()
    version = finish["workspace"]["trip"]["version"]

    start_a = {
        "workspaceId": "demo-family",
        "actorId": "leila",
        "requestId": rid(),
        "expectedTripVersion": version,
        "action": "start",
        "storeName": "Kroger",
        "requestWindowMinutes": 10,
    }
    start_b = {
        "workspaceId": "demo-family",
        "actorId": "sam",
        "requestId": rid(),
        "expectedTripVersion": version,
        "action": "start",
        "storeName": "QFC",
        "requestWindowMinutes": 10,
    }
    first = client.patch("/api/trip", json=start_a)
    second = client.patch("/api/trip", json=start_b)
    assert first.status_code == 200
    assert second.status_code == 409
    assert second.json()["error"]["code"] == "TRIP_CLAIMED"
    assert first.json()["workspace"]["trip"]["claimedBy"] == "leila"


def test_late_requests_after_deadline_unassigned(client: TestClient, monkeypatch):
    from app import store as store_mod

    family = client.get("/api/workspace", params={"workspaceId": "demo-family"}).json()
    # Seeded run deadline is in the past relative to "now" if we freeze time after deadline
    monkeypatch.setattr(store_mod, "utc_now", lambda: store_mod.datetime(2026, 10, 17, 18, 15, tzinfo=store_mod.timezone.utc))

    result = client.post(
        "/api/items",
        json={
            "workspaceId": "demo-family",
            "actorId": "leila",
            "requestId": rid(),
            "name": "Late bananas",
        },
    ).json()
    bananas = next(i for i in result["workspace"]["items"] if i["name"] == "Late bananas")
    assert bananas["runId"] is None
    snap = result["workspace"]["trip"]
    assert snap["state"] in {"closed_to_requests", "accepting_requests"}


def test_exact_cent_allocations():
    # 1001 among three adults
    alloc = allocate_split(1001, ["a", "b", "c"], {})
    assert sum(alloc.values()) == 1001
    assert sorted(alloc.values()) == [333, 334, 334]

    # 2000 with 600 personal for sam, two shared participants
    alloc = allocate_split(2000, ["leila", "sam"], {"sam": 600})
    assert alloc["sam"] == 1300
    assert alloc["leila"] == 700
    assert sum(alloc.values()) == 2000

    balances = balances_from_expenses(
        [
            {
                "status": "confirmed",
                "mode": "split",
                "payerId": "leila",
                "allocations": {"leila": 700, "sam": 1300},
            },
            {
                "status": "needs_review",
                "mode": "split",
                "payerId": "leila",
                "allocations": {},
            },
            {
                "status": "confirmed",
                "mode": "pooled",
                "payerId": "leila",
                "allocations": {"leila": 500},
            },
        ]
    )
    assert balances == [{"from": "sam", "to": "leila", "cents": 1300}]


def test_expense_endpoint_split(client: TestClient):
    result = client.post(
        "/api/expenses",
        json={
            "workspaceId": "demo-roommates",
            "actorId": "leila",
            "requestId": rid(),
            "totalCents": 2000,
            "payerId": "leila",
            "mode": "split",
            "sharedMemberIds": ["leila", "sam"],
            "personalAllocations": {"sam": 600},
            "status": "confirmed",
        },
    ).json()
    assert result["workspace"]["balances"] == [{"from": "sam", "to": "leila", "cents": 1300}]


def test_needs_review_receipt_can_be_resolved(client: TestClient):
    created = client.post(
        "/api/expenses",
        json={
            "workspaceId": "demo-roommates",
            "actorId": "leila",
            "requestId": rid(),
            "totalCents": 2000,
            "payerId": "leila",
            "mode": "split",
            "sharedMemberIds": ["leila", "sam"],
            "personalAllocations": {"sam": None},
            "status": "needs_review",
        },
    )
    assert created.status_code == 200
    payload = created.json()
    expense_id = payload["expenseId"]
    saved = next(item for item in payload["workspace"]["expenses"] if item["id"] == expense_id)
    assert saved["status"] == "needs_review"
    assert saved["personalAllocations"]["sam"] is None
    assert payload["workspace"]["balances"] == []

    resolved = client.patch(
        f"/api/expenses/{expense_id}",
        json={
            "workspaceId": "demo-roommates",
            "actorId": "leila",
            "requestId": rid(),
            "totalCents": 2000,
            "payerId": "leila",
            "mode": "split",
            "sharedMemberIds": ["leila", "sam"],
            "personalAllocations": {"sam": 600},
            "status": "confirmed",
        },
    )
    assert resolved.status_code == 200
    body = resolved.json()
    assert body["changeSummary"] == "Receipt confirmed. Balances now include it."
    assert body["workspace"]["balances"] == [{"from": "sam", "to": "leila", "cents": 1300}]
    updated = next(item for item in body["workspace"]["expenses"] if item["id"] == expense_id)
    assert updated["status"] == "confirmed"
    assert updated["allocations"]["sam"] == 1300

    blocked = client.patch(
        f"/api/expenses/{expense_id}",
        json={
            "workspaceId": "demo-roommates",
            "actorId": "leila",
            "requestId": rid(),
            "totalCents": 2000,
            "payerId": "leila",
            "mode": "split",
            "sharedMemberIds": ["leila", "sam"],
            "personalAllocations": {"sam": 600},
            "status": "confirmed",
        },
    )
    assert blocked.status_code == 422
    assert blocked.json()["error"]["code"] == "EXPENSE_CONFIRMED"


def test_ingredients_catalog_shape(client: TestClient):
    payload = client.get("/api/ingredients").json()
    assert payload["ingredients"]
    sample = payload["ingredients"][0]
    assert {"id", "name", "description", "priceCents"} <= set(sample)


def test_photo_suggestion_is_saved_on_the_shared_route(client: TestClient, monkeypatch):
    seen = {}

    def fake_generate(message, **kwargs):
        seen["message"] = message
        seen["image"] = kwargs.get("image_bytes")
        seen["mime"] = kwargs.get("image_mime_type")
        return {
            "kind": "recommendation",
            "inputSummary": {
                "message": message,
                "summary": "From the photo.",
                "servings": 4,
                "restrictions": ["vegetarian"],
                "maxPrepMinutes": 20,
            },
            "recommendation": {
                "title": "Photo pasta",
                "servings": 4,
                "prepMinutesApprox": 20,
                "fitReason": "Based on the photo.",
                "ingredients": [{"name": "Pasta", "quantity": 200, "unit": "g", "note": ""}],
                "steps": ["Boil the pasta."],
                "uncertainties": [],
            },
        }

    monkeypatch.setattr("app.services.gemini_suggestions.generate_suggestion", fake_generate)
    response = client.post(
        "/api/suggestions",
        data={
            "workspaceId": "demo-family",
            "actorId": "leila",
            "requestId": rid(),
            "message": "healthier version of this",
            "planDate": "2026-10-18",
        },
        files={"image": ("pasta.jpg", b"\xff\xd8\xff\xd9", "image/jpeg")},
    )
    assert response.status_code == 200
    draft = response.json()
    assert seen["image"].startswith(b"\xff\xd8")
    assert seen["mime"] == "image/jpeg"
    assert draft["kind"] == "recommendation"
    assert draft["recommendation"]["title"] == "Photo pasta"
    assert draft["recommendation"]["listPreview"]
    saved = client.get("/api/suggestions/" + draft["draftId"], params={"workspaceId": "demo-family"})
    assert saved.status_code == 200
    assert saved.json()["recommendation"]["title"] == "Photo pasta"


def test_chosen_event_meal_becomes_a_confirmable_draft(client: TestClient):
    response = client.post(
        "/api/event-drafts",
        json={
            "workspaceId": "demo-family",
            "actorId": "leila",
            "requestId": rid(),
            "planDate": "2026-10-18",
            "eventName": "Movie night at ours",
            "option": {
                "title": "Bean nachos",
                "servings": 4,
                "prepMinutesApprox": 20,
                "fitReason": "Easy to share during a movie.",
                "ingredients": [{"name": "Tortilla chips", "quantity": 1, "unit": "pack"}],
                "steps": ["Warm the chips and beans."],
                "uncertainties": [],
            },
        },
    )
    assert response.status_code == 200
    draft = response.json()
    assert draft["sourceMode"] == "live_ai"
    assert draft["planDate"] == "2026-10-18"
    assert draft["recommendation"]["title"] == "Bean nachos"
    assert draft["recommendation"]["listPreview"]
    confirm = client.post(
        "/api/drafts/confirm",
        json={
            "workspaceId": "demo-family",
            "actorId": "leila",
            "requestId": rid(),
            "draftId": draft["draftId"],
            "expectedListRevision": draft["listRevision"],
            "target": "cart",
        },
    )
    assert confirm.status_code == 200
    assert any(plan["date"] == "2026-10-18" and plan["title"] == "Bean nachos" for plan in confirm.json()["workspace"]["plans"])


def test_basket_compare_sample(client: TestClient):
    result = client.post(
        "/api/baskets/compare",
        json={
            "workspaceId": "demo-family",
            "actorId": "leila",
            "requestId": rid(),
            "itemIds": ["item-tortillas", "item-milk"],
            "postalCode": "98105",
        },
    ).json()
    assert result["sourceMode"] in {"sample", "live_api"}
    complete = [b for b in result["baskets"] if b["complete"]]
    assert complete
    totals = [b["knownSubtotalCents"] for b in complete]
    assert totals == sorted(totals)
