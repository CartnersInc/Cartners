"""
Homepage meal-suggestion adapter (Gemini).

This is the AI content function only — no HTTP route, no draft IDs, no listPreview.
Xavier's FastAPI layer will wrap this later for POST /api/suggestions.

Usage (local):
    from app.services.gemini_suggestions import generate_suggestion
    result = generate_suggestion("Something cozy for dinner")
"""

from __future__ import annotations

import json
import os
import time
from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator, model_validator

Unit = Literal["count", "g", "ml", "can", "pack"]
Kind = Literal["recommendation", "clarification"]

DEFAULT_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.8-flash")
DEFAULT_TIMEOUT_SECONDS = 25.0
MAX_MESSAGE_CHARS = 500
# Gemini 429/503 are capacity spikes. Retry a few times inside the wait budget.
MAX_ATTEMPTS = 3
RETRY_PAUSE_SECONDS = 2.0

DEFAULT_PREFERENCES: dict[str, Any] = {
    "servings": 4,
    "restrictions": ["vegetarian"],
    "likes": ["Mexican food"],
    "maxPrepMinutes": 30,
}


# --- shapes Gemini must return (subset of docs/fixtures/*.json) ---


class IngredientDraft(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    # Use ge (not gt): Gemini's response_schema rejects exclusiveMinimum from gt=0.
    quantity: float = Field(ge=0.01)
    unit: Unit
    note: str = Field(default="", max_length=120)


class RecommendationBody(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    servings: int = Field(ge=1, le=12)
    prepMinutesApprox: int = Field(ge=1, le=240)
    fitReason: str = Field(min_length=1, max_length=300)
    ingredients: list[IngredientDraft] = Field(min_length=1, max_length=20)
    steps: list[str] = Field(min_length=1, max_length=10)
    uncertainties: list[str] = Field(default_factory=list, max_length=8)


class InputSummary(BaseModel):
    message: str
    summary: str = Field(min_length=1, max_length=240)
    servings: int = Field(ge=1, le=12)
    restrictions: list[str] = Field(default_factory=list, max_length=12)
    maxPrepMinutes: int = Field(ge=1, le=240)


class GeminiMealOutput(BaseModel):
    """Raw structured output from the model (validated before callers use it)."""

    kind: Kind
    inputSummary: InputSummary
    changesSummary: str | None = None
    recommendation: RecommendationBody | None = None
    question: str | None = None

    @model_validator(mode="after")
    def check_kind_payload(self) -> GeminiMealOutput:
        if self.kind == "recommendation":
            if self.recommendation is None:
                raise ValueError("recommendation kind requires recommendation")
            if self.question:
                raise ValueError("recommendation kind must not include question")
        else:
            if not self.question:
                raise ValueError("clarification kind requires question")
            if self.recommendation is not None:
                raise ValueError("clarification kind must not include recommendation")
        return self


class Preferences(BaseModel):
    servings: int = Field(default=4, ge=1, le=12)
    restrictions: list[str] = Field(default_factory=list, max_length=12)
    likes: list[str] = Field(default_factory=list, max_length=12)
    maxPrepMinutes: int = Field(default=30, ge=1, le=240)

    @field_validator("restrictions", "likes")
    @classmethod
    def trim_strings(cls, values: list[str]) -> list[str]:
        return [v.strip() for v in values if v and v.strip()]


def _normalize_message(message: str) -> str:
    text = (message or "").strip()
    if not text:
        raise ValueError("message must be 1–500 characters")
    if len(text) > MAX_MESSAGE_CHARS:
        raise ValueError(f"message must be at most {MAX_MESSAGE_CHARS} characters")
    return text


def _build_prompt(
    message: str,
    preferences: Preferences,
    previous_draft: dict[str, Any] | None,
) -> str:
    prefs_block = json.dumps(preferences.model_dump(), indent=2)
    previous_block = (
        json.dumps(previous_draft, indent=2)
        if previous_draft
        else "null (this is a fresh request)"
    )
    return f"""You are the dinner planner for a shared household shopping app.

Return ONE result:
- kind "recommendation": exactly one meal idea the household could cook tonight, OR
- kind "clarification": exactly one focused question when a hard contradiction blocks a safe answer.

Hard rules:
- Honor saved dietary restrictions. Never relax them by inference.
- If the user request clearly conflicts with a saved restriction (e.g. asks for chicken while vegetarian is saved), return clarification — do not invent a workaround silently.
- Soft preferences (likes, time, servings) may be overridden by this message when the user clearly asks.
- Vague requests like "idk" / "something fun": use the saved preferences and recommend something useful. Do not ask a clarification just for lack of cuisine preference.
- Units for every ingredient must be one of: count, g, ml, can, pack. No cups, tbsp, oz, or "to taste" as a unit (put seasoning hints in note).
- 1–20 ingredients, 1–10 short cooking steps, servings 1–12, prepMinutesApprox 1–240.
- uncertainties: specific label-check or taste caveats only (not generic disclaimers).
- Do not invent merchant prices or claim allergen-free safety.
- Do not include shopping-list diffs, draft IDs, or cost totals — those are computed elsewhere.
- changesSummary: null on a fresh request; on a refinement, one short sentence of what changed.

Saved household preferences (defaults unless this message overrides an allowed soft value):
{prefs_block}

Previous draft context (for refinements; null if none):
{previous_block}

User message:
{message}
"""


def generate_suggestion(
    message: str,
    *,
    preferences: Preferences | dict[str, Any] | None = None,
    previous_draft: dict[str, Any] | None = None,
    api_key: str | None = None,
    model: str | None = None,
    timeout_seconds: float = DEFAULT_TIMEOUT_SECONDS,
) -> dict[str, Any]:
    """
    Call Gemini and return validated meal suggestion JSON.

    Returns a dict shaped like the AI portion of docs/fixtures/suggestions.json
    (without draftId, listRevision, listPreview, or sourceMode — the route adds those).

    """
    from google import genai
    from google.genai import types

    cleaned = _normalize_message(message)
    prefs = (
        preferences
        if isinstance(preferences, Preferences)
        else Preferences.model_validate(preferences or DEFAULT_PREFERENCES)
    )

    key = api_key or os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    if not key:
        raise RuntimeError(
            "Set GEMINI_API_KEY (or GOOGLE_API_KEY) in the environment or pass api_key="
        )

    client = genai.Client(api_key=key)
    prompt = _build_prompt(cleaned, prefs, previous_draft)

    from google.genai import errors as genai_errors

    response = None
    last_error: Exception | None = None
    for attempt in range(1, MAX_ATTEMPTS + 1):
        try:
            response = client.models.generate_content(
                model=model or DEFAULT_MODEL,
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_json_schema=GeminiMealOutput.model_json_schema(),
                    max_output_tokens=2048,
                    http_options=types.HttpOptions(timeout=int(timeout_seconds * 1000)),
                ),
            )
            break
        except genai_errors.APIError as exc:
            last_error = exc
            # 429 = rate limit, 503 = temporary capacity. Anything else is not a retry.
            if getattr(exc, "code", None) not in {429, 503} or attempt == MAX_ATTEMPTS:
                raise RuntimeError(
                    "Live suggestions unavailable. Gemini is busy or over quota. "
                    "Run the same command again in a few seconds."
                ) from exc
            time.sleep(RETRY_PAUSE_SECONDS)

    if response is None:
        raise RuntimeError("Live suggestions unavailable.") from last_error

    if not response.text:
        raise RuntimeError("Gemini returned an empty response")
    payload = GeminiMealOutput.model_validate_json(response.text).model_dump()

    # Server fields the route/Xavier will fill later — useful when inspecting output.
    payload["sourceMode"] = "live_ai"
    payload["costStatus"] = "unverified"
    return payload
