"""Cart matching and meal-reservation helpers."""

from __future__ import annotations

from app.list_ops import apply_preview_to_cart, build_list_preview, find_compatible


def _item(**overrides):
    base = {
        "id": "item-1",
        "name": "Tortillas",
        "quantity": 6,
        "unit": "count",
        "note": "",
        "requestFor": "household",
        "addedBy": "leila",
        "bought": False,
        "version": 1,
        "createdAt": "2026-10-18T00:00:00Z",
        "removed": False,
        "runId": None,
        "reservedPlanId": None,
    }
    base.update(overrides)
    return base


def test_find_compatible_skips_reserved_meal_quantities():
    cart = [
        _item(id="reserved", quantity=8, reservedPlanId="plan-a"),
        _item(id="free", quantity=2),
    ]
    match = find_compatible(cart, name="Tortillas", unit="count", note="", request_for="household")
    assert match["id"] == "free"


def test_meal_increase_tags_reserved_plan():
    cart = [_item()]
    proposed = [{"id": "ing-1", "name": "Tortillas", "quantity": 8, "unit": "count", "note": ""}]
    preview = build_list_preview(proposed, cart)
    assert preview[0]["action"] == "increase"
    updated, deltas = apply_preview_to_cart(
        proposed,
        preview,
        cart,
        excluded_ids=set(),
        actor_id="leila",
        now="2026-10-18T12:00:00Z",
        new_item_id=lambda: "item-new",
        reserved_plan_id="plan-tacos",
    )
    tortillas = next(i for i in updated if i["id"] == "item-1")
    assert tortillas["quantity"] == 8
    assert tortillas["reservedPlanId"] == "plan-tacos"
    assert deltas[0]["op"] == "increase"
    assert deltas[0]["after"]["reservedPlanId"] == "plan-tacos"


def test_meal_keep_splits_surplus_unreserved_quantity():
    cart = [_item(quantity=10)]
    proposed = [{"id": "ing-1", "name": "Tortillas", "quantity": 8, "unit": "count", "note": ""}]
    preview = build_list_preview(proposed, cart)
    assert preview[0]["action"] == "keep"
    ids = iter(["item-meal"])
    updated, deltas = apply_preview_to_cart(
        proposed,
        preview,
        cart,
        excluded_ids=set(),
        actor_id="leila",
        now="2026-10-18T12:00:00Z",
        new_item_id=lambda: next(ids),
        reserved_plan_id="plan-tacos",
    )
    by_id = {item["id"]: item for item in updated}
    assert by_id["item-1"]["quantity"] == 2
    assert by_id["item-1"]["reservedPlanId"] is None
    assert by_id["item-meal"]["quantity"] == 8
    assert by_id["item-meal"]["reservedPlanId"] == "plan-tacos"
    assert deltas[0]["op"] == "split"


def test_grocery_keep_does_not_reserve():
    cart = [_item(quantity=8)]
    proposed = [{"id": "g-1", "name": "Tortillas", "quantity": 8, "unit": "count", "note": ""}]
    preview = build_list_preview(proposed, cart)
    updated, deltas = apply_preview_to_cart(
        proposed,
        preview,
        cart,
        excluded_ids=set(),
        actor_id="leila",
        now="2026-10-18T12:00:00Z",
        new_item_id=lambda: "item-new",
    )
    assert updated[0]["reservedPlanId"] is None
    assert deltas == []
