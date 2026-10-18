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
        response = type("Response", (), {"text": '''{
            "kind":"recommendation",
            "inputSummary":{"message":"tacos","summary":"quick meal","servings":2,"restrictions":[],"maxPrepMinutes":30},
            "recommendation":{"title":"Bean tacos","servings":2,"prepMinutesApprox":20,"fitReason":"Fast","ingredients":[{"name":"Beans","quantity":1,"unit":"can"}],"steps":["Warm beans."]}
        }'''})()
        with patch("google.genai.Client") as client_class:
            client_class.return_value.models.generate_content.return_value = response
            from app.services.gemini_suggestions import generate_suggestion

            result = generate_suggestion("tacos", api_key="test-key")

        self.assertEqual(result["sourceMode"], "live_ai")
        self.assertEqual(result["recommendation"]["title"], "Bean tacos")
        call = client_class.return_value.models.generate_content.call_args
        self.assertEqual(call.kwargs["model"], "gemini-3.5-flash-lite")
        self.assertEqual(call.kwargs["config"].max_output_tokens, 2048)

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


if __name__ == "__main__":
    unittest.main()
