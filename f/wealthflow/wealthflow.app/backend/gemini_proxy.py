"""Gemini AI proxy — Windmill backend runnable.

Replaces the Supabase Edge Function (supabase/functions/gemini-proxy/index.ts).
Validates actions and proxies requests to the Google Gemini API.
"""

import wmill
from google import genai

ALLOWED_ACTIONS = {
    "financial-advisor",
    "analyze-trade-signals",
    "assess-portfolio-risk",
    "summarize-trade-journal",
    "suggest-rebalancing",
}


def main(action: str, prompt: str) -> dict:
    """Proxy a request to the Google Gemini API.

    Args:
        action: The AI action type (must be in ALLOWED_ACTIONS).
        prompt: The prompt text to send to Gemini.

    Returns:
        Dict with 'text' on success or 'error' on failure.
    """
    if action not in ALLOWED_ACTIONS:
        return {"error": f"Invalid action: {action}"}

    if not prompt or not isinstance(prompt, str):
        return {"error": "prompt is required"}

    api_key = wmill.get_variable("f/wealthflow/gemini_api_key")
    if not api_key:
        return {"error": "Gemini API key not configured"}

    try:
        client = genai.Client(api_key=api_key)
        response = client.models.generate_content(
            model="gemini-3.1-pro-preview",
            contents=prompt,
            config={"thinking_config": {"thinking_budget": 2048}},
        )
        return {"text": response.text or ""}
    except Exception as exc:
        return {"error": str(exc)}
