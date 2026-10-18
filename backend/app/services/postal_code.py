"""Turn a point into a US ZIP using the Census Bureau geocoder. No API key."""

from __future__ import annotations

import json
import urllib.parse
import urllib.request
from typing import Any

CENSUS_URL = "https://geocoding.geo.census.gov/geocoder/geographies/coordinates"


class PostalCodeUnavailable(OSError):
    """The geocoder did not answer."""


def postal_code_for_point(latitude: float, longitude: float) -> str:
    query = urllib.parse.urlencode({
        "x": longitude,
        "y": latitude,
        "benchmark": "Public_AR_Current",
        "vintage": "Current_Current",
        "layers": "all",
        "format": "json",
    })
    request = urllib.request.Request(f"{CENSUS_URL}?{query}", headers={"Accept": "application/json"})
    try:
        with urllib.request.urlopen(request, timeout=8) as response:
            payload = json.load(response)
    except (OSError, json.JSONDecodeError, UnicodeDecodeError) as exc:
        raise PostalCodeUnavailable("Could not look up a ZIP for that location. Type it instead.") from exc
    code = _zip_from_geographies((payload.get("result") or {}).get("geographies") or {})
    if not code:
        raise LookupError("No US ZIP code was found for that location. Type a postal code instead.")
    return code


def _zip_from_geographies(geographies: dict[str, Any]) -> str | None:
    for name, rows in geographies.items():
        if "ZIP Code Tabulation" not in str(name) or not isinstance(rows, list) or not rows:
            continue
        row = rows[0]
        if not isinstance(row, dict):
            continue
        code = row.get("ZCTA5") or row.get("BASENAME")
        if isinstance(code, str) and len(code) == 5 and code.isdigit():
            return code
    return None
