"""Cart quantity matching and list-preview helpers."""

from __future__ import annotations

from typing import Any

COMPATIBLE_UNITS = {"count", "g", "ml", "can", "pack"}


def normalize_name(name: str) -> str:
    return " ".join(name.strip().lower().split())


def active_items(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [item for item in items if not item.get("removed") and not item.get("bought")]


def find_compatible(
    items: list[dict[str, Any]],
    *,
    name: str,
    unit: str,
    note: str,
    request_for: str,
) -> dict[str, Any] | None:
    target = normalize_name(name)
    note_n = (note or "").strip().lower()
    for item in active_items(items):
        if item.get("reservedPlanId"):
            # Quantity already committed to another meal cannot satisfy this one.
            continue
        if normalize_name(item["name"]) != target:
            continue
        if item.get("unit") != unit:
            continue
        if (item.get("note") or "").strip().lower() != note_n:
            continue
        if item.get("requestFor") != request_for:
            continue
        return item
    return None


def build_list_preview(
    proposed: list[dict[str, Any]],
    cart_items: list[dict[str, Any]],
    *,
    default_request_for: str = "household",
) -> list[dict[str, Any]]:
    """Compare proposed recipe/grocery lines to the live cart."""
    preview: list[dict[str, Any]] = []
    for row in proposed:
        unit = row.get("unit") or "count"
        if unit not in COMPATIBLE_UNITS:
            preview.append(
                {
                    "ingredientId": row["id"],
                    "action": "review",
                    "reason": f"Unsupported unit '{unit}' for automatic matching.",
                }
            )
            continue
        request_for = row.get("requestFor") or default_request_for
        existing = find_compatible(
            cart_items,
            name=row["name"],
            unit=unit,
            note=row.get("note") or "",
            request_for=request_for,
        )
        needed = float(row["quantity"])
        if existing is None:
            preview.append(
                {
                    "ingredientId": row["id"],
                    "action": "add",
                    "deltaQuantity": needed,
                }
            )
            continue
        current = float(existing["quantity"])
        if current >= needed:
            preview.append(
                {
                    "ingredientId": row["id"],
                    "action": "keep",
                    "existingItemId": existing["id"],
                    "existingQuantity": current,
                    "deltaQuantity": 0,
                }
            )
        else:
            preview.append(
                {
                    "ingredientId": row["id"],
                    "action": "increase",
                    "existingItemId": existing["id"],
                    "existingQuantity": current,
                    "deltaQuantity": needed - current,
                    "reason": f"{needed:g} needed; {current:g} already requested.",
                }
            )
    return preview


def _new_cart_item(
    *,
    item_id: str,
    source: dict[str, Any],
    quantity: float,
    request_for: str,
    actor_id: str,
    now: str,
    reserved_plan_id: str | None,
) -> dict[str, Any]:
    return {
        "id": item_id,
        "name": source["name"],
        "quantity": quantity,
        "unit": source.get("unit") or "count",
        "note": source.get("note") or "",
        "requestFor": request_for,
        "addedBy": actor_id,
        "bought": False,
        "version": 1,
        "createdAt": now,
        "removed": False,
        "runId": None,
        "reservedPlanId": reserved_plan_id,
    }


def apply_preview_to_cart(
    proposed: list[dict[str, Any]],
    preview: list[dict[str, Any]],
    cart_items: list[dict[str, Any]],
    *,
    excluded_ids: set[str],
    actor_id: str,
    now: str,
    new_item_id,
    default_request_for: str = "household",
    reserved_plan_id: str | None = None,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """
    Mutate cart according to preview. Returns (updated items, undo deltas).

    When reserved_plan_id is set (meal + cart confirm), new/updated lines are
    tagged so a later meal cannot reuse those quantities. Grocery confirms leave
    it unset. A keep that absorbs only part of a larger unreserved row splits
    the remainder off so shopping totals stay correct.
    """
    by_id = {item["id"]: dict(item) for item in cart_items}
    order = [item["id"] for item in cart_items]
    deltas: list[dict[str, Any]] = []
    proposed_by_id = {row["id"]: row for row in proposed}

    for row in preview:
        ingredient_id = row["ingredientId"]
        if ingredient_id in excluded_ids:
            continue
        action = row["action"]
        if action == "review":
            continue
        source = proposed_by_id[ingredient_id]
        request_for = source.get("requestFor") or default_request_for
        needed = float(source["quantity"])

        if action == "add":
            item_id = new_item_id()
            item = _new_cart_item(
                item_id=item_id,
                source=source,
                quantity=float(row.get("deltaQuantity") or needed),
                request_for=request_for,
                actor_id=actor_id,
                now=now,
                reserved_plan_id=reserved_plan_id,
            )
            by_id[item_id] = item
            order.append(item_id)
            deltas.append({"op": "add", "itemId": item_id, "after": dict(item)})
            continue

        if action == "increase":
            item_id = row["existingItemId"]
            item = by_id[item_id]
            before = dict(item)
            item["quantity"] = float(item["quantity"]) + float(row["deltaQuantity"])
            item["version"] = int(item["version"]) + 1
            if reserved_plan_id:
                item["reservedPlanId"] = reserved_plan_id
            deltas.append(
                {
                    "op": "increase",
                    "itemId": item_id,
                    "before": before,
                    "after": dict(item),
                    "deltaQuantity": float(row["deltaQuantity"]),
                }
            )
            continue

        if action == "keep":
            if not reserved_plan_id:
                # Grocery/direct previews: already covered, nothing to write.
                continue
            item_id = row["existingItemId"]
            item = by_id[item_id]
            before = dict(item)
            current = float(item["quantity"])
            if current > needed:
                # Leave the remainder unreserved; pull the meal's share onto a reserved row.
                item["quantity"] = current - needed
                item["version"] = int(item["version"]) + 1
                reserved_id = new_item_id()
                reserved = _new_cart_item(
                    item_id=reserved_id,
                    source=source,
                    quantity=needed,
                    request_for=request_for,
                    actor_id=actor_id,
                    now=now,
                    reserved_plan_id=reserved_plan_id,
                )
                # Preserve scope/note from the row we split when the recipe omits them.
                reserved["note"] = item.get("note") or reserved["note"]
                reserved["requestFor"] = item.get("requestFor") or reserved["requestFor"]
                by_id[reserved_id] = reserved
                order.append(reserved_id)
                deltas.append(
                    {
                        "op": "split",
                        "itemId": reserved_id,
                        "parentItemId": item_id,
                        "before": before,
                        "afterParent": dict(item),
                        "after": dict(reserved),
                    }
                )
            else:
                item["reservedPlanId"] = reserved_plan_id
                item["version"] = int(item["version"]) + 1
                deltas.append(
                    {
                        "op": "reserve",
                        "itemId": item_id,
                        "before": before,
                        "after": dict(item),
                    }
                )

    return [by_id[item_id] for item_id in order], deltas


def touched_item_ids(deltas: list[dict[str, Any]]) -> set[str]:
    """Item IDs that must be persisted after applying preview deltas."""
    ids: set[str] = set()
    for delta in deltas:
        if delta.get("itemId"):
            ids.add(delta["itemId"])
        if delta.get("parentItemId"):
            ids.add(delta["parentItemId"])
    return ids
