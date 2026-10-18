"""
Kroger public API lookup: nearest store, then priced product options.

Uses the free client-credentials flow. Cart and Identity need a shopper
login and are not called here.

Docs: https://developer.kroger.com/
"""

from __future__ import annotations

import base64
import json
import math
import os
import re
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from typing import Any

DEFAULT_BASE_URL = "https://api.kroger.com/v1"


class KrogerError(RuntimeError):
    """Kroger rejected a call or returned an unusable payload."""


def _base_url() -> str:
    return (os.getenv("KROGER_API_BASE") or DEFAULT_BASE_URL).rstrip("/")


def _credentials() -> tuple[str, str]:
    client_id = (os.getenv("KROGER_CLIENT_ID") or "").strip()
    client_secret = (os.getenv("KROGER_CLIENT_SECRET") or "").strip()
    if not client_id or not client_secret:
        raise KrogerError(
            "Set KROGER_CLIENT_ID and KROGER_CLIENT_SECRET in backend/.env. "
            "Create them free at https://developer.kroger.com/"
        )
    return client_id, client_secret


def _request(
    method: str,
    path: str,
    *,
    token: str | None = None,
    form: dict[str, str] | None = None,
    query: dict[str, str] | None = None,
    basic: str | None = None,
) -> dict[str, Any]:
    url = _base_url() + path
    if query:
        url = url + "?" + urllib.parse.urlencode(query)

    data = None
    headers = {"Accept": "application/json"}
    if form is not None:
        data = urllib.parse.urlencode(form).encode()
        headers["Content-Type"] = "application/x-www-form-urlencoded"
    if token:
        headers["Authorization"] = f"Bearer {token}"
    if basic:
        headers["Authorization"] = f"Basic {basic}"

    request = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(request, timeout=25) as response:
            raw = response.read().decode()
    except urllib.error.HTTPError as exc:
        body = exc.read().decode(errors="replace")
        raise KrogerError(f"Kroger {exc.code} on {path}: {body}") from exc
    except urllib.error.URLError as exc:
        raise KrogerError(f"Could not reach Kroger: {exc.reason}") from exc

    if not raw:
        return {}
    payload = json.loads(raw)
    if not isinstance(payload, dict):
        raise KrogerError(f"Unexpected Kroger payload on {path}")
    return payload


def get_access_token() -> str:
    """App-level token. Enough for Locations and Products, not Cart."""
    client_id, client_secret = _credentials()
    basic = base64.b64encode(f"{client_id}:{client_secret}".encode()).decode()
    payload = _request(
        "POST",
        "/connect/oauth2/token",
        form={"grant_type": "client_credentials", "scope": "product.compact"},
        basic=basic,
    )
    token = payload.get("access_token")
    if not isinstance(token, str) or not token:
        raise KrogerError("Kroger token response did not include access_token")
    return token


def find_stores(
    token: str,
    zip_code: str,
    *,
    limit: int = 3,
    radius_miles: int = 20,
    latitude: float | None = None,
    longitude: float | None = None,
) -> list[dict[str, Any]]:
    """Nearest Kroger-family stores. GPS beats ZIP when both are present."""
    query = {
        "filter.radiusInMiles": str(radius_miles),
        "filter.limit": str(limit),
    }
    if latitude is not None and longitude is not None:
        query["filter.latLong.near"] = f"{latitude},{longitude}"
    else:
        query["filter.zipCode.near"] = zip_code
    payload = _request("GET", "/locations", token=token, query=query)
    stores = payload.get("data") or []
    if not isinstance(stores, list):
        raise KrogerError("Locations response did not include a data list")
    usable = [store for store in stores if isinstance(store, dict)]

    def miles(store: dict[str, Any]) -> float:
        distance = store.get("distance")
        if isinstance(distance, (int, float)) and not isinstance(distance, bool):
            return float(distance)
        return 10_000.0

    return sorted(usable, key=miles)


def search_products(
    token: str,
    term: str,
    location_id: str,
    *,
    limit: int = 3,
) -> list[dict[str, Any]]:
    """Product options at one store. Prices exist only because location_id is set."""
    payload = _request(
        "GET",
        "/products",
        token=token,
        query={
            "filter.term": term,
            "filter.locationId": location_id,
            "filter.limit": str(limit),
        },
    )
    products = payload.get("data") or []
    if not isinstance(products, list):
        raise KrogerError("Products response did not include a data list")
    return [product for product in products if isinstance(product, dict)]


def _aisle(item: dict[str, Any]) -> str | None:
    locations = item.get("aisleLocations") or []
    if not locations or not isinstance(locations, list):
        return None
    first = locations[0]
    if not isinstance(first, dict):
        return None
    description = first.get("description") or ""
    number = first.get("number") or ""
    label = " ".join(part for part in (str(number), str(description)) if part).strip()
    return label or None


_IMAGE_SIZE_ORDER = ("medium", "large", "xlarge", "small", "thumbnail")


def _image_url(product: dict[str, Any]) -> str | None:
    """Front product photo. Uses Kroger's URL, then their public image path."""
    images = product.get("images") or []
    if not isinstance(images, list):
        images = []

    def rank(image: dict[str, Any]) -> tuple[int, int]:
        perspective = str(image.get("perspective") or "").lower()
        return (0 if perspective == "front" else 1, 0 if image.get("default") else 1)

    sized: list[tuple[str, str]] = []
    for image in sorted((img for img in images if isinstance(img, dict)), key=rank):
        for entry in image.get("sizes") or []:
            if not isinstance(entry, dict):
                continue
            url = entry.get("url")
            if isinstance(url, str) and url.startswith("http"):
                sized.append((str(entry.get("size") or "").lower(), url))

    for preferred in _IMAGE_SIZE_ORDER:
        for size, url in sized:
            if size == preferred:
                return url
    if sized:
        return sized[0][1]

    product_id = product.get("productId")
    if isinstance(product_id, str) and product_id:
        return f"https://www.kroger.com/product/images/medium/front/{product_id}"
    return None


def _options(product: dict[str, Any]) -> list[dict[str, Any]]:
    image_url = _image_url(product)
    options = []
    for item in product.get("items") or []:
        if not isinstance(item, dict):
            continue
        price = item.get("price") if isinstance(item.get("price"), dict) else {}
        inventory = item.get("inventory") if isinstance(item.get("inventory"), dict) else {}
        options.append(
            {
                "productId": product.get("productId"),
                "brand": product.get("brand"),
                "description": product.get("description"),
                "size": item.get("size"),
                "soldBy": item.get("soldBy"),
                "regularPrice": price.get("regular"),
                "promoPrice": price.get("promo"),
                "stockLevel": inventory.get("stockLevel"),
                "aisle": _aisle(item),
                "imageUrl": image_url,
            }
        )
    return options


# Kroger `size` is a label such as "1 gal" or "10 ct", not a structured quantity.
_SIZE_RE = re.compile(
    r"(?P<num>\d+\s*/\s*\d+|\d+(?:\.\d+)?)\s*"
    r"(?P<unit>fl\.?\s*oz|fluid\s+ounces?|gallons?|gal|quarts?|qt|pints?|pt|"
    r"liters?|litres?|l|milliliters?|ml|pounds?|lbs?|ounces?|oz|kilograms?|kg|grams?|"
    r"count|ct|pk|packs?|cans?)\b",
    re.IGNORECASE,
)
_UNIT_BASE = {
    "ml": ("volume", 1.0),
    "l": ("volume", 1000.0),
    "fl oz": ("volume", 29.5735),
    "gal": ("volume", 3785.411784),
    "qt": ("volume", 946.352946),
    "pt": ("volume", 473.176473),
    "g": ("weight", 1.0),
    "kg": ("weight", 1000.0),
    "oz": ("weight", 28.3495),
    "lb": ("weight", 453.59237),
    "ct": ("each", 1.0),
    "can": ("each", 1.0),
}
_CART_BASE = {
    "ml": ("volume", 1.0),
    "g": ("weight", 1.0),
    "count": ("each", 1.0),
    "can": ("each", 1.0),
    "pack": ("each", 1.0),
}
_CANONICAL_UNIT = {
    "fl oz": "fl oz",
    "fluid ounce": "fl oz",
    "fluid ounces": "fl oz",
    "gallon": "gal",
    "gallons": "gal",
    "gal": "gal",
    "quart": "qt",
    "quarts": "qt",
    "qt": "qt",
    "pint": "pt",
    "pints": "pt",
    "pt": "pt",
    "liter": "l",
    "liters": "l",
    "litre": "l",
    "litres": "l",
    "l": "l",
    "milliliter": "ml",
    "milliliters": "ml",
    "ml": "ml",
    "pound": "lb",
    "pounds": "lb",
    "lb": "lb",
    "lbs": "lb",
    "ounce": "oz",
    "ounces": "oz",
    "oz": "oz",
    "kilogram": "kg",
    "kilograms": "kg",
    "kg": "kg",
    "gram": "g",
    "grams": "g",
    "g": "g",
    "count": "ct",
    "ct": "ct",
    "pk": "ct",
    "pack": "ct",
    "packs": "ct",
    "can": "can",
    "cans": "can",
}


def _canonical_unit(raw: str) -> str | None:
    text = re.sub(r"[.\s]+", " ", raw.lower()).strip()
    return _CANONICAL_UNIT.get(text)


def parse_package_size(size: str | None) -> dict[str, Any] | None:
    """Turn a Kroger size label into a quantity, unit, and comparable base amount."""
    if not isinstance(size, str) or not size.strip():
        return None
    text = size.strip().lower()
    if text in {"half gallon", "half gal"}:
        quantity, unit = 0.5, "gal"
    else:
        match = _SIZE_RE.search(text)
        if not match:
            return None
        raw_num = re.sub(r"\s+", "", match.group("num"))
        if "/" in raw_num:
            left, right = raw_num.split("/", 1)
            if float(right) == 0:
                return None
            quantity = float(left) / float(right)
        else:
            quantity = float(raw_num)
        unit = _canonical_unit(match.group("unit"))
        if unit is None or quantity <= 0:
            return None
    dimension, factor = _UNIT_BASE[unit]
    return {"quantity": quantity, "unit": unit, "dimension": dimension, "base": quantity * factor}


def packages_needed(
    quantity: float,
    unit: str,
    size: str | None,
    sold_by: str | None = None,
) -> dict[str, Any]:
    """How many priced packages cover one cart line.

    Compatible units use the package size (6 tortillas against a 10 ct pack is
    one pack). A count of items against a weight or volume label is one
    sellable package per item. Weighed goods use the requested weight against
    a per-pound price. Unknown sizes do not invent a conversion.
    """
    requested = float(quantity) if quantity and float(quantity) > 0 else 1.0
    cart = _CART_BASE.get(unit)
    parsed = parse_package_size(size)
    sold = (sold_by or "").strip().upper()

    if sold == "WEIGHT" and cart and cart[0] == "weight":
        pounds = (requested * cart[1]) / _UNIT_BASE["lb"][1]
        return {
            "packages": 1,
            "packageSize": {"quantity": round(requested, 2), "unit": unit},
            "priceMultiplier": pounds,
        }

    if parsed and cart and parsed["dimension"] == cart[0] and parsed["base"] > 0:
        packages = max(1, math.ceil((requested * cart[1]) / parsed["base"] - 1e-9))
        return {
            "packages": packages,
            "packageSize": {"quantity": parsed["quantity"], "unit": parsed["unit"]},
            "priceMultiplier": float(packages),
        }

    if cart and cart[0] == "each":
        packages = max(1, math.ceil(requested - 1e-9))
        package_size = (
            {"quantity": parsed["quantity"], "unit": parsed["unit"]}
            if parsed
            else {"quantity": 1, "unit": unit}
        )
        return {"packages": packages, "packageSize": package_size, "priceMultiplier": float(packages)}

    display = (
        {"quantity": parsed["quantity"], "unit": parsed["unit"]}
        if parsed
        else {"quantity": 1, "unit": unit or "count"}
    )
    return {"packages": 1, "packageSize": display, "priceMultiplier": 1.0}


def _store_summary(store: dict[str, Any]) -> dict[str, Any]:
    address = store.get("address") if isinstance(store.get("address"), dict) else {}
    summary = {
        "locationId": store.get("locationId"),
        "name": store.get("name"),
        "chain": store.get("chain"),
        "addressLine1": address.get("addressLine1"),
        "city": address.get("city"),
        "state": address.get("state"),
        "zipCode": address.get("zipCode"),
    }
    distance = store.get("distance")
    if isinstance(distance, (int, float)) and not isinstance(distance, bool):
        summary["distanceMiles"] = float(distance)
    return summary


def _prices_for_store(
    token: str,
    store: dict[str, Any],
    ingredients: list[str],
    *,
    zip_code: str,
    options_per_ingredient: int,
    retrieved_at: str,
) -> dict[str, Any] | None:
    location_id = str(store.get("locationId") or "")
    if not location_id:
        return None
    results = []
    for ingredient in ingredients:
        products = search_products(token, ingredient, location_id, limit=options_per_ingredient)
        options: list[dict[str, Any]] = []
        for product in products:
            options.extend(_options(product))
            if len(options) >= options_per_ingredient:
                break
        results.append({"ingredient": ingredient, "options": options[:options_per_ingredient]})
    return {
        "retrievedAt": retrieved_at,
        "zipCode": zip_code,
        "store": _store_summary(store),
        "ingredients": results,
    }


def lookup_store_prices(
    ingredients: list[str],
    zip_code: str,
    *,
    store_limit: int = 3,
    options_per_ingredient: int = 3,
    radius_miles: int = 20,
    latitude: float | None = None,
    longitude: float | None = None,
) -> list[dict[str, Any]]:
    """Priced options at each of the nearest Kroger-family stores, nearest first."""
    cleaned = [item.strip() for item in ingredients if item and item.strip()]
    if not cleaned:
        raise KrogerError("Provide at least one ingredient")
    zip_code = zip_code.strip()
    if len(zip_code) < 5:
        raise KrogerError("ZIP code must be at least 5 characters")

    token = get_access_token()
    stores = find_stores(
        token,
        zip_code,
        limit=max(store_limit, 1),
        radius_miles=radius_miles,
        latitude=latitude,
        longitude=longitude,
    )
    if not stores:
        raise KrogerError(f"No Kroger-family store within {radius_miles} miles of {zip_code}")

    retrieved_at = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    priced = []
    for store in stores[: max(store_limit, 1)]:
        one = _prices_for_store(
            token,
            store,
            cleaned,
            zip_code=zip_code,
            options_per_ingredient=options_per_ingredient,
            retrieved_at=retrieved_at,
        )
        if one:
            priced.append(one)
    if not priced:
        raise KrogerError("Nearby stores did not include a locationId")
    return priced


def lookup_ingredients(
    ingredients: list[str],
    zip_code: str,
    *,
    store_limit: int = 1,
    options_per_ingredient: int = 3,
    radius_miles: int = 20,
) -> dict[str, Any]:
    """
    The nearest store, then a few priced options for each ingredient.

    retrievedAt is when this process finished the Kroger calls.
    A null price means Kroger did not return one for that package.
    Pass store_limit only to widen the store search; the return value is still one store.
    Use lookup_store_prices when each nearby store should be priced.
    """
    return lookup_store_prices(
        ingredients,
        zip_code,
        store_limit=store_limit,
        options_per_ingredient=options_per_ingredient,
        radius_miles=radius_miles,
    )[0]
