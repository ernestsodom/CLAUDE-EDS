"""Post scheduling with APScheduler and a JSON-based queue."""

import json
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.date import DateTrigger

QUEUE_FILE = Path("post_queue.json")


class PostQueue:
    def __init__(self, path: Path = QUEUE_FILE):
        self.path = path
        self._ensure_file()

    def _ensure_file(self) -> None:
        if not self.path.exists():
            self.path.write_text(json.dumps({"posts": []}, indent=2))

    def _load(self) -> dict:
        return json.loads(self.path.read_text())

    def _save(self, data: dict) -> None:
        self.path.write_text(json.dumps(data, indent=2, ensure_ascii=False))

    def add(self, post: dict) -> str:
        data = self._load()
        post_id = str(uuid.uuid4())[:8]
        entry = {
            "id": post_id,
            "status": "pending",
            "created_at": datetime.now().isoformat(),
            **post,
        }
        data["posts"].append(entry)
        self._save(data)
        return post_id

    def get_pending(self) -> list[dict]:
        data = self._load()
        now = datetime.now()
        return [
            p for p in data["posts"]
            if p["status"] == "pending"
            and datetime.fromisoformat(p.get("scheduled_at", "2000-01-01")) <= now
        ]

    def mark_done(self, post_id: str, result: dict) -> None:
        data = self._load()
        for post in data["posts"]:
            if post["id"] == post_id:
                post["status"] = "published"
                post["published_at"] = datetime.now().isoformat()
                post["result"] = result
                break
        self._save(data)

    def mark_failed(self, post_id: str, error: str) -> None:
        data = self._load()
        for post in data["posts"]:
            if post["id"] == post_id:
                post["status"] = "failed"
                post["error"] = error
                break
        self._save(data)

    def list_all(self) -> list[dict]:
        return self._load()["posts"]

    def clear_done(self) -> int:
        data = self._load()
        original = len(data["posts"])
        data["posts"] = [p for p in data["posts"] if p["status"] == "pending"]
        self._save(data)
        return original - len(data["posts"])


class PostScheduler:
    def __init__(self, instagram_api, queue: Optional[PostQueue] = None):
        self.api = instagram_api
        self.queue = queue or PostQueue()
        self._scheduler = BackgroundScheduler(timezone="America/Bogota")

    def start(self, check_interval_minutes: int = 15) -> None:
        """Start the scheduler. Checks the queue every N minutes."""
        self._scheduler.add_job(
            self._process_queue,
            trigger=CronTrigger(minute=f"*/{check_interval_minutes}"),
            id="queue_processor",
            replace_existing=True,
        )
        self._scheduler.start()

    def stop(self) -> None:
        if self._scheduler.running:
            self._scheduler.shutdown()

    def schedule_daily(
        self,
        image_url: str,
        caption: str,
        hour: int = 12,
        minute: int = 0,
    ) -> str:
        """Schedule a recurring daily post."""
        post_id = self.queue.add({
            "type": "photo",
            "image_url": image_url,
            "caption": caption,
            "scheduled_at": self._next_occurrence(hour, minute).isoformat(),
            "recurrence": f"daily@{hour:02d}:{minute:02d}",
        })
        return post_id

    def schedule_once(
        self,
        image_url: str,
        caption: str,
        run_at: datetime,
    ) -> str:
        """Schedule a one-time post."""
        post_id = self.queue.add({
            "type": "photo",
            "image_url": image_url,
            "caption": caption,
            "scheduled_at": run_at.isoformat(),
        })
        return post_id

    def _process_queue(self) -> None:
        """Publish all pending posts whose scheduled_at has passed."""
        pending = self.queue.get_pending()
        for post in pending:
            result = self._publish(post)
            if result.success:
                self.queue.mark_done(post["id"], {"post_id": result.post_id, "permalink": result.permalink})
            else:
                self.queue.mark_failed(post["id"], result.error or "Unknown error")

    def _publish(self, post: dict):
        post_type = post.get("type", "photo")
        caption = post.get("caption", "")

        if post_type == "carousel":
            return self.api.publish_carousel(post.get("image_urls", []), caption)
        if post_type == "reel":
            return self.api.publish_reel(post.get("video_url", ""), caption)
        return self.api.publish_photo(post.get("image_url", ""), caption)

    @staticmethod
    def _next_occurrence(hour: int, minute: int) -> datetime:
        now = datetime.now()
        candidate = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
        if candidate <= now:
            from datetime import timedelta
            candidate += timedelta(days=1)
        return candidate
