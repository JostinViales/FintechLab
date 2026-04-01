"""Return Supabase connection config to the frontend.

Returns the anon/publishable key (safe for browser use).
Backend scripts use the service role key separately.
"""

import wmill


def main() -> dict:
    return {
        "url": wmill.get_variable("f/wealthflow/supabase_url"),
        "key": wmill.get_variable("f/wealthflow/supabase_anon_key"),
        "user_id": wmill.get_variable("f/wealthflow/user_id"),
    }
