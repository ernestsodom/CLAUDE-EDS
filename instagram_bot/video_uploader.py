"""Upload local video/image files to Cloudinary and return a public URL."""

import os
import time
import hashlib
import hmac
import requests
from pathlib import Path


class CloudinaryUploader:
    API_BASE = "https://api.cloudinary.com/v1_1"

    def __init__(self):
        self.cloud_name = os.getenv("CLOUDINARY_CLOUD_NAME", "")
        self.api_key = os.getenv("CLOUDINARY_API_KEY", "")
        self.api_secret = os.getenv("CLOUDINARY_API_SECRET", "")

    def is_configured(self) -> bool:
        return all([self.cloud_name, self.api_key, self.api_secret])

    def _sign(self, params: dict) -> str:
        """Generate SHA-1 signature for Cloudinary upload."""
        to_sign = "&".join(f"{k}={v}" for k, v in sorted(params.items()))
        return hmac.new(
            self.api_secret.encode(),
            to_sign.encode(),
            hashlib.sha1,
        ).hexdigest()

    def upload(self, file_path: str, resource_type: str = "video", folder: str = "instagram_bot") -> str:
        """
        Upload a local file to Cloudinary.
        Returns the secure public URL.
        resource_type: 'video' for MP4/MOV, 'image' for JPG/PNG
        """
        if not self.is_configured():
            raise RuntimeError(
                "Faltan credenciales de Cloudinary en tu .env:\n"
                "  CLOUDINARY_CLOUD_NAME\n"
                "  CLOUDINARY_API_KEY\n"
                "  CLOUDINARY_API_SECRET\n"
                "Regístrate gratis en https://cloudinary.com (plan Free = 25 GB/mes)"
            )

        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"Archivo no encontrado: {file_path}")

        timestamp = int(time.time())
        params = {"folder": folder, "timestamp": timestamp}
        signature = self._sign(params)

        url = f"{self.API_BASE}/{self.cloud_name}/{resource_type}/upload"
        with open(path, "rb") as f:
            resp = requests.post(
                url,
                data={
                    "api_key": self.api_key,
                    "timestamp": timestamp,
                    "folder": folder,
                    "signature": signature,
                },
                files={"file": (path.name, f)},
                timeout=300,
            )

        if resp.status_code != 200:
            raise RuntimeError(f"Cloudinary error {resp.status_code}: {resp.text}")

        data = resp.json()
        secure_url = data.get("secure_url")
        if not secure_url:
            raise RuntimeError(f"No se recibió URL de Cloudinary: {data}")

        return secure_url
