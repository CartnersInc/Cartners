"""Temporary AI-only endpoint for the local frontend preview."""

from __future__ import annotations

import json
import os
from datetime import date
from pathlib import Path
from uuid import uuid4

from dotenv import load_dotenv
from fastapi import FastAPI, Request
from pydantic import BaseModel, Field
from fastapi.responses import JSONResponse
from starlette.concurrency import run_in_threadpool

from app.services.gemini_suggestions import Preferences, generate_suggestion, suggest_for_event

load_dotenv(Path(__file__).resolve().parents[1] / ".env")
app = FastAPI(title="Cartners AI preview")

MAX_IMAGE_BYTES = 5 * 1024 * 1024
IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}


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


async def read_suggestion(request: Request) -> tuple[SuggestionRequest, bytes | None, str | None]:
    """JSON for a text idea, or multipart when the homepage attaches a photo."""
    if request.headers.get("content-type", "").startswith("multipart/form-data"):
        form = await request.form()
        try:
            preferences = json.loads(form.get("preferences") or "{}")
        except json.JSONDecodeError as exc:
            raise ValueError("preferences must be JSON") from exc
        previous = None
        if form.get("previousDraft"):
            try:
                previous = json.loads(form.get("previousDraft"))
            except json.JSONDecodeError as exc:
                raise ValueError("previousDraft must be JSON") from exc
        payload = SuggestionRequest.model_validate({
            "workspaceId": form.get("workspaceId"),
            "requestId": form.get("requestId") or None,
            "message": form.get("message"),
            "planDate": form.get("planDate"),
            "listRevision": form.get("listRevision") or 0,
            "preferences": preferences,
            "previousDraft": previous,
        })
        upload = form.get("image")
        if upload is None or isinstance(upload, str):
            return payload, None, None
        mime = (getattr(upload, "content_type", "") or "").split(";", 1)[0].strip().lower()
        if mime not in IMAGE_TYPES:
            raise ValueError("Photo must be a JPEG, PNG, or WebP.")
        data = await upload.read()
        if not data:
            raise ValueError("The photo was empty.")
        if len(data) > MAX_IMAGE_BYTES:
            raise ValueError("Use a photo under 5 MB.")
        return payload, data, mime
    return SuggestionRequest.model_validate(await request.json()), None, None


@app.post("/api/ai/suggestions")
async def ai_suggestion_preview(request: Request) -> dict:
    payload = None
    try:
        payload, image_bytes, image_mime_type = await read_suggestion(request)
        result = await run_in_threadpool(
            generate_suggestion,
            payload.message,
            preferences=payload.preferences,
            previous_draft=payload.previousDraft,
            image_bytes=image_bytes,
            image_mime_type=image_mime_type,
        )
        return make_preview_draft(result, payload)
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
                "requestId": payload.requestId if payload else None,
            }},
        )
    except ValueError as exc:
        return JSONResponse(
            status_code=422,
            content={"error": {
                "code": "INVALID_SUGGESTION_REQUEST",
                "message": str(exc),
                "retryable": False,
                "requestId": payload.requestId if payload else None,
            }},
        )
