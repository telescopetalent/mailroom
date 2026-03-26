"""File storage backends."""

from __future__ import annotations

import os
import shutil
from abc import ABC, abstractmethod
from pathlib import Path
from typing import BinaryIO

from app.core.config import settings


class StorageBackend(ABC):
    """Abstract file storage interface."""

    @abstractmethod
    def upload(self, key: str, data: BinaryIO, content_type: str) -> str:
        """Upload a file. Returns the storage key."""
        ...

    @abstractmethod
    def download(self, key: str) -> bytes:
        """Download a file by key."""
        ...

    @abstractmethod
    def delete(self, key: str) -> None:
        """Delete a file by key."""
        ...


class LocalStorageBackend(StorageBackend):
    """Store files on the local filesystem (for development)."""

    def __init__(self, base_path: str = None):
        self.base_path = Path(base_path or settings.local_storage_path)
        self.base_path.mkdir(parents=True, exist_ok=True)

    def upload(self, key: str, data: BinaryIO, content_type: str) -> str:
        file_path = self.base_path / key
        file_path.parent.mkdir(parents=True, exist_ok=True)
        with open(file_path, "wb") as f:
            shutil.copyfileobj(data, f)
        return key

    def download(self, key: str) -> bytes:
        file_path = self.base_path / key
        with open(file_path, "rb") as f:
            return f.read()

    def delete(self, key: str) -> None:
        file_path = self.base_path / key
        if file_path.exists():
            os.remove(file_path)


class S3StorageBackend(StorageBackend):
    """Store files in AWS S3 (for production)."""

    def __init__(self):
        import boto3

        self.s3 = boto3.client("s3", region_name=settings.s3_region)
        self.bucket = settings.s3_bucket

    def upload(self, key: str, data: BinaryIO, content_type: str) -> str:
        self.s3.upload_fileobj(
            data, self.bucket, key, ExtraArgs={"ContentType": content_type}
        )
        return key

    def download(self, key: str) -> bytes:
        import io

        buf = io.BytesIO()
        self.s3.download_fileobj(self.bucket, key, buf)
        buf.seek(0)
        return buf.read()

    def delete(self, key: str) -> None:
        self.s3.delete_object(Bucket=self.bucket, Key=key)


def get_storage() -> StorageBackend:
    """Get the configured storage backend."""
    if settings.storage_backend == "s3":
        return S3StorageBackend()
    return LocalStorageBackend()
