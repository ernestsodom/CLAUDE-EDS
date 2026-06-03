import time
import requests
from dataclasses import dataclass
from typing import Optional

GRAPH_URL = "https://graph.facebook.com/v19.0"


@dataclass
class PostResult:
    success: bool
    post_id: Optional[str] = None
    permalink: Optional[str] = None
    error: Optional[str] = None


class InstagramAPI:
    def __init__(self, access_token: str, business_account_id: str):
        self.token = access_token
        self.account_id = business_account_id
        self._session = requests.Session()

    def _get(self, path: str, params: dict = None) -> dict:
        params = params or {}
        params["access_token"] = self.token
        resp = self._retry(lambda: self._session.get(f"{GRAPH_URL}/{path}", params=params))
        resp.raise_for_status()
        return resp.json()

    def _post(self, path: str, data: dict = None) -> dict:
        data = data or {}
        data["access_token"] = self.token
        resp = self._retry(lambda: self._session.post(f"{GRAPH_URL}/{path}", data=data))
        resp.raise_for_status()
        return resp.json()

    @staticmethod
    def _retry(fn, max_attempts: int = 4):
        delay = 2
        last_exc = None
        for attempt in range(max_attempts):
            try:
                resp = fn()
                if resp.status_code == 429:
                    time.sleep(delay)
                    delay *= 2
                    continue
                return resp
            except requests.RequestException as exc:
                last_exc = exc
                time.sleep(delay)
                delay *= 2
        raise last_exc

    # ── Publishing ────────────────────────────────────────────────

    def publish_photo(self, image_url: str, caption: str) -> PostResult:
        """Two-step: create container → publish."""
        try:
            container = self._post(
                f"{self.account_id}/media",
                {"image_url": image_url, "caption": caption},
            )
            container_id = container.get("id")
            if not container_id:
                return PostResult(success=False, error=str(container))

            # Wait for container to be ready
            self._wait_for_container(container_id)

            result = self._post(
                f"{self.account_id}/media_publish",
                {"creation_id": container_id},
            )
            post_id = result.get("id")
            if not post_id:
                return PostResult(success=False, error=str(result))

            permalink = self._get_permalink(post_id)
            return PostResult(success=True, post_id=post_id, permalink=permalink)

        except Exception as exc:
            return PostResult(success=False, error=str(exc))

    def publish_carousel(self, image_urls: list[str], caption: str) -> PostResult:
        """Publish a carousel (up to 10 images)."""
        try:
            child_ids = []
            for url in image_urls[:10]:
                child = self._post(
                    f"{self.account_id}/media",
                    {"image_url": url, "is_carousel_item": "true"},
                )
                child_ids.append(child["id"])

            container = self._post(
                f"{self.account_id}/media",
                {
                    "media_type": "CAROUSEL",
                    "caption": caption,
                    "children": ",".join(child_ids),
                },
            )
            container_id = container.get("id")
            self._wait_for_container(container_id)

            result = self._post(
                f"{self.account_id}/media_publish",
                {"creation_id": container_id},
            )
            post_id = result.get("id")
            permalink = self._get_permalink(post_id)
            return PostResult(success=True, post_id=post_id, permalink=permalink)

        except Exception as exc:
            return PostResult(success=False, error=str(exc))

    def publish_reel(self, video_url: str, caption: str) -> PostResult:
        """Publish a Reel."""
        try:
            container = self._post(
                f"{self.account_id}/media",
                {"media_type": "REELS", "video_url": video_url, "caption": caption},
            )
            container_id = container.get("id")
            self._wait_for_container(container_id, max_wait=120)

            result = self._post(
                f"{self.account_id}/media_publish",
                {"creation_id": container_id},
            )
            post_id = result.get("id")
            permalink = self._get_permalink(post_id)
            return PostResult(success=True, post_id=post_id, permalink=permalink)

        except Exception as exc:
            return PostResult(success=False, error=str(exc))

    # ── Insights ──────────────────────────────────────────────────

    def get_account_insights(self, period: str = "day") -> dict:
        """Get account-level metrics."""
        metrics = "impressions,reach,profile_views,follower_count"
        try:
            return self._get(
                f"{self.account_id}/insights",
                {"metric": metrics, "period": period},
            )
        except Exception as exc:
            return {"error": str(exc)}

    def get_media_insights(self, media_id: str) -> dict:
        """Get per-post metrics."""
        metrics = "impressions,reach,likes,comments,shares,saved,total_interactions"
        try:
            return self._get(f"{media_id}/insights", {"metric": metrics})
        except Exception as exc:
            return {"error": str(exc)}

    def get_recent_posts(self, limit: int = 10) -> list[dict]:
        """Get recent media objects."""
        fields = "id,caption,media_type,permalink,timestamp,like_count,comments_count"
        try:
            data = self._get(
                f"{self.account_id}/media",
                {"fields": fields, "limit": limit},
            )
            return data.get("data", [])
        except Exception:
            return []

    def get_audience_demographics(self) -> dict:
        """Get follower demographics."""
        metrics = "audience_city,audience_country,audience_gender_age"
        try:
            return self._get(
                f"{self.account_id}/insights",
                {"metric": metrics, "period": "lifetime"},
            )
        except Exception as exc:
            return {"error": str(exc)}

    # ── Helpers ───────────────────────────────────────────────────

    def _wait_for_container(self, container_id: str, max_wait: int = 60) -> None:
        """Poll until container status is FINISHED."""
        waited = 0
        while waited < max_wait:
            data = self._get(container_id, {"fields": "status_code"})
            status = data.get("status_code", "")
            if status == "FINISHED":
                return
            if status == "ERROR":
                raise RuntimeError(f"Container error: {data}")
            time.sleep(5)
            waited += 5

    def _get_permalink(self, post_id: str) -> Optional[str]:
        try:
            data = self._get(post_id, {"fields": "permalink"})
            return data.get("permalink")
        except Exception:
            return None
