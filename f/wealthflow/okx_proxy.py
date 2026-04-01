"""OKX API proxy — Windmill backend runnable.

Replaces the Supabase Edge Function (supabase/functions/okx-proxy/index.ts).
Handles HMAC-SHA256 request signing, credential management, and API proxying.
"""

import hmac
import hashlib
import base64
from datetime import datetime, timezone
from urllib.parse import urlencode

import httpx
import wmill
from supabase import create_client

WHITELISTED_ENDPOINTS = {
    "/api/v5/trade/fills-history",
    "/api/v5/trade/fills",
    "/api/v5/trade/orders-history-archive",
    "/api/v5/account/balance",
    "/api/v5/asset/balances",
    "/api/v5/finance/savings/balance",
    "/api/v5/market/ticker",
    "/api/v5/market/tickers",
    "/api/v5/account/positions-history",
    "/api/v5/account/positions",
}

OKX_BASE_URL = "https://www.okx.com"


def _get_supabase_client():
    """Create a Supabase client using service role credentials."""
    url = wmill.get_variable("f/wealthflow/supabase_url")
    key = wmill.get_variable("f/wealthflow/supabase_service_role_key")
    return create_client(url, key)


def _hmac_sign(secret: str, message: str) -> str:
    """Generate HMAC-SHA256 signature, base64-encoded."""
    mac = hmac.new(secret.encode(), message.encode(), hashlib.sha256)
    return base64.b64encode(mac.digest()).decode()


def _get_credentials(instance: str) -> dict | None:
    """Fetch OKX API credentials from the database.

    Args:
        instance: Trading instance ('live' or 'demo').

    Returns:
        Dict with api_key, secret_key, passphrase or None if not found.
    """
    db = _get_supabase_client()
    result = (
        db.table("okx_credentials")
        .select("api_key, secret_key, passphrase")
        .eq("instance", instance)
        .limit(1)
        .maybe_single()
        .execute()
    )

    if not result.data:
        return None

    return {
        "api_key": result.data["api_key"],
        "secret_key": result.data["secret_key"],
        "passphrase": result.data["passphrase"],
    }


def _store_credentials(
    api_key: str,
    secret_key: str,
    passphrase: str,
    instance: str,
) -> dict:
    """Upsert OKX API credentials into the database.

    Args:
        api_key: OKX API key.
        secret_key: OKX secret key.
        passphrase: OKX passphrase.
        instance: Trading instance ('live' or 'demo').

    Returns:
        Dict with success status.
    """
    db = _get_supabase_client()

    # Delete existing credentials for this instance
    db.table("okx_credentials").delete().eq("instance", instance).execute()

    # Insert new credentials
    db.table("okx_credentials").insert({
        "api_key": api_key,
        "secret_key": secret_key,
        "passphrase": passphrase,
        "instance": instance,
    }).execute()

    return {"success": True}


def _proxy_request(
    endpoint: str,
    method: str,
    params: dict | None,
    demo: bool,
    instance: str,
) -> dict:
    """Sign and proxy a request to the OKX API.

    Args:
        endpoint: OKX API endpoint path.
        method: HTTP method (GET or POST).
        params: Query parameters.
        demo: Whether to use demo trading mode.
        instance: Trading instance for credential lookup.

    Returns:
        Dict with 'data' containing the OKX API response.
    """
    if endpoint not in WHITELISTED_ENDPOINTS:
        return {"error": "Endpoint not allowed"}

    credentials = _get_credentials(instance)
    if not credentials:
        label = "Demo" if demo else "Live"
        return {"error": f"No API keys configured for {label}. Set up in Settings."}

    # Build request path with query params
    request_path = endpoint
    if params:
        filtered = {k: v for k, v in params.items() if v}
        if filtered:
            request_path = f"{endpoint}?{urlencode(filtered)}"

    # OKX V5 signing
    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"
    prehash = timestamp + method.upper() + request_path
    signature = _hmac_sign(credentials["secret_key"], prehash)

    headers = {
        "OK-ACCESS-KEY": credentials["api_key"],
        "OK-ACCESS-SIGN": signature,
        "OK-ACCESS-TIMESTAMP": timestamp,
        "OK-ACCESS-PASSPHRASE": credentials["passphrase"],
        "Content-Type": "application/json",
    }

    if demo:
        headers["x-simulated-trading"] = "1"

    url = f"{OKX_BASE_URL}{request_path}"

    with httpx.Client(timeout=30) as client:
        response = client.request(method.upper(), url, headers=headers)
        response_data = response.json()

    return {"data": response_data}


def main(
    endpoint: str = "",
    method: str = "GET",
    params: dict | None = None,
    action: str | None = None,
    api_key: str | None = None,
    secret_key: str | None = None,
    passphrase: str | None = None,
    demo: bool = False,
    instance: str = "live",
) -> dict:
    """OKX API proxy with HMAC-SHA256 signing.

    Handles two modes:
    - action='store-credentials': Store OKX API credentials
    - Otherwise: Sign and proxy request to OKX API

    Args:
        endpoint: OKX API endpoint path (e.g., /api/v5/account/balance).
        method: HTTP method (GET or POST).
        params: Query parameters for the API call.
        action: Special action ('store-credentials' or None).
        api_key: OKX API key (for store-credentials action).
        secret_key: OKX secret key (for store-credentials action).
        passphrase: OKX passphrase (for store-credentials action).
        demo: Whether to use demo trading mode.
        instance: Trading instance ('live' or 'demo').

    Returns:
        Dict with API response data or error message.
    """
    resolved_instance = "demo" if demo else instance

    if action == "store-credentials":
        if not api_key or not secret_key or not passphrase:
            return {"error": "api_key, secret_key, and passphrase are required"}
        return _store_credentials(api_key, secret_key, passphrase, resolved_instance)

    if not endpoint:
        return {"error": "endpoint is required"}

    return _proxy_request(endpoint, method, params, demo, resolved_instance)
