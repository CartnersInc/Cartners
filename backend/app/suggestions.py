"""Build meal/grocery drafts for POST /api/suggestions.

Uses Ethan's Gemini adapter when a key is present; otherwise returns labeled sample drafts.
"""

from __future__ import annotations

import copy
import json
import uuid
from datetime import date, timedelta
from pathlib import Path
from typing import Any

from app.errors import ApiError

FIXTURES = Path(__file__).resolve().parents[2] / "docs" / "fixtures"


def _load_fixture(name: str) -> dict[str, Any]:
    return json.loads((FIXTURES / name).read_text())


def _stamp(draft: dict[str, Any], *, workspace_id: str, plan_date: str, list_revision: int, previous: str | None) -> dict[str, Any]:
    draft = copy.deepcopy(draft)
    draft["draftId"] = f"draft-{uuid.uuid4().hex[:10]}"
    draft["workspaceId"] = workspace_id
    draft["planDate"] = plan_date
    draft["listRevision"] = list_revision
    draft["previousDraftId"] = previous
    if draft.get("kind") == "recommendation":
        for ingredient in draft["recommendation"]["ingredients"]:
            if not ingredient.get("id"):
                ingredient["id"] = f"ing-{uuid.uuid4().hex[:8]}"
    elif draft.get("kind") == "grocery_list":
        for item in draft.get("items") or []:
            if not item.get("id"):
                item["id"] = f"g-{uuid.uuid4().hex[:8]}"
    return draft


WEEKLY_HINT = (
    "this week", "weekly", "seven days", "7 days", "plan our week",
    "plan the week", "plan my week", "week of meals", "plan dinners for the week",
    "plan this week",
)

SAMPLE_WEEK = [
    ("Chickpea coconut stew", "A one-pot vegetarian dinner with leftover-friendly rice."),
    ("Black bean tacos", "Build-your-own toppings so picky eaters can assemble their own."),
    ("Lemon pasta with peas", "Short cook, pantry pasta, and a bright vegetable."),
    ("Baked potato bar", "Hands-off oven time while people add their own toppings."),
    ("Veggie fried rice", "Uses leftover rice and whatever vegetables are around."),
    ("Tomato white-bean soup", "A make-ahead pot that reheats for late arrivals."),
    ("Sheet-pan tofu and broccoli", "One pan, high heat, and a short ingredient list."),
]


def wants_weekly_plan(message: str) -> bool:
    text = message.lower()
    return any(hint in text for hint in WEEKLY_HINT)


def week_dates(start: date) -> list[date]:
    monday = start - timedelta(days=start.weekday())
    return [monday + timedelta(days=offset) for offset in range(7)]


def sample_weekly_plan(message: str, start: date, preferences: dict[str, Any]) -> dict[str, Any]:
    servings = int(preferences.get("servings") or 4)
    days = []
    for offset, (title, reason) in enumerate(SAMPLE_WEEK):
        day = week_dates(start)[offset]
        days.append({
            "planDate": day.isoformat(),
            "recommendation": {
                "title": title,
                "servings": servings,
                "prepMinutesApprox": 30,
                "fitReason": reason,
                "ingredients": [
                    {"id": f"ing-w{offset}-1", "name": "Vegetables", "quantity": 4, "unit": "count", "note": ""},
                    {"id": f"ing-w{offset}-2", "name": "Pantry staple", "quantity": 1, "unit": "pack", "note": ""},
                ],
                "steps": ["Prep the vegetables.", "Cook according to the recipe card.", "Serve family-style."],
                "uncertainties": [],
            },
        })
    return {
        "kind": "weekly_plan",
        "inputSummary": {
            "message": message,
            "summary": "Seven dinners for this week using saved household defaults.",
            "servings": servings,
            "restrictions": list(preferences.get("restrictions") or []),
            "maxPrepMinutes": int(preferences.get("maxPrepMinutes") or 30),
        },
        "days": days,
        "changesSummary": "Preview only. Saving this week does not add groceries.",
    }


def sample_draft_for_message(message: str) -> dict[str, Any]:
    text = message.lower()
    if any(word in text for word in ("milk", "eggs", "grocery", "groceries", "buy", "paper plate")):
        return _load_fixture("groceries.json")
    if "quick" in text or "quicker" in text or "faster" in text:
        return _load_fixture("refinement.json")
    if "?" in text and any(word in text for word in ("or", "which", "what kind")):
        return _load_fixture("clarification.json")
    return _load_fixture("suggestions.json")


def build_suggestion(
    *,
    workspace_id: str,
    message: str,
    plan_date: date | None,
    list_revision: int,
    preferences: dict[str, Any],
    previous_draft: dict[str, Any] | None,
    previous_draft_id: str | None,
    image_bytes: bytes | None = None,
    image_mime_type: str | None = None,
) -> dict[str, Any]:
    start = plan_date or date.today()
    day = start.isoformat()
    previous_id = previous_draft_id or (previous_draft or {}).get("draftId")

    if wants_weekly_plan(message):
        try:
            from app.services.gemini_suggestions import Preferences, generate_weekly_plan

            prefs = Preferences(
                servings=int(preferences.get("servings") or 4),
                restrictions=list(preferences.get("restrictions") or []),
                likes=list(preferences.get("likes") or []),
                maxPrepMinutes=int(preferences.get("maxPrepMinutes") or 30),
            )
            result = generate_weekly_plan(message, preferences=prefs)
            dated = []
            for index, entry in enumerate(result.get("days") or []):
                recipe = entry.get("recommendation") or {}
                for ingredient in recipe.get("ingredients") or []:
                    ingredient.setdefault("id", f"ing-w{index}-{uuid.uuid4().hex[:6]}")
                    ingredient.setdefault("note", "")
                dated.append({
                    "planDate": week_dates(start)[index].isoformat(),
                    "recommendation": recipe,
                })
            return {
                "draftId": f"draft-{uuid.uuid4().hex[:10]}",
                "previousDraftId": previous_id,
                "workspaceId": workspace_id,
                "planDate": week_dates(start)[0].isoformat(),
                "listRevision": list_revision,
                "sourceMode": "live_ai",
                "sampleNotice": None,
                "kind": "weekly_plan",
                "inputSummary": result.get("inputSummary"),
                "days": dated,
                "changesSummary": "Preview only. Saving this week does not add groceries.",
            }
        except Exception:
            sample = sample_weekly_plan(message, start, preferences)
            sample["sourceMode"] = "sample"
            sample["sampleNotice"] = "Curated week preview, not a live AI response."
            return _stamp(sample, workspace_id=workspace_id, plan_date=week_dates(start)[0].isoformat(), list_revision=list_revision, previous=previous_id)

    # Prefer live AI when configured.
    try:
        from app.services.gemini_suggestions import Preferences, generate_suggestion

        prefs = Preferences(
            servings=int(preferences.get("servings") or 4),
            restrictions=list(preferences.get("restrictions") or []),
            likes=list(preferences.get("likes") or []),
            maxPrepMinutes=int(preferences.get("maxPrepMinutes") or 30),
        )
        result = generate_suggestion(
            message,
            preferences=prefs,
            previous_draft=previous_draft,
            image_bytes=image_bytes,
            image_mime_type=image_mime_type,
        )
        draft = {
            "draftId": f"draft-{uuid.uuid4().hex[:10]}",
            "previousDraftId": previous_id,
            "workspaceId": workspace_id,
            "planDate": day,
            "listRevision": list_revision,
            "sourceMode": "live_ai",
            "sampleNotice": None,
            **result,
        }
        if draft.get("kind") == "recommendation":
            for ingredient in draft["recommendation"]["ingredients"]:
                ingredient.setdefault("id", f"ing-{uuid.uuid4().hex[:8]}")
                ingredient.setdefault("note", "")
        elif draft.get("kind") == "grocery_list":
            for item in draft.get("items") or []:
                item.setdefault("id", f"g-{uuid.uuid4().hex[:8]}")
                item.setdefault("note", "")
                item.setdefault("unit", "count")
        return draft
    except Exception as exc:
        # Missing key or provider failure → labeled sample, still useful for demos.
        if "Set GEMINI_API_KEY" not in str(exc) and "GOOGLE_API_KEY" not in str(exc):
            # Unexpected model/validation issues: still fall back, but keep message recoverable.
            pass

    sample = sample_draft_for_message(message)
    sample["sourceMode"] = "sample"
    sample["sampleNotice"] = "Curated contract fixture, not a live AI response."
    return _stamp(
        sample,
        workspace_id=workspace_id,
        plan_date=day,
        list_revision=list_revision,
        previous=previous_id,
    )


def require_message(message: str) -> None:
    if not message or not message.strip():
        raise ApiError(422, "INVALID_SUGGESTION_REQUEST", "Message is required.")
    if len(message) > 500:
        raise ApiError(422, "INVALID_SUGGESTION_REQUEST", "Message must be 500 characters or fewer.")
