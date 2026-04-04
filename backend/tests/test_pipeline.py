"""Tests for pipeline stages: ingest, classify, normalize, extract."""

from __future__ import annotations

import uuid

from app.pipeline.ingest import IngestResult, ingest
from app.pipeline.classify import ClassifyResult, classify
from app.pipeline.normalize import normalize
from app.pipeline.extract import extract
from app.services.model_provider import StubProvider


# ---------------------------------------------------------------------------
# Ingest
# ---------------------------------------------------------------------------


def test_ingest_text():
    result = ingest(
        user_id=uuid.uuid4(),
        workspace_id=uuid.uuid4(),
        source="web",
        content_text="Hello world",
    )
    assert isinstance(result, IngestResult)
    assert result.raw_text == "Hello world"
    assert result.source == "web"
    assert result.file_keys == []


def test_ingest_with_files():
    result = ingest(
        user_id=uuid.uuid4(),
        workspace_id=uuid.uuid4(),
        source="web",
        content_text="Notes",
        file_keys=["key1"],
        file_metas=[{"filename": "test.png", "content_type": "image/png", "size_bytes": 100}],
    )
    assert result.file_keys == ["key1"]
    assert result.file_metas[0]["filename"] == "test.png"


# ---------------------------------------------------------------------------
# Classify
# ---------------------------------------------------------------------------


def test_classify_text_only():
    ir = IngestResult(
        user_id=uuid.uuid4(),
        workspace_id=uuid.uuid4(),
        source="web",
        raw_text="Some text",
    )
    result = classify(ir)
    assert result.content_type == "text"


def test_classify_image_only():
    ir = IngestResult(
        user_id=uuid.uuid4(),
        workspace_id=uuid.uuid4(),
        source="web",
        file_keys=["img.png"],
        file_metas=[{"content_type": "image/png"}],
    )
    result = classify(ir)
    assert result.content_type == "image"


def test_classify_mixed():
    ir = IngestResult(
        user_id=uuid.uuid4(),
        workspace_id=uuid.uuid4(),
        source="web",
        raw_text="Notes",
        file_keys=["doc.pdf"],
        file_metas=[{"content_type": "application/pdf"}],
    )
    result = classify(ir)
    assert result.content_type == "mixed"


def test_classify_url_only():
    ir = IngestResult(
        user_id=uuid.uuid4(),
        workspace_id=uuid.uuid4(),
        source="web",
        raw_url="https://example.com",
    )
    result = classify(ir)
    assert result.content_type == "url"


def test_classify_pdf_only():
    ir = IngestResult(
        user_id=uuid.uuid4(),
        workspace_id=uuid.uuid4(),
        source="web",
        file_keys=["doc.pdf"],
        file_metas=[{"content_type": "application/pdf"}],
    )
    result = classify(ir)
    assert result.content_type == "pdf"


# ---------------------------------------------------------------------------
# Normalize
# ---------------------------------------------------------------------------


def test_normalize_creates_capture(db, test_user):
    ir = IngestResult(
        user_id=test_user["user_id"],
        workspace_id=test_user["workspace_id"],
        source="web",
        raw_text="Meeting notes",
    )
    cr = ClassifyResult(content_type="text")

    capture = normalize(ir, cr, db)
    db.flush()

    assert capture.id is not None
    assert capture.normalized_text == "Meeting notes"
    assert capture.content_type == "text"
    assert capture.status == "processing"


# ---------------------------------------------------------------------------
# Extract (using StubProvider)
# ---------------------------------------------------------------------------


def test_extract_with_stub(db, test_user):
    ir = IngestResult(
        user_id=test_user["user_id"],
        workspace_id=test_user["workspace_id"],
        source="web",
        raw_text="John needs to finish the API by Friday",
    )
    cr = ClassifyResult(content_type="text")
    capture = normalize(ir, cr, db)
    db.flush()

    provider = StubProvider()
    extraction = extract(capture, provider, db)
    db.flush()

    assert extraction.id is not None
    assert extraction.capture_id == capture.id
    assert extraction.model_provider == "stub"
    assert capture.status == "review"


def test_extract_empty_content(db, test_user):
    ir = IngestResult(
        user_id=test_user["user_id"],
        workspace_id=test_user["workspace_id"],
        source="web",
    )
    cr = ClassifyResult(content_type="text")
    capture = normalize(ir, cr, db)
    db.flush()

    provider = StubProvider()
    extraction = extract(capture, provider, db)

    assert extraction.summary is None
    assert extraction.tasks == []
