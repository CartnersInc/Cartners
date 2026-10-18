"""
Kroger public API lookup: nearest store, then priced product options.

Uses the free client-credentials flow. Cart and Identity need a shopper
login and are not called here.

Docs: https://developer.kroger.com/
"""

from __future__ import annotations

import base64
import json
import os
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


def find_stores(token: str, zip_code: str, *, limit: int = 3, radius_miles: int = 20) -> list[dict[str, Any]]:
    """Stores Kroger ranks nearest to this ZIP. Kroger-family banners only."""
    payload = _request(
        "GET",
        "/locations",
        token=token,
        query={
            "filter.zipCode.near": zip_code,
            "filter.radiusInMiles": str(radius_miles),
            "filter.limit": str(limit),
        },
    )
    stores = payload.get("data") or []
    if not isinstance(stores, list):
        raise KrogerError("Locations response did not include a data list")
    return [store for store in stores if isinstance(store, dict)]


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


def _store_summary(store: dict[str, Any]) -> dict[str, Any]:
    address = store.get("address") if isinstance(store.get("address"), dict) else {}
    return {
        "locationId": store.get("locationId"),
        "name": store.get("name"),
        "chain": store.get("chain"),
        "addressLine1": address.get("addressLine1"),
        "city": address.get("city"),
        "state": address.get("state"),
        "zipCode": address.get("zipCode"),
    }


def lookup_ingredients(
    ingredients: list[str],
    zip_code: str,
    *,
    store_limit: int = 1,
    options_per_ingredient: int = 3,
    radius_miles: int = 20,
) -> dict[str, Any]:
    """
    One nearby store, then a few priced options for each ingredient.

    retrievedAt is when this process finished the Kroger calls.
    A null price means Kroger did not return one for that package.
    """
    cleaned = [item.strip() for item in ingredients if item and item.strip()]
    if not cleaned:
        raise KrogerError("Provide at least one ingredient")
    zip_code = zip_code.strip()
    if len(zip_code) < 5:
        raise KrogerError("ZIP code must be at least 5 characters")

    token = get_access_token()
    stores = find_stores(token, zip_code, limit=max(store_limit, 1), radius_miles=radius_miles)
    if not stores:
        raise KrogerError(
            f"No Kroger-family store within {radius_miles} miles of {zip_code}"
        )

    chosen = stores[0]
    location_id = str(chosen.get("locationId") or "")
    if not location_id:
        raise KrogerError("Nearest store did not include a locationId")

    results = []
    for ingredient in cleaned:
        products = search_products(
            token,
            ingredient,
            location_id,
            limit=options_per_ingredient,
        )
        options: list[dict[str, Any]] = []
        for product in products:
            options.extend(_options(product))
            if len(options) >= options_per_ingredient:
                break
        results.append(
            {
                "ingredient": ingredient,
                "options": options[:options_per_ingredient],
            }
        )

    return {
        "retrievedAt": datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        "zipCode": zip_code,
        "store": _store_summary(chosen),
        "ingredients": results,
    }
