"""Application settings loaded from environment variables."""

from __future__ import annotations

from pathlib import Path

from dotenv import load_dotenv
from pydantic_settings import BaseSettings

# Load .env before Settings reads env vars
_ENV_FILE = Path(__file__).resolve().parent.parent.parent / ".env"
load_dotenv(_ENV_FILE, override=True)


class Settings(BaseSettings):
    """Mailroom configuration.

    All values can be overridden via environment variables.
    """

    # App
    app_name: str = "Mailroom"
    app_version: str = "0.1.0"
    debug: bool = False

    # Database
    database_url: str = "postgresql://localhost:5432/mailroom_dev"

    # Storage
    storage_backend: str = "local"  # "local" or "s3"
    local_storage_path: str = "uploads"
    s3_bucket: str = ""
    s3_region: str = "us-east-1"

    # Auth
    api_key_header: str = "Authorization"

    # CORS
    cors_origins: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]

    # AI model providers
    anthropic_api_key: str = ""
    gemini_api_key: str = ""

    model_config = {"env_file": str(_ENV_FILE), "env_file_encoding": "utf-8"}


settings = Settings()
