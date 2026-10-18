"""Temporary AI-only endpoint for the local frontend preview."""

from __future__ import annotations

import os
from datetime import date
from pathlib import Path
from uuid import uuid4

from dotenv import load_dotenv
from fastapi import FastAPI
from pydantic import BaseModel, Field
from fastapi.responses import JSONResponse
from starlette.concurrency import run_in_threadpool

from app.services.gemini_suggestions import Preferences, generate_suggestion, suggest_for_event

load_dotenv(Path(__file__).resolve().parents[1] / ".env")
app = FastAPI(title="Cartners AI preview")


class SavedSuggestionInput(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    planDate: date | None = None
    summary: str = Field(default="", max_length=240)


class EventSuggestionRequest(BaseModel):
    workspaceId: str = Field(min_length=1, max_length=80)
    requestId: str | None = None
    name: str = Field(min_length=1, max_length=80)
    planDate: date
    time: str
    theme: str = Field(default="", max_length=80)
    guestCount: int | None = Field(default=None, ge=1, le=12)
    notes: str = Field(default="", max_length=300)
    preferences: Preferences
    savedSuggestions: list[SavedSuggestionInput] = Field(default_factory=list, max_length=8)


class SuggestionRequest(BaseModel):
    workspaceId: str = Field(min_length=1, max_length=80)
    requestId: str | None = None
    message: str = Field(min_length=1, max_length=500)
    planDate: date
    listRevision: int = Field(ge=0)
    preferences: Preferences
    previousDraft: dict | None = None


def make_preview_draft(result: dict, request: SuggestionRequest) -> dict:
    draft = {
        "draftId": f"ai-{uuid4()}",
        "previousDraftId": request.previousDraft.get("draftId") if request.previousDraft else None,
        "workspaceId": request.workspaceId,
        "planDate": request.planDate.isoformat(),
        "listRevision": request.listRevision,
        "sourceMode": "live_ai",
        "sampleNotice": "AI-generated idea; the cart is still sample data and this preview is not saved.",
        **result,
    }
    if draft.get("kind") == "recommendation":
        ingredients = draft["recommendation"]["ingredients"]
        for ingredient in ingredients:
            ingredient["id"] = f"ingredient-{uuid4()}"
        draft["recommendation"]["listPreview"] = [
            {"ingredientId": item["id"], "action": "review", "reason": "Connect the shared cart to check for duplicates."}
            for item in ingredients
        ]
    return draft


@app.get("/api/ai/health")
def ai_health() -> dict[str, bool]:
    return {"available": bool(os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY"))}


def make_event_preview(result: dict) -> dict:
    preview = {
        **result,
        "sourceMode": "live_ai",
        "sampleNotice": "AI meal ideas for this event. Nothing is saved and the cart is unchanged.",
    }
    for option in preview.get("options") or []:
        for ingredient in option.get("ingredients") or []:
            ingredient["id"] = f"ingredient-{uuid4()}"
    return preview


@app.post("/api/ai/event-suggestions")
async def ai_event_suggestions(request: EventSuggestionRequest) -> dict:
    try:
        result = await run_in_threadpool(
            suggest_for_event,
            {
                "name": request.name,
                "planDate": request.planDate,
                "time": request.time,
                "theme": request.theme,
                "guestCount": request.guestCount,
                "notes": request.notes,
            },
            preferences=request.preferences,
            saved_suggestions=[item.model_dump() for item in request.savedSuggestions],
        )
        return make_event_preview(result)
    except RuntimeError as exc:
        message = str(exc)
        if "Set GEMINI_API_KEY" in message:
            message = "Set GEMINI_API_KEY in backend/.env, then restart the backend."
        return JSONResponse(
            status_code=503,
            content={"error": {
                "code": "AI_UNAVAILABLE",
                "message": message,
                "retryable": True,
                "requestId": request.requestId,
            }},
        )
    except ValueError as exc:
        return JSONResponse(
            status_code=422,
            content={"error": {
                "code": "INVALID_EVENT_REQUEST",
                "message": str(exc),
                "retryable": False,
                "requestId": request.requestId,
            }},
        )


@app.post("/api/ai/suggestions")
async def ai_suggestion_preview(request: SuggestionRequest) -> dict:
    try:
        result = await run_in_threadpool(
            generate_suggestion,
            request.message,
            preferences=request.preferences,
            previous_draft=request.previousDraft,
        )
        return make_preview_draft(result, request)
    except RuntimeError as exc:
        message = str(exc)
        if "Set GEMINI_API_KEY" in message:
            message = "Set GEMINI_API_KEY in backend/.env, then restart the backend."
        return JSONResponse(
            status_code=503,
            content={"error": {
                "code": "AI_UNAVAILABLE",
                "message": message,
                "retryable": True,
                "requestId": request.requestId,
            }},
        )
    except ValueError as exc:
        return JSONResponse(
            status_code=422,
            content={"error": {
                "code": "INVALID_SUGGESTION_REQUEST",
                "message": str(exc),
                "retryable": False,
                "requestId": request.requestId,
            }},
        )
