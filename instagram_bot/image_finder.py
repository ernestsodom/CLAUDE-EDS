"""Image sourcing from Unsplash based on a topic/keyword."""

import os
import requests
from pathlib import Path

UNSPLASH_API = "https://api.unsplash.com/search/photos"


class ImageFinder:
    def __init__(self, access_key: str = ""):
        # Falls back to the env var if not passed explicitly
        self.access_key = access_key or os.getenv("UNSPLASH_ACCESS_KEY", "")

    def is_configured(self) -> bool:
        return bool(self.access_key)

    def search(self, query: str, count: int = 5, orientation: str = "squarish") -> list[dict]:
        """
        Search Unsplash for images matching the query.
        Returns a list of dicts: {url, download_url, author, author_url, description}.
        """
        if not self.access_key:
            raise RuntimeError(
                "Falta UNSPLASH_ACCESS_KEY en tu .env. "
                "Consíguela gratis en https://unsplash.com/developers"
            )

        resp = requests.get(
            UNSPLASH_API,
            params={
                "query": query,
                "per_page": count,
                "orientation": orientation,
            },
            headers={"Authorization": f"Client-ID {self.access_key}"},
            timeout=30,
        )
        resp.raise_for_status()
        results = resp.json().get("results", [])

        images = []
        for photo in results:
            images.append({
                "url": photo["urls"]["regular"],
                "download_url": photo["urls"]["full"],
                "thumb": photo["urls"]["small"],
                "author": photo["user"]["name"],
                "author_url": photo["user"]["links"]["html"],
                "description": photo.get("description") or photo.get("alt_description") or query,
            })
        return images

    def download(self, image: dict, dest_folder: str = "downloaded_images") -> str:
        """Download an image dict (from search) to a local folder. Returns the file path."""
        Path(dest_folder).mkdir(exist_ok=True)
        safe_name = "".join(c for c in image["description"][:40] if c.isalnum() or c in " -_").strip()
        safe_name = safe_name.replace(" ", "_") or "imagen"
        file_path = Path(dest_folder) / f"{safe_name}.jpg"

        resp = requests.get(image["download_url"], timeout=60)
        resp.raise_for_status()
        file_path.write_bytes(resp.content)
        return str(file_path)
