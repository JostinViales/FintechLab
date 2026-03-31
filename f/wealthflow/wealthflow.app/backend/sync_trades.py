import hmac
import hashlib
import base64
from datetime import datetime, timezone
from typing import Any, Optional
import httpx
import wmill
from supabase import create_client, Client


# --- Constants ---

SYNC_CUTOFF_MS: int = int(datetime(2026, 1, 1, 0, 0, 0, tzinfo=timezone.utc).timestamp() * 1000)
OKX_BASE_URL: str = "https://www.okx.com"

CLOSE_TYPE_LABELS: dict[str, str] = {
    "1": "Partial close",
    "2": "Close all",
    "3": "Liquidation",
    "4": "Partial liquidation",
    "5": "ADL (partial)",
    "6": "ADL (full)",
}


# --- OKX API Client ---


def _call_okx_api(
    client: httpx.Client,
    api_key: str,
    secret_key: str,
    passphrase: str,
    endpoint: str,
    params: Optional[dict[str, str]] = None,
    demo: bool = False,
) -> dict[str, Any] | None:
    """
    Call OKX API with HMAC-SHA256 signing.

    Args:
        client: httpx.Client instance for making requests
        api_key: OKX API key
        secret_key: OKX secret key
        passphrase: OKX passphrase
        endpoint: API endpoint path (e.g., "/api/v5/account/positions-history")
        params: Query parameters as dict
        demo: Whether to use demo trading (sets x-simulated-trading header)

    Returns:
        Parsed JSON response or None on error
    """
    # Build request path with query params
    request_path = endpoint
    if params:
        query_string = "&".join(f"{k}={v}" for k, v in params.items())
        request_path = f"{endpoint}?{query_string}"

    # OKX V5 signing: timestamp + method + requestPath
    timestamp = datetime.now(timezone.utc).isoformat(timespec='milliseconds').replace('+00:00', 'Z')
    prehash = timestamp + "GET" + request_path

    # HMAC-SHA256 signature
    signature = base64.b64encode(
        hmac.new(
            secret_key.encode(),
            prehash.encode(),
            hashlib.sha256
        ).digest()
    ).decode()

    headers = {
        "OK-ACCESS-KEY": api_key,
        "OK-ACCESS-SIGN": signature,
        "OK-ACCESS-TIMESTAMP": timestamp,
        "OK-ACCESS-PASSPHRASE": passphrase,
        "Content-Type": "application/json",
    }

    if demo:
        headers["x-simulated-trading"] = "1"

    url = f"{OKX_BASE_URL}{request_path}"

    try:
        response = client.get(url, headers=headers)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        wmill.log(f"OKX API error: {str(e)}")
        return None


# --- Trade Mapping ---


def _map_okx_position_to_trade(position: dict[str, Any]) -> dict[str, Any]:
    """
    Map OKX position history record to trade row.

    Args:
        position: OKX position history object

    Returns:
        Trade row dict with all required fields
    """
    direction = position.get("direction") or position.get("posSide") or "net"
    close_type_label = CLOSE_TYPE_LABELS.get(position.get("type", ""), None)

    return {
        "symbol": position["instId"],
        "side": "sell",
        "price": float(position["closeAvgPx"]),
        "quantity": float(position["closeTotalPos"]),
        "fee": abs(float(position["fee"])),
        "fee_currency": position.get("ccy") or "USDT",
        "realized_pnl": float(position["realizedPnl"]),
        "source": "okx",
        "okx_pos_id": position["posId"],
        "direction": direction,
        "open_avg_px": float(position["openAvgPx"]),
        "close_avg_px": float(position["closeAvgPx"]),
        "funding_fee": abs(float(position["fundingFee"])),
        "liq_penalty": abs(float(position["liqPenalty"])),
        "pnl_ratio": float(position["pnlRatio"]),
        "leverage": position.get("lever"),
        "margin_mode": position.get("mgnMode"),
        "open_time": _ms_to_iso(int(position["cTime"])),
        "close_time": _ms_to_iso(int(position["uTime"])),
        "traded_at": _ms_to_iso(int(position["uTime"])),
        "notes": close_type_label,
    }


def _ms_to_iso(timestamp_ms: int) -> str:
    """Convert milliseconds timestamp to ISO 8601 string."""
    return datetime.fromtimestamp(timestamp_ms / 1000, tz=timezone.utc).isoformat().replace("+00:00", "Z")


# --- Main Sync Logic ---


def main(instance: str = "live") -> dict[str, Any]:
    """
    Sync closed positions from OKX to the trades table.

    Fetches position history from OKX (paginated, up to 10 pages × 100 records),
    skips positions closed before 2026-01-01, deduplicates against existing trades,
    and inserts new trades into Supabase.

    Args:
        instance: Trading instance - "live" or "demo"

    Returns:
        dict with imported, skipped, errors counts
    """
    result: dict[str, Any] = {"imported": 0, "skipped": 0, "errors": []}

    # Get Supabase credentials from Windmill variables
    try:
        supabase_url = wmill.get_variable("u/user/supabase_url")
        supabase_key = wmill.get_variable("u/user/supabase_service_role_key")
    except Exception as e:
        result["errors"].append(f"Failed to load Supabase credentials: {str(e)}")
        return result

    # Get OKX credentials from Supabase
    try:
        supabase: Client = create_client(supabase_url, supabase_key)

        # Query okx_credentials table
        creds_response = supabase.table("okx_credentials").select(
            "api_key, secret_key, passphrase"
        ).eq("instance", instance).limit(1).execute()

        if not creds_response.data:
            result["errors"].append(f"No OKX credentials found for instance: {instance}")
            return result

        creds = creds_response.data[0]
        api_key = creds["api_key"]
        secret_key = creds["secret_key"]
        passphrase = creds["passphrase"]

    except Exception as e:
        result["errors"].append(f"Failed to load OKX credentials: {str(e)}")
        return result

    # Load existing trades to get set of existing okx_pos_id values for deduplication
    try:
        trades_response = supabase.table("trades").select(
            "okx_pos_id"
        ).eq("instance", instance).execute()

        existing_pos_ids: set[str] = {
            trade["okx_pos_id"] for trade in trades_response.data
            if trade.get("okx_pos_id")
        }
    except Exception as e:
        result["errors"].append(f"Failed to load existing trades: {str(e)}")
        return result

    # Fetch position history with pagination (cursor-based, max 10 pages)
    with httpx.Client() as client:
        after: Optional[str] = None

        for page in range(10):
            params: dict[str, str] = {"limit": "100"}
            if after:
                params["after"] = after

            # Call OKX API
            api_response = _call_okx_api(
                client,
                api_key,
                secret_key,
                passphrase,
                "/api/v5/account/positions-history",
                params,
                demo=(instance == "demo"),
            )

            if not api_response:
                result["errors"].append(f"OKX API request failed on page {page}")
                break

            # Check OKX response code
            if api_response.get("code") != "0":
                msg = api_response.get("msg", "Unknown error")
                result["errors"].append(f"OKX API error: {msg}")
                break

            positions = api_response.get("data", [])
            if not positions:
                break

            # Process each position
            hit_cutoff = False
            for position in positions:
                utime_ms = int(position["uTime"])

                # Skip positions closed before cutoff date
                if utime_ms < SYNC_CUTOFF_MS:
                    result["skipped"] += 1
                    hit_cutoff = True
                    continue

                # Skip already-synced positions (by okx_pos_id)
                if position["posId"] in existing_pos_ids:
                    result["skipped"] += 1
                    continue

                # Map and insert trade
                try:
                    trade_row = _map_okx_position_to_trade(position)

                    # Insert into Supabase trades table
                    supabase.table("trades").insert(trade_row).execute()

                    result["imported"] += 1
                    existing_pos_ids.add(position["posId"])

                except Exception as e:
                    result["errors"].append(f"Failed to save position {position['posId']}: {str(e)}")

            # OKX returns newest first; if we hit cutoff, all remaining pages are older
            if hit_cutoff:
                break

            # Pagination: use uTime of last record as cursor
            if len(positions) < 100:
                break

            after = positions[-1]["uTime"]

    return result


# For Windmill, wrap main as the export
if __name__ == "__main__":
    result = main()
    print(result)
