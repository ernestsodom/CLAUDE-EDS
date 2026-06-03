import os
from dataclasses import dataclass
from dotenv import load_dotenv

load_dotenv()


@dataclass
class Config:
    instagram_access_token: str
    instagram_business_account_id: str
    instagram_app_id: str
    instagram_app_secret: str
    anthropic_api_key: str
    default_post_frequency: int
    brand_niche: str
    brand_voice: str
    brand_name: str


def load_config() -> Config:
    missing = []
    required = [
        "INSTAGRAM_ACCESS_TOKEN",
        "INSTAGRAM_BUSINESS_ACCOUNT_ID",
        "ANTHROPIC_API_KEY",
    ]
    for key in required:
        if not os.getenv(key):
            missing.append(key)

    if missing:
        raise EnvironmentError(
            f"Missing required environment variables: {', '.join(missing)}\n"
            "Copy .env.example to .env and fill in the values."
        )

    return Config(
        instagram_access_token=os.getenv("INSTAGRAM_ACCESS_TOKEN", ""),
        instagram_business_account_id=os.getenv("INSTAGRAM_BUSINESS_ACCOUNT_ID", ""),
        instagram_app_id=os.getenv("INSTAGRAM_APP_ID", ""),
        instagram_app_secret=os.getenv("INSTAGRAM_APP_SECRET", ""),
        anthropic_api_key=os.getenv("ANTHROPIC_API_KEY", ""),
        default_post_frequency=int(os.getenv("DEFAULT_POST_FREQUENCY", "2")),
        brand_niche=os.getenv("BRAND_NICHE", "lifestyle"),
        brand_voice=os.getenv("BRAND_VOICE", "friendly and authentic"),
        brand_name=os.getenv("BRAND_NAME", "Mi Marca"),
    )
