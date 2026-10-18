"""
Local playground for homepage meal suggestions (no HTTP yet).

From the backend/ folder:

    python -m venv .venv
    .venv\\Scripts\\activate          # Windows
    pip install -r requirements.txt
    copy .env.example .env           # then paste your Gemini key

    python geminiapitest.py
    python geminiapitest.py "Tacos for six, keep it vegetarian"
    python geminiapitest.py "Make a healthier version of this" --image path\\to\\pasta.jpg
"""

from __future__ import annotations

import argparse
import json
import mimetypes
import sys
from pathlib import Path

# Allow `python geminiapitest.py` from backend/ without installing the package.
sys.path.insert(0, str(Path(__file__).resolve().parent))

from dotenv import load_dotenv

from app.services.gemini_suggestions import DEFAULT_PREFERENCES, generate_suggestion


def _guess_mime(path: Path) -> str:
    mime, _ = mimetypes.guess_type(path.name)
    if not mime or not mime.startswith("image/"):
        raise SystemExit(f"Could not guess an image MIME type for {path}")
    return mime


def main() -> None:
    load_dotenv(Path(__file__).resolve().parent / ".env")

    parser = argparse.ArgumentParser(description="Try Gemini meal suggestions locally.")
    parser.add_argument(
        "message",
        nargs="?",
        default="Something fun for dinner",
        help="Homepage search-bar text (default: Something fun for dinner)",
    )
    parser.add_argument(
        "--image",
        type=Path,
        help="Optional food photo (jpg/png/webp) for 'version of this' requests",
    )
    parser.add_argument(
        "--previous",
        type=Path,
        help="Optional JSON file of a prior suggestion (refinement context)",
    )
    args = parser.parse_args()

    previous_draft = None
    if args.previous:
        previous_draft = json.loads(args.previous.read_text(encoding="utf-8"))

    image_bytes = None
    image_mime_type = None
    if args.image:
        image_bytes = args.image.read_bytes()
        image_mime_type = _guess_mime(args.image)

    print("Preferences:", json.dumps(DEFAULT_PREFERENCES, indent=2))
    print("Message:", args.message)
    if args.image:
        print("Image:", args.image)
    print("--- calling Gemini ---")

    result = generate_suggestion(
        args.message,
        preferences=DEFAULT_PREFERENCES,
        previous_draft=previous_draft,
        image_bytes=image_bytes,
        image_mime_type=image_mime_type,
    )
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
