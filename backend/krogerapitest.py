"""
Local check of the free Kroger Locations + Products APIs.

From the backend/ folder, put your app credentials in .env:

    KROGER_CLIENT_ID=...
    KROGER_CLIENT_SECRET=...

Register the app free at https://developer.kroger.com/ (no shopper login needed).

    python krogerapitest.py --zip 45202
    python krogerapitest.py --zip 97401 milk "black beans" tortillas
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent / ".env")

from app.services.kroger_prices import KrogerError, lookup_ingredients


def main() -> None:
    parser = argparse.ArgumentParser(description="Price ingredients at the nearest Kroger-family store.")
    parser.add_argument(
        "ingredients",
        nargs="*",
        default=["milk", "black beans", "tortillas"],
        help="Search terms. Default: milk, black beans, tortillas",
    )
    parser.add_argument("--zip", required=True, help="ZIP code used to pick the nearest store")
    parser.add_argument("--radius", type=int, default=20, help="Search radius in miles (default 20)")
    parser.add_argument("--options", type=int, default=3, help="Priced options to keep per ingredient")
    args = parser.parse_args()

    try:
        result = lookup_ingredients(
            args.ingredients,
            args.zip,
            options_per_ingredient=args.options,
            radius_miles=args.radius,
        )
    except KrogerError as exc:
        raise SystemExit(str(exc)) from exc

    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
