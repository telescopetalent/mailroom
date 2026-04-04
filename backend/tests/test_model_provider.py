"""Tests for model provider abstraction."""

from __future__ import annotations

from app.services.model_provider import StubProvider


def test_stub_provider_text():
    provider = StubProvider()
    result = provider.extract("Hello world")

    assert result["summary"] == "Captured content (11 chars)"
    assert result["tasks"] == []
    assert result["next_steps"] == []
    assert result["blockers"] == []
    assert result["priority"] == "none"


def test_stub_provider_with_images():
    provider = StubProvider()
    result = provider.extract("Notes", image_data=[{"data": "abc", "media_type": "image/png"}])

    assert "1 image(s)" in result["summary"]


def test_stub_provider_properties():
    provider = StubProvider()
    assert provider.provider_name == "stub"
    assert provider.model_id == "stub-v1"
