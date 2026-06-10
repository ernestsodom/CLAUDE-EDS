"""Publisher via Zapier MCP — bypasses Meta API permissions entirely."""

import requests
from dataclasses import dataclass
from typing import Optional


@dataclass
class PostResult:
    success: bool
    post_id: Optional[str] = None
    error: Optional[str] = None


class ZapierPublisher:
    """
    Publishes to Instagram via the Zapier MCP webhook.
    No Meta API credentials needed — Zapier handles authentication.
    """

    def __init__(self, webhook_url: str):
        self.webhook_url = webhook_url

    def publish_photo(self, image_url: str, caption: str) -> PostResult:
        try:
            resp = requests.post(
                self.webhook_url,
                json={"image_url": image_url, "caption": caption},
                timeout=30,
            )
            if resp.status_code == 200:
                data = resp.json() if resp.text else {}
                return PostResult(success=True, post_id=data.get("id", "ok"))
            return PostResult(success=False, error=f"HTTP {resp.status_code}: {resp.text[:200]}")
        except Exception as exc:
            return PostResult(success=False, error=str(exc))
