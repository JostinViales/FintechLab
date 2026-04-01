import hmac
import hashlib
import base64
from datetime import datetime, timezone
from typing import Any, Optional
import httpx
import wmill
from supabase import create_client, Client


# --- Constants ---

OKX_BASE_URL: str = "https://www.okx.com"


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
        endpoint: API endpoint path (e.g., "/api/v5/account/balance")
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


# --- Main Sync Logic ---


def main(instance: str = "live") -> dict[str, Any]:
    """
    Sync asset balances from OKX trading, funding, and earn accounts.

    Fetches balances from three account types:
    - Trading: /api/v5/account/balance (cashBal for quantity, openAvgPx for cost basis)
    - Funding: /api/v5/asset/balances (bal for quantity)
    - Earn (Savings): /api/v5/finance/savings/balance (amt for quantity, earnings field)

    Upsets all balances with quantity > 0 into asset_balances table.

    Args:
        instance: Trading instance - "live" or "demo"

    Returns:
        dict with synced counts per account type (trading, funding, earn)
    """
    result: dict[str, Any] = {"trading": 0, "funding": 0, "earn": 0, "errors": []}

    # Get Supabase credentials from Windmill variables
    try:
        supabase_url = wmill.get_variable("f/wealthflow/supabase_url")
        supabase_key = wmill.get_variable("f/wealthflow/supabase_service_role_key")
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

    # Get current timestamp for last_synced_at
    now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

    with httpx.Client() as client:
        # Fetch Trading Account Balance
        trading_balance_response = _call_okx_api(
            client,
            api_key,
            secret_key,
            passphrase,
            "/api/v5/account/balance",
            demo=(instance == "demo"),
        )

        if trading_balance_response and trading_balance_response.get("code") == "0":
            try:
                account_balance = trading_balance_response.get("data", [{}])[0]
                details = account_balance.get("details", [])

                for detail in details:
                    total_bal = float(detail.get("cashBal") or 0)
                    if total_bal <= 0:
                        continue

                    avg_buy_price = float(detail.get("openAvgPx") or 0)
                    total_cost = avg_buy_price * total_bal if avg_buy_price > 0 else 0

                    balance_row = {
                        "asset": detail["ccy"],
                        "total_quantity": total_bal,
                        "avg_buy_price": avg_buy_price,
                        "total_cost": total_cost,
                        "last_synced_at": now,
                        "account_type": "trading",
                        "instance": instance,
                    }

                    try:
                        supabase.table("asset_balances").upsert(
                            balance_row,
                            on_conflict="asset,user_id,instance,account_type"
                        ).execute()
                        result["trading"] += 1
                    except Exception as e:
                        result["errors"].append(f"Failed to upsert trading balance {detail['ccy']}: {str(e)}")

            except Exception as e:
                result["errors"].append(f"Error processing trading balances: {str(e)}")
        else:
            msg = trading_balance_response.get("msg", "Unknown error") if trading_balance_response else "API call failed"
            result["errors"].append(f"Trading balance fetch failed: {msg}")

        # Fetch Funding Account Balance
        funding_response = _call_okx_api(
            client,
            api_key,
            secret_key,
            passphrase,
            "/api/v5/asset/balances",
            demo=(instance == "demo"),
        )

        if funding_response and funding_response.get("code") == "0":
            try:
                funding_balances = funding_response.get("data", [])

                for fb in funding_balances:
                    total_bal = float(fb.get("bal") or 0)
                    if total_bal <= 0:
                        continue

                    balance_row = {
                        "asset": fb["ccy"],
                        "total_quantity": total_bal,
                        "avg_buy_price": 0,
                        "total_cost": 0,
                        "last_synced_at": now,
                        "account_type": "funding",
                        "instance": instance,
                    }

                    try:
                        supabase.table("asset_balances").upsert(
                            balance_row,
                            on_conflict="asset,user_id,instance,account_type"
                        ).execute()
                        result["funding"] += 1
                    except Exception as e:
                        result["errors"].append(f"Failed to upsert funding balance {fb['ccy']}: {str(e)}")

            except Exception as e:
                result["errors"].append(f"Error processing funding balances: {str(e)}")
        else:
            msg = funding_response.get("msg", "Unknown error") if funding_response else "API call failed"
            wmill.log(f"Funding balance fetch warning: {msg}")  # Non-fatal

        # Fetch Earn (Simple Earn / Savings) Account Balance
        earn_response = _call_okx_api(
            client,
            api_key,
            secret_key,
            passphrase,
            "/api/v5/finance/savings/balance",
            demo=(instance == "demo"),
        )

        if earn_response and earn_response.get("code") == "0":
            try:
                savings_balances = earn_response.get("data", [])

                for sb in savings_balances:
                    total_amt = float(sb.get("amt") or 0)
                    if total_amt <= 0:
                        continue

                    earnings = float(sb.get("earnings") or 0)

                    balance_row = {
                        "asset": sb["ccy"],
                        "total_quantity": total_amt,
                        "avg_buy_price": 0,
                        "total_cost": 0,
                        "last_synced_at": now,
                        "account_type": "earn",
                        "instance": instance,
                        "earnings": earnings,
                    }

                    try:
                        supabase.table("asset_balances").upsert(
                            balance_row,
                            on_conflict="asset,user_id,instance,account_type"
                        ).execute()
                        result["earn"] += 1
                    except Exception as e:
                        result["errors"].append(f"Failed to upsert earn balance {sb['ccy']}: {str(e)}")

            except Exception as e:
                result["errors"].append(f"Error processing earn balances: {str(e)}")
        else:
            msg = earn_response.get("msg", "Unknown error") if earn_response else "API call failed"
            wmill.log(f"Earn balance fetch warning: {msg}")  # Non-fatal

    return result


# For Windmill, wrap main as the export
if __name__ == "__main__":
    result = main()
    print(result)
