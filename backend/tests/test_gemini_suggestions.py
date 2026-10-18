import unittest
from unittest.mock import patch
from fastapi.testclient import TestClient

from app.services.gemini_suggestions import (
    GeminiMealOutput,
    Preferences,
    _normalize_message,
)
from app.main import app, SuggestionRequest, make_preview_draft
from pydantic import ValidationError


class SuggestionValidationTests(unittest.TestCase):
    def test_message_is_trimmed_and_capped(self):
        self.assertEqual(_normalize_message("  cozy dinner  "), "cozy dinner")
        with self.assertRaises(ValueError):
            _normalize_message(" ")
        with self.assertRaises(ValueError):
            _normalize_message("x" * 501)

    def test_preferences_trim_blank_values(self):
        prefs = Preferences.model_validate({"restrictions": [" vegan ", " "]})
        self.assertEqual(prefs.restrictions, ["vegan"])

    def test_clarification_has_one_question_and_no_recipe(self):
        draft = GeminiMealOutput.model_validate({
            "kind": "clarification",
            "question": "Is dairy okay?",
            "inputSummary": {
                "message": "Make creamy pasta",
                "summary": "Request conflicts with saved dairy restriction.",
                "servings": 4,
                "restrictions": ["dairy-free"],
                "maxPrepMinutes": 30,
            },
        })
        self.assertEqual(draft.question, "Is dairy okay?")
        with self.assertRaises(ValidationError):
            GeminiMealOutput.model_validate({
                "kind": "clarification",
                "inputSummary": {
                    "message": "x", "summary": "x", "servings": 4,
                    "restrictions": [], "maxPrepMinutes": 30,
                },
            })

    def test_recipe_rejects_unsupported_units(self):
        with self.assertRaises(ValidationError):
            GeminiMealOutput.model_validate({
                "kind": "recommendation",
                "inputSummary": {
                    "message": "dinner", "summary": "quick", "servings": 2,
                    "restrictions": [], "maxPrepMinutes": 30,
                },
                "recommendation": {
                    "title": "Pasta", "servings": 2, "prepMinutesApprox": 20,
                    "fitReason": "Quick", "ingredients": [
                        {"name": "Pasta", "quantity": 200, "unit": "cups"}
                    ],
                    "steps": ["Boil."],
                },
            })

    def test_provider_uses_configured_gemini_model_and_returns_live_label(self):
        response_json = '''{
            "kind":"recommendation",
            "inputSummary":{"message":"tacos","summary":"quick meal","servings":2,"restrictions":[],"maxPrepMinutes":30},
            "recommendation":{"title":"Bean tacos","servings":2,"prepMinutesApprox":20,"fitReason":"Fast","ingredients":[{"name":"Beans","quantity":1,"unit":"can"}],"steps":["Warm beans."]}
        }'''
        from app.services.gemini_suggestions import GeminiMealOutput

        response = type("Response", (), {
            "text": response_json,
            "parsed": GeminiMealOutput.model_validate_json(response_json),
        })()
        with patch("google.genai.Client") as client_class:
            client_class.return_value.models.generate_content.return_value = response
            from app.services.gemini_suggestions import generate_suggestion

            result = generate_suggestion("tacos", api_key="test-key")

        self.assertEqual(result["sourceMode"], "live_ai")
        self.assertEqual(result["recommendation"]["title"], "Bean tacos")
        call = client_class.return_value.models.generate_content.call_args
        self.assertEqual(call.kwargs["model"], "gemini-3.5-flash-lite")
        self.assertEqual(call.kwargs["config"].response_schema, GeminiMealOutput)

    def test_ai_preview_has_review_rows_and_cannot_claim_to_be_saved(self):
        request = SuggestionRequest(
            workspaceId="demo-family",
            message="Dinner",
            planDate="2026-10-17",
            listRevision=1,
            preferences={"servings": 2, "restrictions": []},
        )
        result = make_preview_draft({
            "kind": "recommendation",
            "inputSummary": {"message": "Dinner", "summary": "Quick dinner", "servings": 2, "restrictions": [], "maxPrepMinutes": 30},
            "recommendation": {
                "title": "Bean tacos", "servings": 2, "prepMinutesApprox": 20,
                "fitReason": "Fast", "ingredients": [{"name": "Beans", "quantity": 1, "unit": "can"}],
                "steps": ["Warm beans."],
            },
        }, request)
        self.assertEqual(result["sourceMode"], "live_ai")
        self.assertIn("not saved", result["sampleNotice"])
        self.assertEqual(result["recommendation"]["listPreview"][0]["action"], "review")
        self.assertTrue(result["recommendation"]["ingredients"][0]["id"].startswith("ingredient-"))

    def test_ai_preview_route_returns_valid_draft(self):
        ai_result = {
            "kind": "recommendation",
            "inputSummary": {"message": "Dinner", "summary": "Quick dinner", "servings": 2, "restrictions": [], "maxPrepMinutes": 30},
            "recommendation": {
                "title": "Bean tacos", "servings": 2, "prepMinutesApprox": 20,
                "fitReason": "Fast", "ingredients": [{"name": "Beans", "quantity": 1, "unit": "can"}],
                "steps": ["Warm beans."],
            },
        }
        with patch("app.main.generate_suggestion", return_value=ai_result):
            response = TestClient(app).post(
                "/api/ai/suggestions",
                json={
                    "workspaceId": "demo-family", "requestId": "test", "message": "Dinner",
                    "planDate": "2026-10-17", "listRevision": 1,
                    "preferences": {"servings": 2, "restrictions": [], "likes": [], "maxPrepMinutes": 30},
                },
            )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["sourceMode"], "live_ai")
        self.assertEqual(response.json()["recommendation"]["title"], "Bean tacos")

    def test_photo_upload_reaches_the_suggestion_function(self):
        ai_result = {
            "kind": "recommendation",
            "inputSummary": {"message": "healthier version of this", "summary": "Lighter pasta", "servings": 2, "restrictions": [], "maxPrepMinutes": 30},
            "recommendation": {
                "title": "Lighter pasta", "servings": 2, "prepMinutesApprox": 20,
                "fitReason": "Based on the photo.", "ingredients": [{"name": "Pasta", "quantity": 200, "unit": "g"}],
                "steps": ["Boil the pasta."],
            },
        }
        with patch("app.main.generate_suggestion", return_value=ai_result) as generate:
            response = TestClient(app).post(
                "/api/ai/suggestions",
                data={
                    "workspaceId": "demo-family", "requestId": "photo-1", "message": "healthier version of this",
                    "planDate": "2026-10-17", "listRevision": "1",
                    "preferences": '{"servings":2,"restrictions":[],"likes":[],"maxPrepMinutes":30}',
                },
                files={"image": ("pasta.jpg", b"\xff\xd8\xff fake", "image/jpeg")},
            )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(generate.call_args.kwargs["image_mime_type"], "image/jpeg")
        self.assertTrue(generate.call_args.kwargs["image_bytes"].startswith(b"\xff\xd8\xff"))

    def test_event_suggestions_use_the_occasion_and_past_meals(self):
        response_json = '''{
            "kind":"event_suggestions",
            "eventSummary":"Shareable food for a 6:30 movie night.",
            "options":[
                {"title":"Sheet-pan nachos","servings":4,"prepMinutesApprox":20,"fitReason":"Easy to share at 18:30.","ingredients":[{"name":"Tortilla chips","quantity":1,"unit":"pack"}],"steps":["Bake until the cheese melts."]},
                {"title":"Veggie wraps","servings":4,"prepMinutesApprox":15,"fitReason":"Handheld for a movie.","ingredients":[{"name":"Tortillas","quantity":8,"unit":"count"}],"steps":["Fill and roll."]},
                {"title":"Bean quesadillas","servings":4,"prepMinutesApprox":25,"fitReason":"Hot food that can sit out.","ingredients":[{"name":"Black beans","quantity":1,"unit":"can"}],"steps":["Cook until crisp."]}
            ]
        }'''
        from app.services.gemini_suggestions import EventSuggestionOutput, suggest_for_event

        parsed = EventSuggestionOutput.model_validate_json(response_json)
        response = type("Response", (), {"text": response_json, "parsed": parsed})()
        with patch("google.genai.Client") as client_class:
            client_class.return_value.models.generate_content.return_value = response
            result = suggest_for_event(
                {"name": "Movie night at ours", "planDate": "2026-10-18", "time": "18:30", "theme": "Movie night"},
                preferences={"servings": 4, "restrictions": ["vegetarian"], "likes": ["Mexican food"], "maxPrepMinutes": 30},
                saved_suggestions=[{"title": "Loaded black bean nachos", "planDate": "2026-10-12"}],
                api_key="test-key",
            )
        prompt = client_class.return_value.models.generate_content.call_args.kwargs["contents"][0]
        self.assertIn("Movie night at ours", prompt)
        self.assertIn("18:30", prompt)
        self.assertIn("Loaded black bean nachos", prompt)
        self.assertEqual(result["kind"], "event_suggestions")
        self.assertEqual(len(result["options"]), 3)
        self.assertEqual(result["event"]["guestCount"], 4)

    def test_event_route_returns_three_unsaved_options(self):
        ai_result = {
            "kind": "event_suggestions",
            "eventSummary": "Shareable food for movie night.",
            "options": [{
                "title": "Veggie wraps", "servings": 4, "prepMinutesApprox": 15,
                "fitReason": "Handheld at 18:30.",
                "ingredients": [{"name": "Tortillas", "quantity": 8, "unit": "count"}],
                "steps": ["Fill and roll."],
            }],
            "sourceMode": "live_ai",
            "planDate": "2026-10-18",
            "event": {"name": "Movie night", "time": "18:30", "theme": "Movie night", "guestCount": 4},
        }
        with patch("app.main.suggest_for_event", return_value=ai_result):
            response = TestClient(app).post(
                "/api/ai/event-suggestions",
                json={
                    "workspaceId": "demo-family", "name": "Movie night", "planDate": "2026-10-18",
                    "time": "18:30", "theme": "Movie night",
                    "preferences": {"servings": 4, "restrictions": ["vegetarian"], "likes": [], "maxPrepMinutes": 30},
                    "savedSuggestions": [{"title": "Bean tacos", "planDate": "2026-10-12"}],
                },
            )
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertIn("Nothing is saved", body["sampleNotice"])
        self.assertTrue(body["options"][0]["ingredients"][0]["id"].startswith("ingredient-"))

    def test_expense_ai_drafts_reviewable_fields_without_saving(self):
        with patch("app.main.draft_expense_from_note", return_value={
            "totalCents": 4218, "payerName": "Leila", "sharedNames": ["Sam"],
            "personalAmounts": [{"personName": "Sam", "amountCents": 800}], "clarification": None,
        }) as mocked:
            with TestClient(app) as client:
                response = client.post("/api/ai/expense-draft", json={
                    "workspaceId": "demo-roommates", "actorId": "leila", "requestId": "receipt-draft-1",
                    "message": "I paid $42.18 at QFC; $8 was Sam's snacks, rest shared.", "mode": "split",
                })
        self.assertEqual(response.status_code, 200)
        draft = response.json()
        self.assertEqual(draft["totalCents"], 4218)
        self.assertEqual(draft["payerId"], "leila")
        self.assertEqual(draft["personalAllocations"], {"sam": 800})
        self.assertFalse(draft["saved"])
        self.assertEqual(mocked.call_args.kwargs["context"]["currentActorName"], "Leila")

    def test_expense_ai_reuses_last_split_when_the_note_omits_sharers(self):
        with patch("app.main.draft_expense_from_note", return_value={
            "totalCents": 4000, "payerName": None, "sharedNames": [],
            "personalAmounts": [], "clarification": None,
        }):
            with TestClient(app) as client:
                response = client.post("/api/ai/expense-draft", json={
                    "workspaceId": "demo-roommates", "actorId": "leila", "requestId": "receipt-memory-1",
                    "message": "The QFC receipt was $40.00.", "mode": "split",
                })
        self.assertEqual(response.status_code, 200)
        draft = response.json()
        self.assertEqual(draft["totalCents"], 4000)
        self.assertEqual(set(draft["sharedMemberIds"]), {"leila", "sam", "jordan", "maya"})
        self.assertFalse(draft["saved"])


if __name__ == "__main__":
    unittest.main()
